const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { HttpError, sendJson, readJson, serveStatic } = require('./http');

/**
 * Creates the HTTP server.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{ now?: () => Date }} options  `now` is injectable so tests can use a fixed clock.
 */
function createApp(db, { now = () => new Date() } = {}) {
  const routes = [];
  const router = {
    add(method, pattern, handler) {
      routes.push({ method, pattern, handler });
    },
  };

  router.add('GET', /^\/api\/health$/, () => ({ status: 200, body: { status: 'ok' } }));

  // Each file in src/routes registers the endpoints of one user story.
  const routesDir = path.join(__dirname, 'routes');
  for (const file of fs.readdirSync(routesDir).filter((f) => f.endsWith('.js')).sort()) {
    require(path.join(routesDir, file))(router, db, { now });
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) {
        const route = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));
        if (!route) throw new HttpError(404, 'Route not found');
        const params = url.pathname.match(route.pattern).slice(1);
        const body = ['POST', 'PUT'].includes(req.method) ? await readJson(req) : undefined;
        const result = await route.handler({ params, body, query: url.searchParams });
        return sendJson(res, result.status, result.body);
      }
      if (req.method !== 'GET') throw new HttpError(404, 'Not found');
      return serveStatic(res, url.pathname);
    } catch (err) {
      if (err instanceof HttpError) {
        return sendJson(res, err.status, { error: err.message, ...(err.details && { details: err.details }) });
      }
      console.error(err);
      return sendJson(res, 500, { error: 'Internal server error' });
    }
  });
}

module.exports = { createApp };
