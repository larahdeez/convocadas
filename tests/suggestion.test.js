// US-06 · AI squad suggestion, tested with a fake AI client (no network, no API key).
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');
const { AiError } = require('../src/ai');

let app;
afterEach(() => app?.close());

function fakeAi(answer) {
  const ai = {
    configured: true,
    model: 'fake-model',
    calls: [],
    async generateJson(prompt, schema) {
      ai.calls.push({ prompt, schema });
      if (answer instanceof Error) throw answer;
      return typeof answer === 'function' ? answer(prompt) : answer;
    },
  };
  return ai;
}

// Match tomorrow + one training. Ana, Bea and Carla are coming, Dani is not, Eva hasn't answered.
async function setup(ai) {
  app = await startServer({ ai });
  const match = (await app.request('POST', '/api/events', { type: 'match', date: '2026-11-14', time: '18:00', location: 'Sports Hall' })).body;
  const training = (await app.request('POST', '/api/events', { type: 'training', date: '2026-11-13', time: '20:30', location: 'Gym' })).body;
  const p = {};
  for (const name of ['Ana', 'Bea', 'Carla', 'Dani', 'Eva']) p[name] = (await app.request('POST', '/api/players', { name })).body;
  const rsvp = (event, name, status) => app.request('PUT', `/api/events/${event.id}/attendance`, { playerId: p[name].id, status });
  await rsvp(match, 'Ana', 'yes');
  await rsvp(match, 'Bea', 'yes');
  await rsvp(match, 'Carla', 'yes');
  await rsvp(match, 'Dani', 'no');
  await rsvp(training, 'Ana', 'yes');
  return { match, training };
}

test('returns the squad, follow-up list and reasoning from the AI', async () => {
  const ai = fakeAi({ squad: ['Ana', 'Bea', 'Carla'], followUp: ['Eva'], reasoning: 'All three confirmed. Ana trains the most.' });
  const { match } = await setup(ai);

  const res = await app.request('POST', `/api/events/${match.id}/suggestion`, {});
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {
    eventId: match.id,
    squad: ['Ana', 'Bea', 'Carla'],
    followUp: ['Eva'],
    reasoning: 'All three confirmed. Ana trains the most.',
    model: 'fake-model',
  });
});

test('sends the event, every answer and attendance rates in the prompt', async () => {
  const ai = fakeAi({ squad: ['Ana'], followUp: [], reasoning: 'ok' });
  const { match } = await setup(ai);
  await app.request('POST', `/api/events/${match.id}/suggestion`, {});

  const { prompt, schema } = ai.calls[0];
  assert.match(prompt, /match on 2026-11-14 at 18:00, location: Sports Hall/);
  assert.match(prompt, /at most 12 players/);
  assert.match(prompt, /- Ana: answer for this event = coming; attendance rate = 100% \(coming to 2 of 2 events\)/);
  assert.match(prompt, /- Dani: answer for this event = not coming; attendance rate = 0%/);
  assert.match(prompt, /- Eva: answer for this event = no answer yet/);
  assert.deepEqual(schema.required, ['squad', 'reasoning', 'followUp']);
});

test('uses the requested squad size', async () => {
  const ai = fakeAi({ squad: ['Ana', 'Bea', 'Carla'], followUp: [], reasoning: 'ok' });
  const { match } = await setup(ai);
  const res = await app.request('POST', `/api/events/${match.id}/suggestion`, { squadSize: 5 });
  assert.equal(res.status, 200);
  assert.match(ai.calls[0].prompt, /at most 5 players/);
});

test('never returns invented players, players who are not coming or duplicates', async () => {
  const ai = fakeAi({ squad: ['Ana', 'Zoe', 'Dani', 'ana', ' Bea '], followUp: ['Carla', 'Eva', 'Nobody'], reasoning: 'ok' });
  const { match } = await setup(ai);
  const res = await app.request('POST', `/api/events/${match.id}/suggestion`, {});
  assert.deepEqual(res.body.squad, ['Ana', 'Bea']);
  assert.deepEqual(res.body.followUp, ['Eva']);
});

test('cuts the squad to the requested size', async () => {
  const ai = fakeAi({ squad: ['Ana', 'Bea', 'Carla'], followUp: [], reasoning: 'ok' });
  const { match } = await setup(ai);
  // Add three more confirmed players so 6 are coming, then ask for 5.
  for (const name of ['Fay', 'Gia', 'Hana']) {
    const p = (await app.request('POST', '/api/players', { name })).body;
    await app.request('PUT', `/api/events/${match.id}/attendance`, { playerId: p.id, status: 'yes' });
  }
  ai.generateJson = async () => ({ squad: ['Ana', 'Bea', 'Carla', 'Fay', 'Gia', 'Hana'], followUp: [], reasoning: 'ok' });
  const res = await app.request('POST', `/api/events/${match.id}/suggestion`, { squadSize: 5 });
  assert.deepEqual(res.body.squad, ['Ana', 'Bea', 'Carla', 'Fay', 'Gia']);
});

test('returns 503 with a clear message when no API key is set', async () => {
  const { match } = await setup(null);
  const res = await app.request('POST', `/api/events/${match.id}/suggestion`, {});
  assert.equal(res.status, 503);
  assert.match(res.body.error, /GEMINI_API_KEY/);
});

test('returns 409 when nobody has confirmed', async () => {
  const ai = fakeAi({ squad: [], followUp: [], reasoning: '' });
  const { training } = await setup(ai);
  // Only Ana answered for training; make her decline.
  const ana = (await app.request('GET', '/api/players')).body.find((p) => p.name === 'Ana');
  await app.request('PUT', `/api/events/${training.id}/attendance`, { playerId: ana.id, status: 'no' });
  const res = await app.request('POST', `/api/events/${training.id}/suggestion`, {});
  assert.equal(res.status, 409);
  assert.equal(ai.calls.length, 0);
});

test('returns 502 with the reason when the AI service fails', async () => {
  const { match } = await setup(fakeAi(new AiError('The free AI quota is used up for now. Try again in a minute.')));
  const res = await app.request('POST', `/api/events/${match.id}/suggestion`, {});
  assert.equal(res.status, 502);
  assert.match(res.body.error, /quota/);
});

test('returns 502 when the AI answer has no usable squad', async () => {
  const { match } = await setup(fakeAi({ squad: ['Zoe'], followUp: [], reasoning: 'ok' }));
  const res = await app.request('POST', `/api/events/${match.id}/suggestion`, {});
  assert.equal(res.status, 502);
});

test('rejects an invalid squad size', async () => {
  const { match } = await setup(fakeAi({ squad: ['Ana'], followUp: [], reasoning: 'ok' }));
  for (const squadSize of [4, 15, 'ten', 7.5]) {
    const res = await app.request('POST', `/api/events/${match.id}/suggestion`, { squadSize });
    assert.equal(res.status, 400, `squadSize ${squadSize}`);
  }
});

test('returns 404 if the event does not exist', async () => {
  await setup(fakeAi({ squad: ['Ana'], followUp: [], reasoning: 'ok' }));
  const res = await app.request('POST', '/api/events/999/suggestion', {});
  assert.equal(res.status, 404);
});
