import { AiStructuredOutputValidation } from '@intentflow/validation';

export interface AIProviderContextMessage {
  id: string;
  senderId: string;
  senderName?: string;
  body: string;
  createdAt: string;
  attachments?: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
  }>;
}

export interface AIProviderContext {
  projectName: string;
  projectDescription?: string | null;
  conversationTitle: string;
  messages: AIProviderContextMessage[];
  previousConfirmedContext?: Array<{
    title: string;
    summary: string;
  }>;
}

export interface AIProvider {
  name: string;
  model: string;
  analyzeIntent(context: AIProviderContext): Promise<AiStructuredOutputValidation>;
}
