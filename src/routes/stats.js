// US-05 · As a coach, I want to see attendance statistics per player,
// so that I know how committed the team is.
const { HttpError } = require('../http');

const EVENT_TYPES = ['training', 'match'];

module.exports = (router, db) => {
  const countEvents = db.prepare('SELECT COUNT(*) AS n FROM events WHERE (?1 IS NULL OR type = ?1)');
  // Correlated subqueries so that players with no answers (for this type) are still listed.
  const perPlayer = db.prepare(
    `SELECT p.id, p.name,
       (SELECT COUNT(*) FROM attendance a JOIN events e ON e.id = a.event_id
        WHERE a.player_id = p.id AND a.status = 'yes' AND (?1 IS NULL OR e.type = ?1)) AS coming,
       (SELECT COUNT(*) FROM attendance a JOIN events e ON e.id = a.event_id
        WHERE a.player_id = p.id AND a.status = 'no' AND (?1 IS NULL OR e.type = ?1)) AS notComing
     FROM players p`
  );

  router.add('GET', /^\/api\/stats$/, ({ query }) => {
    const type = query.get('type') || null;
    if (type !== null && !EVENT_TYPES.includes(type)) {
      throw new HttpError(400, 'Type must be "training" or "match"', { type: 'Invalid type' });
    }

    const totalEvents = countEvents.get(type).n;
    const players = perPlayer
      .all(type)
      .map((p) => {
        const noAnswer = totalEvents - p.coming - p.notComing;
        const rate = totalEvents === 0 ? 0 : Math.round((p.coming / totalEvents) * 100);
        return { id: p.id, name: p.name, coming: p.coming, notComing: p.notComing, noAnswer, rate };
      })
      .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const teamRate = players.length === 0 ? 0 : Math.round(players.reduce((sum, p) => sum + p.rate, 0) / players.length);

    return { status: 200, body: { type, totalEvents, teamRate, players } };
  });
};
