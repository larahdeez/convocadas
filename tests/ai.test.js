// Gemini client (used by US-06), tested with a fake fetch: no real network calls.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createGeminiClient, AiError } = require('../src/ai');

const geminiReply = (obj) => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }),
});

test('is not configured without an API key', async () => {
  const ai = createGeminiClient({ apiKey: '' });
  assert.equal(ai.configured, false);
  await assert.rejects(() => ai.generateJson('hi', {}), AiError);
});

test('sends the prompt, schema and key to the Gemini API and parses the JSON answer', async () => {
  let call;
  const ai = createGeminiClient({
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl: async (url, options) => {
      call = { url, options };
      return geminiReply({ squad: ['Ana'] });
    },
  });
  const schema = { type: 'OBJECT' };
  const result = await ai.generateJson('Pick a squad', schema);

  assert.deepEqual(result, { squad: ['Ana'] });
  assert.equal(call.url, 'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent');
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.headers['x-goog-api-key'], 'test-key');
  const body = JSON.parse(call.options.body);
  assert.equal(body.contents[0].parts[0].text, 'Pick a squad');
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(body.generationConfig.responseSchema, schema);
});

test('the API key never goes in the URL', async () => {
  let url;
  const ai = createGeminiClient({ apiKey: 'secret-key', fetchImpl: async (u) => { url = u; return geminiReply({}); } });
  await ai.generateJson('x', {});
  assert.ok(!url.includes('secret-key'));
});

test('explains when the free quota is used up (429)', async () => {
  const ai = createGeminiClient({ apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 429, json: async () => ({}) }) });
  await assert.rejects(() => ai.generateJson('x', {}), /quota/);
});

test('reports other API errors', async () => {
  const ai = createGeminiClient({ apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({}) }) });
  await assert.rejects(() => ai.generateJson('x', {}), /\(400\)/);
});

test('reports network failures', async () => {
  const ai = createGeminiClient({ apiKey: 'k', fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  await assert.rejects(() => ai.generateJson('x', {}), /Could not reach/);
});

test('rejects empty or non-JSON answers', async () => {
  const empty = createGeminiClient({ apiKey: 'k', fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ candidates: [] }) }) });
  await assert.rejects(() => empty.generateJson('x', {}), /empty/);
  const notJson = createGeminiClient({
    apiKey: 'k',
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'hello' }] } }] }) }),
  });
  await assert.rejects(() => notJson.generateJson('x', {}), /not valid JSON/);
});
