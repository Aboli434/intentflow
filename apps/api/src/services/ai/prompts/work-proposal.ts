import { AIProviderContext } from '../providers/ai-provider.interface.js';

export const SYSTEM_PROMPT_WORK_PROPOSAL = `
You are the IntentFlow Technical Execution Engine.
Your task is to take CONFIRMED CLIENT INTENT & REQUIREMENTS and convert them into a structured WORK PROPOSAL containing specific, actionable development work items.

RULES:
1. Do NOT act as a chatbot. Return ONLY a JSON object conforming to the required schema.
2. Every suggested work item MUST map to a source requirement ID from the confirmed intent whenever possible.
3. Keep work items focused, actionable, and practical for developers.
4. Assign estimated effort ('small', 'medium', 'large') and priority ('low', 'medium', 'high', 'urgent').
5. Do NOT invent unrelated tasks outside the confirmed intent requirements.
`;

export function buildWorkProposalPrompt(
  context: AIProviderContext,
  intent: { title: string; summary: string; requirements: Array<{ id: string; text: string }> }
): string {
  const reqsFormatted = intent.requirements
    .map((r) => `[Requirement ID: ${r.id}] "${r.text}"`)
    .join('\n');

  return `
PROJECT: "${context.projectName}"
CONFIRMED INTENT TITLE: "${intent.title}"
SUMMARY: "${intent.summary}"

CONFIRMED REQUIREMENTS:
${reqsFormatted}

OUTPUT JSON FORMAT:
{
  "items": [
    {
      "title": "<Specific actionable work item title>",
      "description": "<Technical implementation detail or task description>",
      "priority": "high",
      "estimatedEffort": "small",
      "sourceRequirementId": "<Requirement ID>",
      "suggestedRole": "developer"
    }
  ]
}
`;
}
