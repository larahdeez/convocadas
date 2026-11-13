// US-02 (support) · Team roster, so each player can pick her name before confirming.
// There is no login in the MVP: a player identifies herself by choosing her name.
const { HttpError } = require('../http');

const MAX_NAME = 40;

module.exports = (router, db) => {
  const all = db.prepare('SELECT id, name FROM players ORDER BY name COLLATE NOCASE');
  const byId = db.prepare('SELECT id, name FROM players WHERE id = ?');
  const insert = db.prepare('INSERT INTO players (name) VALUES (?)');
  const statuses = db.prepare('SELECT event_id, status FROM attendance WHERE player_id = ?');

  router.add('GET', /^\/api\/players$/, () => ({ status: 200, body: all.all() }));

  router.add('POST', /^\/api\/players$/, ({ body }) => {
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    if (!name) throw new HttpError(400, 'Name is required', { name: 'Name is required' });
    if (name.length > MAX_NAME) {
      throw new HttpError(400, 'Name is too long', { name: `Maximum ${MAX_NAME} characters` });
    }
    try {
      const { lastInsertRowid } = insert.run(name);
      return { status: 201, body: byId.get(lastInsertRowid) };
    } catch (err) {
      if (/UNIQUE/.test(err.message)) {
        throw new HttpError(409, 'There is already a player with that name', { name: 'There is already a player with that name' });
      }
      throw err;
    }
  });

  // Statuses of one player for every event: { "<eventId>": "yes" | "no" }
  router.add('GET', /^\/api\/players\/(\d+)\/attendance$/, ({ params }) => {
    const id = Number(params[0]);
    if (!byId.get(id)) throw new HttpError(404, 'Player not found');
    const map = {};
    for (const row of statuses.all(id)) map[row.event_id] = row.status;
    return { status: 200, body: map };
  });
};
