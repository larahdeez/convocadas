const { openDb } = require('../src/db');
const { createApp } = require('../src/app');

// Fixed clock for every test: Wednesday 12 November 2026, 10:00 local time.
const FIXED_NOW = new Date(2026, 10, 12, 10, 0, 0);

async function startServer({ now = () => FIXED_NOW } = {}) {
  const db = openDb(':memory:');
  const server = createApp(db, { now });
  await new Promise((resolve) => server.listen(0, resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(method, path, body) {
    const res = await fetch(base + path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: res.status, body: json, text, headers: res.headers };
  }

  return {
    db,
    request,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

module.exports = { startServer, FIXED_NOW };
