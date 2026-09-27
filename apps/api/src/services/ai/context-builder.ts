import { getDb } from '../../config/database.js';
import { conversations, projects, messages, attachments, users, intents } from '../../db/schema/index.js';
import { eq, desc, asc } from 'drizzle-orm';
import { AIProviderContext, AIProviderContextMessage } from './providers/ai-provider.interface.js';

export class ContextBuilder {
  static async buildContextForConversation(conversationId: string): Promise<AIProviderContext> {
    const db = getDb();
    // 1. Fetch conversation and project info
    const conversationList = await db
      .select({
        conversationId: conversations.id,
        title: conversations.title,
        projectId: conversations.projectId,
        projectName: projects.name,
        projectDescription: projects.description,
      })
      .from(conversations)
      .innerJoin(projects, eq(conversations.projectId, projects.id))
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (conversationList.length === 0) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const conv = conversationList[0];

    // 2. Fetch recent messages (up to 30)
    const rawMessages = await db
      .select({
        id: messages.id,
        senderId: messages.senderId,
        senderName: users.name,
        body: messages.body,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(30);

    // Reverse to chronological order
    rawMessages.reverse();

    // 3. Attachments metadata for these messages
    const messageIds = rawMessages.map((m: any) => m.id);
    let allAttachments: Array<{
      id: string;
      messageId: string | null;
      fileName: string;
      mimeType: string;
      size: number;
    }> = [];

    if (messageIds.length > 0) {
      allAttachments = await db
        .select({
          id: attachments.id,
          messageId: attachments.messageId,
          fileName: attachments.fileName,
          mimeType: attachments.mimeType,
          size: attachments.size,
        })
        .from(attachments);
      allAttachments = allAttachments.filter((a: any) => a.messageId && messageIds.includes(a.messageId));
    }

    const formattedMessages: AIProviderContextMessage[] = rawMessages.map((m: any) => {
      const msgAtts = allAttachments
        .filter((a: any) => a.messageId === m.id)
        .map((a: any) => ({
          id: a.id,
          fileName: a.fileName,
          mimeType: a.mimeType,
          size: a.size,
        }));

      return {
        id: m.id,
        senderId: m.senderId,
        senderName: m.senderName || m.senderId,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        attachments: msgAtts,
      };
    });

    // 4. Previously confirmed intents in this project for context
    const confirmedIntents = await db
      .select({
        title: intents.title,
        summary: intents.summary,
      })
      .from(intents)
      .where(eq(intents.projectId, conv.projectId))
      .orderBy(desc(intents.updatedAt))
      .limit(5);

    return {
      projectName: conv.projectName,
      projectDescription: conv.projectDescription,
      conversationTitle: conv.title,
      messages: formattedMessages,
      previousConfirmedContext: confirmedIntents.filter((i: any) => i.title !== conv.title),
    };
  }
}
