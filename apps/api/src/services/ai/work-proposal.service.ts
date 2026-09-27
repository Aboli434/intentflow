import { getDb } from '../../config/database.js';
import {
  intents,
  intentRequirements,
  workProposals,
  workProposalItems,
  workItems,
  workItemRequirements,
  workItemActivity,
} from '../../db/schema/index.js';
import { eq, desc, asc } from 'drizzle-orm';
import { ContextBuilder } from './context-builder.js';
import { AIProvider } from './providers/ai-provider.interface.js';
import { DefaultAIProvider } from './providers/openai.provider.js';
import { SYSTEM_PROMPT_WORK_PROPOSAL, buildWorkProposalPrompt } from './prompts/work-proposal.js';
import { aiWorkProposalSchema, AiWorkProposalValidation } from '@intentflow/validation';
import { broadcastToConversation } from '../../modules/conversations/websocket.js';

export class WorkProposalService {
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    this.provider = provider || new DefaultAIProvider();
  }

  /**
   * Helper to fetch intent and project context for permission checks
   */
  async getIntentProject(intentId: string) {
    const db = getDb();
    const list = await db
      .select({
        intentId: intents.id,
        projectId: intents.projectId,
        conversationId: intents.conversationId,
        status: intents.status,
      })
      .from(intents)
      .where(eq(intents.id, intentId))
      .limit(1);

    return list[0] || null;
  }

  /**
   * Helper to fetch proposal and project context for permission checks
   */
  async getProposalProject(proposalId: string) {
    const db = getDb();
    const list = await db
      .select({
        proposalId: workProposals.id,
        projectId: workProposals.projectId,
        intentId: workProposals.intentId,
        status: workProposals.status,
      })
      .from(workProposals)
      .where(eq(workProposals.id, proposalId))
      .limit(1);

    return list[0] || null;
  }

  async generateProposal(intentId: string, userId: string): Promise<any> {
    return this.generateProposalForIntent(intentId, userId);
  }

  async generateProposalForIntent(intentId: string, userId: string): Promise<any> {
    const db = getDb();

    // 1. Fetch intent details
    const intentList = await db
      .select()
      .from(intents)
      .where(eq(intents.id, intentId))
      .limit(1);

    if (intentList.length === 0) {
      throw new Error(`Intent not found: ${intentId}`);
    }

    const intent = intentList[0];

    const reqs = await db
      .select()
      .from(intentRequirements)
      .where(eq(intentRequirements.intentId, intentId))
      .orderBy(asc(intentRequirements.position));

    // Delete any draft/pending_review proposals for this intent to re-generate fresh proposal
    const existingProposals = await db
      .select()
      .from(workProposals)
      .where(eq(workProposals.intentId, intentId));

    const pendingProp = existingProposals.find((p: any) => p.status === 'pending_review' || p.status === 'draft');
    if (pendingProp) {
      await db.delete(workProposals).where(eq(workProposals.id, pendingProp.id));
    }

    // 2. Build context & generate proposal
    const context = await ContextBuilder.buildContextForConversation(intent.conversationId);

    let proposalData: AiWorkProposalValidation;

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      try {
        const prompt = buildWorkProposalPrompt(context, {
          title: intent.title,
          summary: intent.summary,
          requirements: reqs.map((r: any) => ({ id: r.id, text: r.text })),
        });

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: this.provider.model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT_WORK_PROPOSAL },
              { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as any;
          const jsonText = data.choices?.[0]?.message?.content;
          if (jsonText) {
            proposalData = aiWorkProposalSchema.parse(JSON.parse(jsonText));
          } else {
            proposalData = this.fallbackProposal(intent, reqs);
          }
        } else {
          proposalData = this.fallbackProposal(intent, reqs);
        }
      } catch (err) {
        console.warn('[WorkProposalService] OpenAI call failed, falling back to local proposal generator:', err);
        proposalData = this.fallbackProposal(intent, reqs);
      }
    } else {
      proposalData = this.fallbackProposal(intent, reqs);
    }

    // 3. Persist proposal
    const [proposal] = await db
      .insert(workProposals)
      .values({
        projectId: intent.projectId,
        intentId: intent.id,
        createdBy: userId,
        status: 'pending_review',
        generatedBy: 'ai',
      })
      .returning();

    // Persist proposal items
    const insertedItems = [];
    if (proposalData.items.length > 0) {
      for (let i = 0; i < proposalData.items.length; i++) {
        const item = proposalData.items[i];
        const [pItem] = await db
          .insert(workProposalItems)
          .values({
            proposalId: proposal.id,
            title: item.title,
            description: item.description || null,
            priority: (item.priority as any) || 'medium',
            estimatedEffort: (item.estimatedEffort as any) || 'small',
            sourceRequirementId: item.sourceRequirementId || (reqs.length > 0 ? reqs[0].id : null),
            suggestedRole: item.suggestedRole || 'developer',
            position: i + 1,
          })
          .returning();
        insertedItems.push(pItem);
      }
    }

    const fullProposal = await this.getProposalWithDetails(proposal.id);

    // Broadcast real-time WS event
    broadcastToConversation(intent.conversationId, {
      type: 'work_proposal.ready',
      projectId: intent.projectId,
      proposal: fullProposal,
    });

    return fullProposal;
  }

  private fallbackProposal(intent: any, reqs: any[]): AiWorkProposalValidation {
    const items: Array<{
      title: string;
      description?: string | null;
      priority: 'low' | 'medium' | 'high' | 'urgent';
      estimatedEffort: 'small' | 'medium' | 'large';
      sourceRequirementId?: string | null;
      suggestedRole: string;
    }> = [];

    if (reqs.length > 0) {
      for (const req of reqs) {
        const textLower = req.text.toLowerCase();
        if (textLower.includes('image') || textLower.includes('asset') || textLower.includes('hero')) {
          items.push({
            title: `Implement: ${req.text}`,
            description: `Execute visual enhancement as specified in confirmed requirement: "${req.text}".`,
            priority: 'high',
            estimatedEffort: 'small',
            sourceRequirementId: req.id,
            suggestedRole: 'developer',
          });
        } else if (textLower.includes('animation') || textLower.includes('speed') || textLower.includes('smooth')) {
          items.push({
            title: `Review and adjust animation speed`,
            description: `Refine transition duration and easing functions to optimize perceived smoothness.`,
            priority: 'medium',
            estimatedEffort: 'small',
            sourceRequirementId: req.id,
            suggestedRole: 'developer',
          });
        } else {
          items.push({
            title: `Execute requirement: ${req.text}`,
            description: `Implementation task for requirement "${req.text}".`,
            priority: 'medium',
            estimatedEffort: 'small',
            sourceRequirementId: req.id,
            suggestedRole: 'developer',
          });
        }
      }
    } else {
      items.push({
        title: `Implement work for: ${intent.title}`,
        description: intent.summary,
        priority: 'high',
        estimatedEffort: 'medium',
        sourceRequirementId: null,
        suggestedRole: 'developer',
      });
    }

    return { items };
  }

  async getProposalsForIntent(intentId: string): Promise<any[]> {
    const db = getDb();
    const props = await db
      .select()
      .from(workProposals)
      .where(eq(workProposals.intentId, intentId))
      .orderBy(desc(workProposals.createdAt));

    return Promise.all(props.map((p: any) => this.getProposalWithDetails(p.id)));
  }

  async getProposalWithItems(proposalId: string): Promise<any> {
    return this.getProposalWithDetails(proposalId);
  }

  async getProposalWithDetails(proposalId: string): Promise<any> {
    const db = getDb();
    const propList = await db.select().from(workProposals).where(eq(workProposals.id, proposalId)).limit(1);
    if (propList.length === 0) return null;

    const baseProposal = propList[0];
    const items = await db
      .select()
      .from(workProposalItems)
      .where(eq(workProposalItems.proposalId, proposalId))
      .orderBy(asc(workProposalItems.position));

    return {
      ...baseProposal,
      createdAt: baseProposal.createdAt.toISOString(),
      reviewedAt: baseProposal.reviewedAt ? baseProposal.reviewedAt.toISOString() : null,
      items,
    };
  }

  async updateProposalItems(proposalId: string, updatedItems: any[]): Promise<any> {
    const db = getDb();
    await db.delete(workProposalItems).where(eq(workProposalItems.proposalId, proposalId));

    if (updatedItems.length > 0) {
      for (let i = 0; i < updatedItems.length; i++) {
        const item = updatedItems[i];
        await db.insert(workProposalItems).values({
          proposalId,
          title: item.title,
          description: item.description || null,
          priority: item.priority || 'medium',
          estimatedEffort: item.estimatedEffort || 'small',
          sourceRequirementId: item.sourceRequirementId || null,
          suggestedRole: item.suggestedRole || 'developer',
          position: i + 1,
        });
      }
    }

    return this.getProposalWithDetails(proposalId);
  }

  async approveProposal(
    proposalId: string,
    reviewerId: string,
    modifiedItems?: any[]
  ): Promise<any[]> {
    const db = getDb();

    if (modifiedItems && modifiedItems.length > 0) {
      await this.updateProposalItems(proposalId, modifiedItems);
    }

    const proposal = await this.getProposalWithDetails(proposalId);
    if (!proposal) {
      throw new Error(`Proposal not found: ${proposalId}`);
    }

    if (proposal.status === 'approved') {
      throw new Error(`Proposal is already approved`);
    }

    // 1. Update proposal status to approved
    await db
      .update(workProposals)
      .set({
        status: 'approved',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      })
      .where(eq(workProposals.id, proposalId));

    // 2. Convert proposal items into actual Work Items
    const createdWorkItems: any[] = [];
    if (proposal.items && proposal.items.length > 0) {
      for (let i = 0; i < proposal.items.length; i++) {
        const item = proposal.items[i];

        const [workItem] = await db
          .insert(workItems)
          .values({
            projectId: proposal.projectId,
            intentId: proposal.intentId,
            title: item.title,
            description: item.description,
            status: 'ready',
            priority: item.priority || 'medium',
            createdBy: reviewerId,
            assignedTo: null,
            position: i + 1,
          })
          .returning();

        // Link work item to source requirement if present
        if (item.sourceRequirementId) {
          await db.insert(workItemRequirements).values({
            workItemId: workItem.id,
            requirementId: item.sourceRequirementId,
          });
        }

        // Record activity log: created
        await db.insert(workItemActivity).values({
          workItemId: workItem.id,
          actorId: reviewerId,
          type: 'created',
          metadata: { proposalId, sourceRequirementId: item.sourceRequirementId },
        });

        createdWorkItems.push(workItem);
      }
    }

    // Real-time notification
    const intentList = await db.select().from(intents).where(eq(intents.id, proposal.intentId)).limit(1);
    if (intentList.length > 0) {
      broadcastToConversation(intentList[0].conversationId, {
        type: 'work_proposal.approved',
        projectId: proposal.projectId,
        proposalId,
        workItems: createdWorkItems,
      });
    }

    return createdWorkItems;
  }

  async rejectProposal(proposalId: string, reviewerId: string): Promise<any> {
    const db = getDb();
    await db
      .update(workProposals)
      .set({
        status: 'rejected',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      })
      .where(eq(workProposals.id, proposalId));

    const updated = await this.getProposalWithDetails(proposalId);
    const intentList = await db.select().from(intents).where(eq(intents.id, updated.intentId)).limit(1);
    if (intentList.length > 0) {
      broadcastToConversation(intentList[0].conversationId, {
        type: 'work_proposal.rejected',
        projectId: updated.projectId,
        proposalId,
      });
    }

    return updated;
  }
}
