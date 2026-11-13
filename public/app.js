const TYPE_LABEL = { training: 'Training', match: 'Match' };

const $ = (sel) => document.querySelector(sel);

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong');
    err.details = data.details || {};
    throw err;
  }
  return data;
}

function formatWhen(event) {
  const [y, m, d] = event.date.split('-').map(Number);
  const day = new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${event.time}`;
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const child of children) node.append(child);
  return node;
}

// ---------- US-01 · Create event ----------

const form = $('#event-form');

function showFieldErrors(details = {}) {
  for (const box of form.querySelectorAll('.field-error')) {
    box.textContent = details[box.dataset.for] || '';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#event-message');
  msg.textContent = '';
  msg.className = 'message';
  const data = Object.fromEntries(new FormData(form));
  try {
    await api('POST', '/api/events', data);
    showFieldErrors();
    form.reset();
    msg.textContent = 'Event created ✔';
    msg.classList.add('ok');
    await loadEvents();
  } catch (err) {
    showFieldErrors(err.details);
    msg.textContent = err.message;
    msg.classList.add('error');
  }
});

// ---------- US-02 · Confirm attendance ----------

const state = { me: null, myStatus: {} };

function readSavedPlayer() {
  try { return Number(localStorage.getItem('convocadas.me')) || null; } catch { return null; }
}
function savePlayer(id) {
  try { id ? localStorage.setItem('convocadas.me', String(id)) : localStorage.removeItem('convocadas.me'); } catch { /* storage unavailable */ }
}

async function loadPlayers() {
  const players = await api('GET', '/api/players');
  const select = $('#me');
  const saved = state.me ?? readSavedPlayer();
  select.replaceChildren(
    el('option', { value: '' }, '— I\'m the coach / just looking —'),
    ...players.map((p) => el('option', { value: String(p.id) }, p.name)),
  );
  state.me = players.some((p) => p.id === saved) ? saved : null;
  select.value = state.me ? String(state.me) : '';
}

async function loadMyStatus() {
  state.myStatus = state.me ? await api('GET', `/api/players/${state.me}/attendance`) : {};
}

$('#me').addEventListener('change', async (e) => {
  state.me = Number(e.target.value) || null;
  savePlayer(state.me);
  await loadEvents();
});

$('#player-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('#player-name');
  const msg = $('#player-message');
  msg.className = 'message';
  try {
    const player = await api('POST', '/api/players', { name: input.value });
    input.value = '';
    state.me = player.id;
    savePlayer(player.id);
    msg.textContent = `Hi, ${player.name} 👋`;
    msg.classList.add('ok');
    await loadPlayers();
    await loadEvents();
  } catch (err) {
    msg.textContent = err.details?.name || err.message;
    msg.classList.add('error');
  }
});

async function answer(eventId, status) {
  try {
    await api('PUT', `/api/events/${eventId}/attendance`, { playerId: state.me, status });
    await loadEvents();
  } catch (err) {
    alertBox(err.message);
  }
}

function alertBox(text) {
  const msg = $('#event-message');
  msg.textContent = text;
  msg.className = 'message error';
}

function rsvpButtons(event) {
  const current = state.myStatus[event.id];
  const disabled = state.me ? {} : { disabled: '', title: 'Choose who you are first' };
  return el('div', { class: 'rsvp' },
    el('button', { class: `yes${current === 'yes' ? ' active' : ''}`, type: 'button', onclick: () => answer(event.id, 'yes'), ...disabled }, '✔ Coming'),
    el('button', { class: `no${current === 'no' ? ' active' : ''}`, type: 'button', onclick: () => answer(event.id, 'no'), ...disabled }, '✖ Not coming'),
  );
}

// ---------- Event list ----------

async function loadEvents() {
  const [events] = await Promise.all([api('GET', '/api/events'), loadMyStatus()]);
  const list = $('#event-list');
  list.replaceChildren(
    ...events.map((event) =>
      el('li', { class: 'event' },
        el('div', { class: 'info' },
          el('div', { class: 'when' }, el('span', { class: `badge ${event.type}` }, TYPE_LABEL[event.type]), formatWhen(event)),
          el('div', { class: 'where' }, `📍 ${event.location}`),
        ),
        rsvpButtons(event),
      )
    )
  );
  $('#event-empty').hidden = events.length > 0;
}

(async () => {
  await loadPlayers();
  await loadEvents();
})();
