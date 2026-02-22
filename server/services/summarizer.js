import Anthropic from '@anthropic-ai/sdk';

let anthropic = null;

function getClient() {
  if (!anthropic) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropic;
}

const EXTRACT_PROMPT = `You are a transcript analyzer for a voice-to-code assistant. You receive a running transcript of someone describing what they want to build or do with code.

Analyze the FULL transcript and extract:
1. **Features**: Distinct features or components the user wants built
2. **TODOs**: Specific actionable tasks for a coding AI assistant (Claude Code)

Each TODO should be a self-contained, actionable instruction that Claude Code can execute independently.

Respond in this exact JSON format:
{
  "features": [
    {"id": "f1", "name": "Feature name", "description": "Brief description"}
  ],
  "todos": [
    {"id": "t1", "text": "Specific actionable instruction for Claude Code", "feature": "f1"}
  ],
  "summary": "One paragraph summary of what the user wants to build"
}

Rules:
- Each TODO should be a clear, complete instruction (not just a phrase)
- Group TODOs by feature when possible
- If the transcript is unclear or too short, return empty arrays
- Update/merge with any previously extracted items — don't duplicate
- Remove items that the user has retracted or changed their mind about`;

/**
 * Extract features and TODOs from the accumulated transcript.
 * @param {string} fullTranscript - The complete accumulated transcript
 * @param {object|null} previousExtraction - Previous extraction to merge with
 * @returns {Promise<{features: Array, todos: Array, summary: string}>}
 */
export async function extractFeaturesAndTodos(fullTranscript, previousExtraction = null) {
  if (!fullTranscript || fullTranscript.trim().length < 10) {
    return { features: [], todos: [], summary: '' };
  }

  try {
    const client = getClient();

    let userMessage = `Full transcript so far:\n\n"${fullTranscript}"`;
    if (previousExtraction && (previousExtraction.features?.length || previousExtraction.todos?.length)) {
      userMessage += `\n\nPreviously extracted items (update/merge with these):\n${JSON.stringify(previousExtraction, null, 2)}`;
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2048,
      system: EXTRACT_PROMPT,
      messages: [
        { role: 'user', content: userMessage },
      ],
    });

    const text = response.content[0]?.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return previousExtraction || { features: [], todos: [], summary: '' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      features: Array.isArray(parsed.features) ? parsed.features : [],
      todos: Array.isArray(parsed.todos) ? parsed.todos : [],
      summary: parsed.summary || '',
    };
  } catch (err) {
    console.error('Extraction error:', err.message);
    return previousExtraction || { features: [], todos: [], summary: '' };
  }
}
