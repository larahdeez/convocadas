// US-01 · As a coach, I want to create an event (training or match) with date, time and location,
// so that the team knows when and where to be.
const { HttpError } = require('../http');

const EVENT_TYPES = ['training', 'match'];
const MAX_LOCATION = 120;

const pad = (n) => String(n).padStart(2, '0');

/** "YYYY-MM-DD HH:MM" in local time, comparable as a string. */
function toLocalStamp(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');

function validateEvent(body, now) {
  const type = str(body.type);
  const date = str(body.date);
  const time = str(body.time);
  const location = str(body.location);
  const errors = {};

  if (!EVENT_TYPES.includes(type)) errors.type = 'Choose training or match';
  if (!date) errors.date = 'Date is required';
  else if (!isRealDate(date)) errors.date = 'Invalid date (YYYY-MM-DD)';
  if (!time) errors.time = 'Time is required';
  else if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) errors.time = 'Invalid time (HH:MM)';
  if (!location) errors.location = 'Location is required';
  else if (location.length > MAX_LOCATION) errors.location = `Location cannot exceed ${MAX_LOCATION} characters`;

  if (!errors.date && !errors.time && `${date} ${time}` < toLocalStamp(now())) {
    errors.date = 'The date cannot be in the past';
  }

  if (Object.keys(errors).length > 0) throw new HttpError(400, 'Please check the event details', errors);
  return { type, date, time, location };
}

module.exports = (router, db, { now }) => {
  const insert = db.prepare('INSERT INTO events (type, date, time, location) VALUES (?, ?, ?, ?)');
  const byId = db.prepare('SELECT id, type, date, time, location FROM events WHERE id = ?');
  const upcoming = db.prepare(
    `SELECT id, type, date, time, location FROM events
     WHERE date || ' ' || time >= ?
     ORDER BY date, time, id`
  );

  router.add('POST', /^\/api\/events$/, ({ body }) => {
    const event = validateEvent(body, now);
    const { lastInsertRowid } = insert.run(event.type, event.date, event.time, event.location);
    return { status: 201, body: byId.get(lastInsertRowid) };
  });

  router.add('GET', /^\/api\/events$/, () => ({
    status: 200,
    body: upcoming.all(toLocalStamp(now())),
  }));
};

module.exports.toLocalStamp = toLocalStamp;
