// US-02 · As a player, I want to confirm whether I'm coming to an event,
// so that the coach can plan.
const { HttpError } = require('../http');
const { toLocalStamp } = require('./events');

const STATUSES = ['yes', 'no'];

module.exports = (router, db, { now }) => {
  const eventById = db.prepare('SELECT id, date, time FROM events WHERE id = ?');
  const playerById = db.prepare('SELECT id FROM players WHERE id = ?');
  const upsert = db.prepare(
    `INSERT INTO attendance (event_id, player_id, status) VALUES (?, ?, ?)
     ON CONFLICT (event_id, player_id) DO UPDATE SET status = excluded.status, updated_at = datetime('now')`
  );

  router.add('PUT', /^\/api\/events\/(\d+)\/attendance$/, ({ params, body }) => {
    const eventId = Number(params[0]);
    const event = eventById.get(eventId);
    if (!event) throw new HttpError(404, 'Event not found');

    const playerId = body.playerId;
    if (!Number.isInteger(playerId) || !playerById.get(playerId)) {
      throw new HttpError(400, 'Choose who you are before answering', { playerId: 'Invalid player' });
    }
    if (!STATUSES.includes(body.status)) {
      throw new HttpError(400, 'Say whether you are coming or not', { status: 'Must be "yes" or "no"' });
    }
    if (`${event.date} ${event.time}` < toLocalStamp(now())) {
      throw new HttpError(400, 'This event has already taken place');
    }

    upsert.run(eventId, playerId, body.status);
    return { status: 200, body: { eventId, playerId, status: body.status } };
  });
};
