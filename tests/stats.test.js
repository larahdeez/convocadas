// US-05 · Attendance statistics
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

let app;
const players = {};
const events = {};

beforeEach(async () => {
  app = await startServer();
  events.match1 = (await app.request('POST', '/api/events', { type: 'match', date: '2026-11-14', time: '18:00', location: 'Sports Hall' })).body;
  events.match2 = (await app.request('POST', '/api/events', { type: 'match', date: '2026-11-21', time: '18:00', location: 'Sports Hall' })).body;
  events.training = (await app.request('POST', '/api/events', { type: 'training', date: '2026-11-13', time: '20:30', location: 'Gym' })).body;
  for (const name of ['Ana', 'Bea', 'Carla', 'Dani']) {
    players[name] = (await app.request('POST', '/api/players', { name })).body;
  }
});
afterEach(() => app.close());

const rsvp = (event, name, status) =>
  app.request('PUT', `/api/events/${events[event].id}/attendance`, { playerId: players[name].id, status });
const byName = (list) => Object.fromEntries(list.map((p) => [p.name, p]));

test('counts coming, not coming and no answer per player', async () => {
  await rsvp('match1', 'Ana', 'yes');
  await rsvp('match2', 'Ana', 'yes');
  await rsvp('training', 'Ana', 'no');
  await rsvp('match1', 'Bea', 'no');

  const res = await app.request('GET', '/api/stats');
  assert.equal(res.status, 200);
  assert.equal(res.body.totalEvents, 3);
  const stats = byName(res.body.players);
  assert.deepEqual(
    { coming: stats.Ana.coming, notComing: stats.Ana.notComing, noAnswer: stats.Ana.noAnswer },
    { coming: 2, notComing: 1, noAnswer: 0 },
  );
  assert.deepEqual(
    { coming: stats.Bea.coming, notComing: stats.Bea.notComing, noAnswer: stats.Bea.noAnswer },
    { coming: 0, notComing: 1, noAnswer: 2 },
  );
});

test('calculates the attendance rate as a rounded percentage of all events', async () => {
  await rsvp('match1', 'Ana', 'yes');
  await rsvp('match2', 'Ana', 'yes');
  await rsvp('match1', 'Carla', 'yes');
  const stats = byName((await app.request('GET', '/api/stats')).body.players);
  assert.equal(stats.Ana.rate, 67);
  assert.equal(stats.Carla.rate, 33);
  assert.equal(stats.Dani.rate, 0);
});

test('sorts players by attendance rate, then alphabetically', async () => {
  await rsvp('match1', 'Dani', 'yes');
  await rsvp('match2', 'Dani', 'yes');
  await rsvp('match1', 'Carla', 'yes');
  await rsvp('match1', 'Bea', 'yes');
  const res = await app.request('GET', '/api/stats');
  assert.deepEqual(res.body.players.map((p) => p.name), ['Dani', 'Bea', 'Carla', 'Ana']);
});

test('calculates the team average rate', async () => {
  await rsvp('match1', 'Ana', 'yes');
  await rsvp('match2', 'Ana', 'yes');
  await rsvp('training', 'Ana', 'yes');
  await rsvp('match1', 'Bea', 'yes');
  // Rates: Ana 100, Bea 33, Carla 0, Dani 0 → average 33
  const res = await app.request('GET', '/api/stats');
  assert.equal(res.body.teamRate, 33);
});

test('filters statistics by event type', async () => {
  await rsvp('match1', 'Ana', 'yes');
  await rsvp('training', 'Ana', 'no');
  await rsvp('training', 'Bea', 'yes');

  const matches = await app.request('GET', '/api/stats?type=match');
  assert.equal(matches.status, 200);
  assert.equal(matches.body.type, 'match');
  assert.equal(matches.body.totalEvents, 2);
  const m = byName(matches.body.players);
  assert.deepEqual([m.Ana.coming, m.Ana.notComing, m.Ana.noAnswer, m.Ana.rate], [1, 0, 1, 50]);
  assert.deepEqual([m.Bea.coming, m.Bea.notComing, m.Bea.noAnswer, m.Bea.rate], [0, 0, 2, 0]);

  const trainings = await app.request('GET', '/api/stats?type=training');
  const t = byName(trainings.body.players);
  assert.equal(trainings.body.totalEvents, 1);
  assert.deepEqual([t.Ana.notComing, t.Ana.rate], [1, 0]);
  assert.deepEqual([t.Bea.coming, t.Bea.rate], [1, 100]);
});

test('reflects a player changing her mind', async () => {
  await rsvp('match1', 'Ana', 'yes');
  await rsvp('match1', 'Ana', 'no');
  const stats = byName((await app.request('GET', '/api/stats')).body.players);
  assert.equal(stats.Ana.coming, 0);
  assert.equal(stats.Ana.notComing, 1);
});

test('returns zero rates when there are no events', async () => {
  const empty = await startServer();
  try {
    await empty.request('POST', '/api/players', { name: 'Ana' });
    const res = await empty.request('GET', '/api/stats');
    assert.equal(res.status, 200);
    assert.equal(res.body.totalEvents, 0);
    assert.equal(res.body.teamRate, 0);
    assert.deepEqual(res.body.players, [{ id: 1, name: 'Ana', coming: 0, notComing: 0, noAnswer: 0, rate: 0 }]);
  } finally {
    await empty.close();
  }
});

test('returns an empty list when there are no players', async () => {
  const empty = await startServer();
  try {
    const res = await empty.request('GET', '/api/stats');
    assert.deepEqual(res.body.players, []);
    assert.equal(res.body.teamRate, 0);
  } finally {
    await empty.close();
  }
});

test('rejects an unknown event type', async () => {
  const res = await app.request('GET', '/api/stats?type=party');
  assert.equal(res.status, 400);
  assert.ok(res.body.details.type);
});
