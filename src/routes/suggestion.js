// US-06 · As a coach, I want AI to suggest the squad for an event based on the answers and
// attendance history, so that I can decide faster.
const { HttpError } = require('../http');
const { AiError } = require('../ai');

const DEFAULT_SQUAD_SIZE = 12;
const MIN_SQUAD_SIZE = 5;
const MAX_SQUAD_SIZE = 14;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    squad: {
      type: 'ARRAY',
      description: 'Names of the suggested players, most recommended first',
      items: { type: 'STRING' },
    },
    reasoning: { type: 'STRING', description: 'Two or three short sentences explaining the choice' },
    followUp: {
      type: 'ARRAY',
      description: 'Names of players who have not answered and are worth contacting',
      items: { type: 'STRING' },
    },
  },
  required: ['squad', 'reasoning', 'followUp'],
};

const TYPE_LABEL = { training: 'training session', match: 'match' };

function buildPrompt(event, players, squadSize) {
  const lines = players.map(
    (p) => `- ${p.name}: answer for this event = ${p.answer}; attendance rate = ${p.rate}% (coming to ${p.coming} of ${p.total} events)`
  );
  return [
    'You help the coach of an amateur futsal team pick the squad.',
    `Event: ${TYPE_LABEL[event.type]} on ${event.date} at ${event.time}, location: ${event.location}.`,
    `Suggest a squad of at most ${squadSize} players for this event.`,
    'Rules:',
    '- Only include players whose answer is "coming".',
    '- If there are more players coming than places, prefer the ones with the higher attendance rate.',
    '- In followUp, list players with answer "no answer yet" who are worth contacting, highest attendance rate first.',
    '- Use the player names exactly as written below. Do not invent players.',
    '- Write the reasoning in English, in two or three short sentences addressed to the coach.',
    'Players:',
    ...lines,
  ].join('\n');
}

module.exports = (router, db, { ai }) => {
  const eventById = db.prepare('SELECT id, type, date, time, location FROM events WHERE id = ?');
  const totalEvents = db.prepare('SELECT COUNT(*) AS n FROM events');
  const roster = db.prepare(
    `SELECT p.id, p.name,
       (SELECT status FROM attendance WHERE player_id = p.id AND event_id = ?1) AS status,
       (SELECT COUNT(*) FROM attendance WHERE player_id = p.id AND status = 'yes') AS coming
     FROM players p
     ORDER BY p.name COLLATE NOCASE`
  );

  router.add('POST', /^\/api\/events\/(\d+)\/suggestion$/, async ({ params, body }) => {
    const event = eventById.get(Number(params[0]));
    if (!event) throw new HttpError(404, 'Event not found');

    const squadSize = body.squadSize === undefined ? DEFAULT_SQUAD_SIZE : body.squadSize;
    if (!Number.isInteger(squadSize) || squadSize < MIN_SQUAD_SIZE || squadSize > MAX_SQUAD_SIZE) {
      throw new HttpError(400, `Squad size must be between ${MIN_SQUAD_SIZE} and ${MAX_SQUAD_SIZE}`, { squadSize: 'Invalid squad size' });
    }

    if (!ai || !ai.configured) {
      throw new HttpError(503, 'AI suggestions are not set up on this server (missing GEMINI_API_KEY)');
    }

    const total = totalEvents.get().n;
    const players = roster.all(event.id).map((p) => ({
      name: p.name,
      answer: p.status === 'yes' ? 'coming' : p.status === 'no' ? 'not coming' : 'no answer yet',
      coming: p.coming,
      total,
      rate: total === 0 ? 0 : Math.round((p.coming / total) * 100),
    }));
    const comingNames = players.filter((p) => p.answer === 'coming').map((p) => p.name);
    const pendingNames = players.filter((p) => p.answer === 'no answer yet').map((p) => p.name);

    if (comingNames.length === 0) {
      throw new HttpError(409, 'Nobody has confirmed yet, so there is no squad to suggest');
    }

    let answer;
    try {
      answer = await ai.generateJson(buildPrompt(event, players, squadSize), RESPONSE_SCHEMA);
    } catch (err) {
      if (err instanceof AiError) throw new HttpError(502, err.message);
      throw err;
    }

    // Never trust the model blindly: keep only real players, in the right group, without duplicates.
    const pick = (list, allowed, limit) => {
      const byLower = new Map(allowed.map((n) => [n.toLowerCase(), n]));
      const out = [];
      for (const raw of Array.isArray(list) ? list : []) {
        const name = typeof raw === 'string' ? byLower.get(raw.trim().toLowerCase()) : undefined;
        if (name && !out.includes(name)) out.push(name);
        if (out.length === limit) break;
      }
      return out;
    };

    const squad = pick(answer?.squad, comingNames, squadSize);
    if (squad.length === 0) throw new HttpError(502, 'The AI did not return a usable squad. Try again.');

    return {
      status: 200,
      body: {
        eventId: event.id,
        squad,
        followUp: pick(answer?.followUp, pendingNames, pendingNames.length),
        reasoning: typeof answer?.reasoning === 'string' ? answer.reasoning.trim().slice(0, 600) : '',
        model: ai.model,
      },
    };
  });
};

module.exports.buildPrompt = buildPrompt;
