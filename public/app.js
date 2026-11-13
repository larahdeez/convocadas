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

async function loadEvents() {
  const events = await api('GET', '/api/events');
  const list = $('#event-list');
  list.replaceChildren(
    ...events.map((event) =>
      el('li', { class: 'event' },
        el('div', { class: 'info' },
          el('div', { class: 'when' }, el('span', { class: `badge ${event.type}` }, TYPE_LABEL[event.type]), formatWhen(event)),
          el('div', { class: 'where' }, `📍 ${event.location}`),
        ),
      )
    )
  );
  $('#event-empty').hidden = events.length > 0;
}

loadEvents();
