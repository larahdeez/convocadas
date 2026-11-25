// Minimal client for the Google Gemini API (free tier), using the built-in fetch.
// No SDK needed: one POST to generateContent asking for a JSON answer.

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-flash-latest';

class AiError extends Error {}

function createGeminiClient({ apiKey, model = DEFAULT_MODEL, fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  return {
    configured: Boolean(apiKey),
    model,

    /**
     * Sends a prompt and returns the model's answer parsed as JSON.
     * @param {string} prompt
     * @param {object} schema  Gemini response schema (OpenAPI subset)
     */
    async generateJson(prompt, schema) {
      if (!apiKey) throw new AiError('AI is not configured');

      let res;
      try {
        res = await fetchImpl(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: schema,
            },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        throw new AiError(`Could not reach the AI service (${err.name})`);
      }

      if (res.status === 429) throw new AiError('The free AI quota is used up for now. Try again in a minute.');
      if (!res.ok) throw new AiError(`The AI service returned an error (${res.status})`);

      const data = await res.json().catch(() => null);
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
      if (!text) throw new AiError('The AI service returned an empty answer');
      try {
        return JSON.parse(text);
      } catch {
        throw new AiError('The AI service returned an answer that is not valid JSON');
      }
    },
  };
}

module.exports = { createGeminiClient, AiError, DEFAULT_MODEL };
