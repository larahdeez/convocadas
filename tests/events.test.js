// US-01 · Create event
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

let app;
beforeEach(async () => { app = await startServer(); });
afterEach(() => app.close());

const valid = { type: 'match', date: '2026-11-14', time: '18:00', location: 'La Albericia Sports Hall' };

test('creates a valid match and returns it with an id', async () => {
  const res = await app.request('POST', '/api/events', valid);
  assert.equal(res.status, 201);
  assert.ok(Number.isInteger(res.body.id));
  assert.deepEqual({ ...res.body, id: undefined }, { ...valid, id: undefined });
});

test('creates a training session and trims extra spaces', async () => {
  const res = await app.request('POST', '/api/events', {
    type: 'training', date: ' 2026-11-13 ', time: '20:30', location: '  Sports Centre  ',
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.type, 'training');
  assert.equal(res.body.date, '2026-11-13');
  assert.equal(res.body.location, 'Sports Centre');
});

test('lists upcoming events sorted by date and time', async () => {
  await app.request('POST', '/api/events', { ...valid, date: '2026-11-20', time: '19:00' });
  await app.request('POST', '/api/events', { ...valid, date: '2026-11-14', time: '18:00' });
  await app.request('POST', '/api/events', { ...valid, date: '2026-11-14', time: '10:30' });
  const res = await app.request('GET', '/api/events');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((e) => `${e.date} ${e.time}`), [
    '2026-11-14 10:30', '2026-11-14 18:00', '2026-11-20 19:00',
  ]);
});

test('the list is empty when there are no events', async () => {
  const res = await app.request('GET', '/api/events');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('does not list past events', async () => {
  // Inserted directly: the API itself would reject a past date.
  app.db.prepare("INSERT INTO events (type, date, time, location) VALUES ('training', '2026-11-01', '20:00', 'Old')").run();
  await app.request('POST', '/api/events', valid);
  const res = await app.request('GET', '/api/events');
  assert.deepEqual(res.body.map((e) => e.location), [valid.location]);
});

test('accepts an event today at a later time', async () => {
  const res = await app.request('POST', '/api/events', { ...valid, date: '2026-11-12', time: '10:00' });
  assert.equal(res.status, 201);
});

test('rejects an event in the past', async () => {
  const res = await app.request('POST', '/api/events', { ...valid, date: '2026-11-12', time: '09:59' });
  assert.equal(res.status, 400);
  assert.equal(res.body.details.date, 'The date cannot be in the past');
});

test('rejects an empty event and explains each error', async () => {
  const res = await app.request('POST', '/api/events', {});
  assert.equal(res.status, 400);
  assert.deepEqual(Object.keys(res.body.details).sort(), ['date', 'location', 'time', 'type']);
});

test('rejects an unknown type', async () => {
  const res = await app.request('POST', '/api/events', { ...valid, type: 'party' });
  assert.equal(res.status, 400);
  assert.ok(res.body.details.type);
});

test('rejects impossible dates and times', async () => {
  const badDate = await app.request('POST', '/api/events', { ...valid, date: '2026-02-30' });
  assert.equal(badDate.status, 400);
  assert.equal(badDate.body.details.date, 'Invalid date (YYYY-MM-DD)');
  const badTime = await app.request('POST', '/api/events', { ...valid, time: '25:00' });
  assert.equal(badTime.status, 400);
  assert.equal(badTime.body.details.time, 'Invalid time (HH:MM)');
});

test('rejects a location that is too long', async () => {
  const res = await app.request('POST', '/api/events', { ...valid, location: 'x'.repeat(121) });
  assert.equal(res.status, 400);
  assert.ok(res.body.details.location);
});

test('rejects fields that are not text', async () => {
  const res = await app.request('POST', '/api/events', { ...valid, location: 42 });
  assert.equal(res.status, 400);
  assert.ok(res.body.details.location);
});

test('rejects a body that is not JSON', async () => {
  const res = await app.request('POST', '/api/events', '{this is not json');
  assert.equal(res.status, 400);
  assert.equal(res.body.error, 'Invalid JSON');
});
