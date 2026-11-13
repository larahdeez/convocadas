// US-02 · Confirm attendance (and team roster)
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

let app;
let event;
let ana;

beforeEach(async () => {
  app = await startServer();
  event = (await app.request('POST', '/api/events', {
    type: 'match', date: '2026-11-14', time: '18:00', location: 'Sports Hall',
  })).body;
  ana = (await app.request('POST', '/api/players', { name: 'Ana' })).body;
});
afterEach(() => app.close());

// --- Roster ---

test('adds players and lists them alphabetically', async () => {
  await app.request('POST', '/api/players', { name: 'carla' });
  await app.request('POST', '/api/players', { name: 'Bea' });
  const res = await app.request('GET', '/api/players');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((p) => p.name), ['Ana', 'Bea', 'carla']);
});

test('normalises spaces in the name', async () => {
  const res = await app.request('POST', '/api/players', { name: '  María   José ' });
  assert.equal(res.status, 201);
  assert.equal(res.body.name, 'María José');
});

test('rejects duplicate names, ignoring case', async () => {
  const res = await app.request('POST', '/api/players', { name: 'ANA' });
  assert.equal(res.status, 409);
});

test('rejects an empty or too long name', async () => {
  assert.equal((await app.request('POST', '/api/players', { name: '   ' })).status, 400);
  assert.equal((await app.request('POST', '/api/players', { name: 'x'.repeat(41) })).status, 400);
});

// --- Confirm attendance ---

test('a player confirms she is coming', async () => {
  const res = await app.request('PUT', `/api/events/${event.id}/attendance`, { playerId: ana.id, status: 'yes' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { eventId: event.id, playerId: ana.id, status: 'yes' });
  const mine = await app.request('GET', `/api/players/${ana.id}/attendance`);
  assert.deepEqual(mine.body, { [event.id]: 'yes' });
});

test('a player can change her mind', async () => {
  await app.request('PUT', `/api/events/${event.id}/attendance`, { playerId: ana.id, status: 'yes' });
  await app.request('PUT', `/api/events/${event.id}/attendance`, { playerId: ana.id, status: 'no' });
  const mine = await app.request('GET', `/api/players/${ana.id}/attendance`);
  assert.deepEqual(mine.body, { [event.id]: 'no' });
  const rows = app.db.prepare('SELECT COUNT(*) AS n FROM attendance').get();
  assert.equal(rows.n, 1);
});

test('a player with no answers gets an empty map', async () => {
  const res = await app.request('GET', `/api/players/${ana.id}/attendance`);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, {});
});

test('rejects a status other than yes/no', async () => {
  const res = await app.request('PUT', `/api/events/${event.id}/attendance`, { playerId: ana.id, status: 'maybe' });
  assert.equal(res.status, 400);
  assert.ok(res.body.details.status);
});

test('rejects answers without a player or with an unknown one', async () => {
  const missing = await app.request('PUT', `/api/events/${event.id}/attendance`, { status: 'yes' });
  assert.equal(missing.status, 400);
  const unknown = await app.request('PUT', `/api/events/${event.id}/attendance`, { playerId: 999, status: 'yes' });
  assert.equal(unknown.status, 400);
  const asText = await app.request('PUT', `/api/events/${event.id}/attendance`, { playerId: String(ana.id), status: 'yes' });
  assert.equal(asText.status, 400);
});

test('returns 404 if the event does not exist', async () => {
  const res = await app.request('PUT', '/api/events/999/attendance', { playerId: ana.id, status: 'yes' });
  assert.equal(res.status, 404);
});

test('returns 404 for the answers of an unknown player', async () => {
  const res = await app.request('GET', '/api/players/999/attendance');
  assert.equal(res.status, 404);
});

test('cannot answer an event that has already taken place', async () => {
  const { lastInsertRowid } = app.db
    .prepare("INSERT INTO events (type, date, time, location) VALUES ('training', '2026-11-01', '20:00', 'Old')")
    .run();
  const res = await app.request('PUT', `/api/events/${lastInsertRowid}/attendance`, { playerId: ana.id, status: 'yes' });
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'This event has already taken place');
});
