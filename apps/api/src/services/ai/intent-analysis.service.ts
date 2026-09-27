import { getDb } from '../../config/database.js';
import {
  intents,
  intentRequirements,
  intentQuestions,
  intentEvidence,
  intentVersions,
  intentProcessingRuns,
  conversations,
  messages,
} from '../../db/schema/index.js';
import { eq, and, desc, asc } from 'drizzle-orm';
import { AIProvider } from './providers/ai-provider.interface.js';
import { DefaultAIProvider } from './providers/openai.provider.js';
import { ContextBuilder } from './context-builder.js';
import { aiStructuredOutputSchema } from '@intentflow/validation';
import { broadcastToConversation } from '../../modules/conversations/websocket.js';

export class IntentAnalysisService {
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    this.provider = provider || new DefaultAIProvider();
  }

  async analyzeConversation(
    conversationId: string,
    userId: string,
    triggerMessageId?: string
  ): Promise<{ intentId: string; status: string }> {
    const db = getDb();

    // 1. Fetch conversation details to get projectId
    const conv = await db
      .select({ id: conversations.id, projectId: conversations.projectId })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (conv.length === 0) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const { projectId } = conv[0];

    // Get latest message ID if not provided for trigger check
    if (!triggerMessageId) {
      const lastMsg = await db
        .select({ id: messages.id })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      if (lastMsg.length > 0) {
        triggerMessageId = lastMsg[0].id;
      }
    }

    // Check for existing intent for this conversation
    const existingIntents = await db
      .select()
      .from(intents)
      .where(eq(intents.conversationId, conversationId))
      .orderBy(desc(intents.createdAt))
      .limit(1);

    let intentId: string;
    let currentIntent = existingIntents[0];

    if (currentIntent) {
      intentId = currentIntent.id;
      // Set status to processing while analyzing
      await db
        .update(intents)
        .set({ status: 'processing', updatedAt: new Date() })
        .where(eq(intents.id, intentId));
    } else {
      const [newIntent] = await db
        .insert(intents)
        .values({
          projectId,
          conversationId,
          createdBy: userId,
          status: 'processing',
          origin: 'ai',
          modifiedByHuman: false,
          title: 'Analyzing conversation...',
          summary: 'Extracting structured work intent from conversation context.',
          confidence: 0,
          sourceMessageId: triggerMessageId || null,
        })
        .returning();
      intentId = newIntent.id;
    }

    // 2. Create processing run log
    const [run] = await db
      .insert(intentProcessingRuns)
      .values({
        conversationId,
        intentId,
        triggerMessageId: triggerMessageId || null,
        provider: this.provider.name,
        model: this.provider.model,
        status: 'pending',
        startedAt: new Date(),
      })
      .returning();

    // Broadcast real-time status: processing
    broadcastToConversation(conversationId, {
      type: 'intent.processing',
      conversationId,
      runId: run.id,
    });

    try {
      // 3. Build context & call AI provider
      const context = await ContextBuilder.buildContextForConversation(conversationId);
      const rawOutput = await this.provider.analyzeIntent(context);

      // 4. Validate output with Zod
      const parseResult = aiStructuredOutputSchema.safeParse(rawOutput);
      if (!parseResult.success) {
        const errorMsg = `JSON validation failed: ${JSON.stringify(parseResult.error.format())}`;
        await db
          .update(intentProcessingRuns)
          .set({
            status: 'failed',
            completedAt: new Date(),
            errorCode: errorMsg,
          })
          .where(eq(intentProcessingRuns.id, run.id));

        await db
          .update(intents)
          .set({
            status: 'needs_clarification',
            summary: 'AI output validation failed. Manual review required.',
            updatedAt: new Date(),
          })
          .where(eq(intents.id, intentId));

        return { intentId, status: 'failed' };
      }

      const structured = parseResult.data;

      // 5. Update Intent entity
      await db
        .update(intents)
        .set({
          status: 'ready_for_review',
          title: structured.title,
          summary: structured.summary,
          confidence: structured.confidence,
          sourceMessageId: triggerMessageId || null,
          updatedAt: new Date(),
        })
        .where(eq(intents.id, intentId));

      // 6. Delete old requirements & questions to replace with fresh analysis (preserving history in versions)
      await db.delete(intentRequirements).where(eq(intentRequirements.intentId, intentId));
      await db.delete(intentQuestions).where(eq(intentQuestions.intentId, intentId));
      await db.delete(intentEvidence).where(eq(intentEvidence.intentId, intentId));

      // Insert requirements
      if (structured.requirements.length > 0) {
        await db.insert(intentRequirements).values(
          structured.requirements.map((r: any, idx: number) => ({
            intentId,
            text: r.text,
            confidence: r.confidence ?? 0.85,
            position: idx + 1,
          }))
        );
      }

      // Insert missing information questions
      if (structured.missingInformation.length > 0) {
        await db.insert(intentQuestions).values(
          structured.missingInformation.map((q: any) => ({
            intentId,
            question: q.question,
            status: 'open' as const,
          }))
        );
      }

      // Insert evidence references
      if (structured.references && structured.references.length > 0) {
        await db.insert(intentEvidence).values(
          structured.references.map((ref: any) => ({
            intentId,
            messageId: ref.messageId,
            attachmentId: ref.attachmentId || null,
            excerpt: ref.excerpt || null,
          }))
        );
      } else if (triggerMessageId) {
        // Fallback evidence to trigger message
        await db.insert(intentEvidence).values({
          intentId,
          messageId: triggerMessageId,
          excerpt: structured.summary,
        });
      }

      // Save initial version snapshot
      const existingVersions = await db
        .select()
        .from(intentVersions)
        .where(eq(intentVersions.intentId, intentId));

      await db.insert(intentVersions).values({
        intentId,
        version: existingVersions.length + 1,
        source: 'ai',
        snapshot: structured as any,
        createdBy: null,
      });

      // Mark processing run completed
      await db
        .update(intentProcessingRuns)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(intentProcessingRuns.id, run.id));

      // Fetch full updated intent object for real-time notification
      const fullIntent = await this.getIntentWithDetails(intentId);

      // Broadcast real-time status: intent.ready
      broadcastToConversation(conversationId, {
        type: 'intent.ready',
        conversationId,
        intent: fullIntent,
      });

      return { intentId, status: 'ready_for_review' };
    } catch (err: any) {
      console.error('[IntentAnalysisService] Error analyzing conversation:', err);

      await db
        .update(intentProcessingRuns)
        .set({
          status: 'failed',
          completedAt: new Date(),
          errorCode: err?.message || 'Unknown processing error',
        })
        .where(eq(intentProcessingRuns.id, run.id));

      await db
        .update(intents)
        .set({
          status: 'needs_clarification',
          summary: 'Unable to process conversation intent. Communication is unaffected.',
          updatedAt: new Date(),
        })
        .where(eq(intents.id, intentId));

      return { intentId, status: 'failed' };
    }
  }

  async getIntentWithDetails(intentId: string): Promise<any> {
    const db = getDb();
    const intentList = await db.select().from(intents).where(eq(intents.id, intentId)).limit(1);
    if (intentList.length === 0) return null;

    const baseIntent = intentList[0];

    const reqs = await db
      .select()
      .from(intentRequirements)
      .where(eq(intentRequirements.intentId, intentId))
      .orderBy(asc(intentRequirements.position));

    const qstns = await db
      .select()
      .from(intentQuestions)
      .where(eq(intentQuestions.intentId, intentId));

    const evdnc = await db
      .select()
      .from(intentEvidence)
      .where(eq(intentEvidence.intentId, intentId));

    const vrsns = await db
      .select()
      .from(intentVersions)
      .where(eq(intentVersions.intentId, intentId))
      .orderBy(desc(intentVersions.version));

    return {
      ...baseIntent,
      createdAt: baseIntent.createdAt.toISOString(),
      updatedAt: baseIntent.updatedAt.toISOString(),
      reviewedAt: baseIntent.reviewedAt ? baseIntent.reviewedAt.toISOString() : null,
      requirements: reqs.map((r: any) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
      questions: qstns.map((q: any) => ({
        ...q,
        createdAt: q.createdAt.toISOString(),
        resolvedAt: q.resolvedAt ? q.resolvedAt.toISOString() : null,
      })),
      evidence: evdnc.map((e: any) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      })),
      versions: vrsns.map((v: any) => ({
        ...v,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  }
}
