// Minimal client for the Google Gemini API (free tier), using the built-in fetch.
// No SDK needed: one POST to generateContent asking for a JSON answer.

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-flash-lite-latest';

class AiError extends Error {}

const RETRY_STATUSES = new Set([500, 503]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createGeminiClient({ apiKey, model = DEFAULT_MODEL, fetchImpl = fetch, timeoutMs = 20_000, retries = 2, retryDelayMs = 1500 } = {}) {
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

      const request = () => fetchImpl(`${API_BASE}/${encodeURIComponent(model)}:generateContent`, {
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

      // Google sometimes answers 503 ("model overloaded") on the free tier: wait and try again.
      let res;
      for (let attempt = 0; ; attempt++) {
        try {
          res = await request();
        } catch (err) {
          throw new AiError(`Could not reach the AI service (${err.name})`);
        }
        if (!RETRY_STATUSES.has(res.status) || attempt >= retries) break;
        await sleep(retryDelayMs * (attempt + 1));
      }

      if (RETRY_STATUSES.has(res.status)) {
        throw new AiError(`The AI model is busy right now (Google returned ${res.status}). Try again in a minute.`);
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
