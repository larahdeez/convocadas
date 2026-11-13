// US-03 · View the squad (coming, not coming and no answer yet)
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

let app;
let match;
let training;
const players = {};

beforeEach(async () => {
  app = await startServer();
  match = (await app.request('POST', '/api/events', { type: 'match', date: '2026-11-14', time: '18:00', location: 'Sports Hall' })).body;
  training = (await app.request('POST', '/api/events', { type: 'training', date: '2026-11-13', time: '20:30', location: 'Gym' })).body;
  for (const name of ['Ana', 'Bea', 'Carla', 'Dani']) {
    players[name] = (await app.request('POST', '/api/players', { name })).body;
  }
});
afterEach(() => app.close());

const rsvp = (event, name, status) =>
  app.request('PUT', `/api/events/${event.id}/attendance`, { playerId: players[name].id, status });
const names = (list) => list.map((p) => p.name);

test('splits players into coming, not coming and no answer', async () => {
  await rsvp(match, 'Ana', 'yes');
  await rsvp(match, 'Carla', 'yes');
  await rsvp(match, 'Bea', 'no');

  const res = await app.request('GET', `/api/events/${match.id}/squad`);
  assert.equal(res.status, 200);
  assert.equal(res.body.event.id, match.id);
  assert.deepEqual(names(res.body.confirmed), ['Ana', 'Carla']);
  assert.deepEqual(names(res.body.absent), ['Bea']);
  assert.deepEqual(names(res.body.pending), ['Dani']);
  assert.deepEqual(res.body.counts, { confirmed: 2, absent: 1, pending: 1 });
});

test('with no answers, the whole roster is pending', async () => {
  const res = await app.request('GET', `/api/events/${match.id}/squad`);
  assert.deepEqual(names(res.body.pending), ['Ana', 'Bea', 'Carla', 'Dani']);
  assert.deepEqual(res.body.counts, { confirmed: 0, absent: 0, pending: 4 });
});

test('answers to one event do not affect another', async () => {
  await rsvp(match, 'Ana', 'yes');
  await rsvp(training, 'Ana', 'no');
  const m = await app.request('GET', `/api/events/${match.id}/squad`);
  const t = await app.request('GET', `/api/events/${training.id}/squad`);
  assert.deepEqual(names(m.body.confirmed), ['Ana']);
  assert.deepEqual(names(t.body.absent), ['Ana']);
});

test('reflects a player changing her mind', async () => {
  await rsvp(match, 'Ana', 'yes');
  await rsvp(match, 'Ana', 'no');
  const res = await app.request('GET', `/api/events/${match.id}/squad`);
  assert.deepEqual(names(res.body.confirmed), []);
  assert.deepEqual(names(res.body.absent), ['Ana']);
});

test('a new player appears as pending', async () => {
  await app.request('POST', '/api/players', { name: 'Elena' });
  const res = await app.request('GET', `/api/events/${match.id}/squad`);
  assert.ok(names(res.body.pending).includes('Elena'));
});

test('returns 404 if the event does not exist', async () => {
  const res = await app.request('GET', '/api/events/999/squad');
  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'Event not found');
});
