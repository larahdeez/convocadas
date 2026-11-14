const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helpers');

let app;
before(async () => { app = await startServer(); });
after(() => app.close());

test('GET /api/health returns ok', async () => {
  const res = await app.request('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('an unknown API route returns a JSON 404', async () => {
  const res = await app.request('GET', '/api/does-not-exist');
  assert.equal(res.status, 404);
  assert.equal(res.body.error, 'Route not found');
});

test('serves the home page', async () => {
  const res = await app.request('GET', '/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(res.text, /Convocadas/);
});

test('does not allow escaping the public folder', async () => {
  const res = await app.request('GET', '/..%2F..%2Fpackage.json');
  assert.equal(res.status, 404);
});
