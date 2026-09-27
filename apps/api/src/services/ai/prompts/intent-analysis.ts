import { AIProviderContext } from '../providers/ai-provider.interface.js';

export const SYSTEM_PROMPT_INTENT_ANALYSIS = `
You are the IntentFlow Intelligence Engine.
Your task is to analyze client-developer communication in a project context and extract a structured, reviewable representation of WORK INTENT.

RULES:
1. Do NOT act as a chatbot. Do NOT write conversational replies or markdown prose.
2. Return ONLY a JSON object conforming to the required schema.
3. Extract explicit and implicit work requirements from the conversation.
4. HALLUCINATION CONTROL:
   - Do NOT invent requirements, deadlines, budgets, or technical constraints not present or implied in the messages.
   - If client requests are vague, incomplete, or ambiguous, DO NOT guess details. Instead, add a missingInformation question.
5. Trace each requirement to source message IDs (references) whenever possible.
6. Return confidence scores normalized between 0.0 and 1.0.
`;

export function buildIntentAnalysisPrompt(context: AIProviderContext): string {
  const formattedMessages = context.messages
    .map((m) => {
      const atts = m.attachments && m.attachments.length > 0
        ? ` [Attachments: ${m.attachments.map((a) => `${a.fileName} (${a.mimeType})`).join(', ')}]`
        : '';
      return `[Message ID: ${m.id} | Sender: ${m.senderName || m.senderId} | Time: ${m.createdAt}]
"${m.body}"${atts}`;
    })
    .join('\n\n');

  const previousContext = context.previousConfirmedContext && context.previousConfirmedContext.length > 0
    ? `\nPREVIOUSLY CONFIRMED INTENTS:\n` +
      context.previousConfirmedContext.map((c) => `- ${c.title}: ${c.summary}`).join('\n')
    : '';

  return `
PROJECT: "${context.projectName}"
DESCRIPTION: ${context.projectDescription || 'N/A'}
CONVERSATION TITLE: "${context.conversationTitle}"
${previousContext}

MESSAGES TIMELINE:
${formattedMessages}

JSON OUTPUT REQUIREMENTS:
{
  "title": "<Concise intent title>",
  "summary": "<1-2 sentence summary of overall requested outcome>",
  "requirements": [
    {
      "text": "<Specific actionable requirement>",
      "confidence": 0.90,
      "messageId": "<source Message ID>"
    }
  ],
  "missingInformation": [
    {
      "question": "<Clarifying question for developer to review>"
    }
  ],
  "references": [
    {
      "messageId": "<Message ID>",
      "excerpt": "<Short relevant quotation or context>"
    }
  ],
  "confidence": 0.88
}
`;
}
