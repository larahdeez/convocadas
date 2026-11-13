// US-03 · As a coach, I want to see who is confirmed, absent and pending for each event,
// so that I can prepare the squad without asking one by one.
const { HttpError } = require('../http');

module.exports = (router, db) => {
  const eventById = db.prepare('SELECT id, type, date, time, location FROM events WHERE id = ?');
  const roster = db.prepare(
    `SELECT p.id, p.name, a.status
     FROM players p
     LEFT JOIN attendance a ON a.player_id = p.id AND a.event_id = ?
     ORDER BY p.name COLLATE NOCASE`
  );

  router.add('GET', /^\/api\/events\/(\d+)\/squad$/, ({ params }) => {
    const event = eventById.get(Number(params[0]));
    if (!event) throw new HttpError(404, 'Event not found');

    const confirmed = [];
    const absent = [];
    const pending = [];
    for (const { id, name, status } of roster.all(event.id)) {
      const player = { id, name };
      if (status === 'yes') confirmed.push(player);
      else if (status === 'no') absent.push(player);
      else pending.push(player);
    }

    return {
      status: 200,
      body: {
        event,
        confirmed,
        absent,
        pending,
        counts: { confirmed: confirmed.length, absent: absent.length, pending: pending.length },
      },
    };
  });
};
