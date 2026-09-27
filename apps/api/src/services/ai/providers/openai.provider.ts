import { AIProvider, AIProviderContext } from './ai-provider.interface.js';
import { aiStructuredOutputSchema, AiStructuredOutputValidation } from '@intentflow/validation';
import { SYSTEM_PROMPT_INTENT_ANALYSIS, buildIntentAnalysisPrompt } from '../prompts/intent-analysis.js';

export class DefaultAIProvider implements AIProvider {
  public name = 'DefaultAIProvider';
  public model = 'gpt-4o-mini';

  async analyzeIntent(context: AIProviderContext): Promise<AiStructuredOutputValidation> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey) {
      try {
        const prompt = buildIntentAnalysisPrompt(context);
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT_INTENT_ANALYSIS },
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
            const parsed = JSON.parse(jsonText);
            const validated = aiStructuredOutputSchema.parse(parsed);
            return validated;
          }
        }
      } catch (err) {
        console.warn('[AIProvider] OpenAI API call failed or schema invalid, falling back to local analyzer engine:', err);
      }
    }

    // Fallback Heuristic Analysis Engine when API key is not configured or network call fails
    return this.fallbackAnalysis(context);
  }

  private fallbackAnalysis(context: AIProviderContext): AiStructuredOutputValidation {
    const messages = context.messages;
    if (!messages || messages.length === 0) {
      return {
        title: 'General Project Communication',
        summary: 'No message history available for analysis.',
        requirements: [],
        missingInformation: [],
        references: [],
        confidence: 0.5,
      };
    }

    // Combine recent message text
    const fullText = messages.map((m) => m.body).join('\n');
    const lastMessage = messages[messages.length - 1];

    // Determine title & summary
    let title = context.conversationTitle || 'Client Feedback & Request';
    let summary = `Client communicated details regarding ${context.projectName}.`;

    const requirements: Array<{ text: string; confidence: number; messageId?: string | null }> = [];
    const missingInformation: Array<{ question: string }> = [];
    const references: Array<{ messageId: string; attachmentId?: string | null; excerpt?: string | null }> = [];

    // Analyze messages for specific requests
    for (const msg of messages) {
      const lower = msg.body.toLowerCase();
      
      // Look for visual / design requests
      if (lower.includes('hero') || lower.includes('homepage') || lower.includes('visual') || lower.includes('image')) {
        title = 'Homepage visual refinement';
        summary = 'Improve the visual quality and assets of the homepage hero section.';
        
        if (lower.includes('hero visual') || lower.includes('looks a bit plain') || lower.includes('hero')) {
          requirements.push({
            text: 'Improve the homepage hero visual experience',
            confidence: 0.92,
            messageId: msg.id,
          });
        }
        if (lower.includes('second image') || lower.includes('image i sent') || lower.includes('preferred hero asset')) {
          const attachment = msg.attachments?.[0];
          requirements.push({
            text: 'Consider using the second supplied image as hero asset',
            confidence: 0.88,
            messageId: msg.id,
          });
          references.push({
            messageId: msg.id,
            attachmentId: attachment?.id || null,
            excerpt: msg.body.substring(0, 100),
          });
        }
      }

      // Look for animation / speed requests
      if (lower.includes('animation') || lower.includes('fast') || lower.includes('slow') || lower.includes('smooth')) {
        requirements.push({
          text: 'Review and adjust animation speed and smoothness',
          confidence: 0.85,
          messageId: msg.id,
        });
        if (!references.some((r) => r.messageId === msg.id)) {
          references.push({
            messageId: msg.id,
            excerpt: msg.body.substring(0, 100),
          });
        }
      }

      // Detect subjective/ambiguous words like "premium", "faster", "better" for Missing Information
      if (lower.includes('premium') || lower.includes('fancy') || lower.includes('nice')) {
        missingInformation.push({
          question: 'What specific design elements or style guidelines define "premium" to the client?',
        });
      }
      if (lower.includes('faster') && !lower.includes('animation')) {
        missingInformation.push({
          question: 'What specific performance metric or page section needs speed optimization?',
        });
      }
    }

    // Default fallback requirement if none extracted specifically
    if (requirements.length === 0) {
      requirements.push({
        text: `Review client feedback: "${lastMessage.body.substring(0, 80)}"`,
        confidence: 0.75,
        messageId: lastMessage.id,
      });
      references.push({
        messageId: lastMessage.id,
        excerpt: lastMessage.body,
      });
    }

    return {
      title,
      summary,
      requirements,
      missingInformation,
      references,
      confidence: 0.87,
    };
  }
}
