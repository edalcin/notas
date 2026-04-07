import { getTagColor } from './tagStore.js';
import { showConfirmModal } from './modal.js';

const PAGE_SIZE = 20;

let currentFilter = {};
let pagination = { offset: 0, loading: false, done: false };
let generation = 0;   // incremented on each fresh loadNotes() to discard stale responses
let observer = null;

// ─── Public API ───────────────────────────────────────────────────────────────

export async function loadNotes(params = {}) {
  currentFilter = params;
  pagination = { offset: 0, loading: false, done: false };
  generation++;

  const list = document.getElementById('notes-list');
  const empty = document.getElementById('notes-empty');
  const header = document.getElementById('feed-header');

  if (list) list.innerHTML = '';
  if (empty) empty.hidden = true;
  if (header) header.hidden = true;

  setSentinel('idle');
  disconnectObserver();

  await fetchPage(generation);
  setupObserver();
}

export async function trashNote(id) {
  return new Promise(resolve => {
    showConfirmModal('Mover esta nota para a lixeira?', async () => {
      try {
        const res = await fetch(`/api/notes/${id}/trash`, { method: 'PUT' });
        if (!res.ok && res.status !== 404) throw new Error('Trash failed');
        document.dispatchEvent(new CustomEvent('note:deleted'));
        resolve(true);
      } catch (err) {
        console.error('trashNote error:', err);
        resolve(false);
      }
    });
  });
}

// ─── Pagination ───────────────────────────────────────────────────────────────

async function fetchPage(gen) {
  if (pagination.loading) return;
  pagination.loading = true;
  setSentinel('loading');

  const qs = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(pagination.offset),
    ...currentFilter,
  });

  try {
    const res = await fetch(`/api/notes?${qs}`);
    const data = await res.json();
    if (gen !== generation) return; // stale — a new loadNotes() was called

    const notes = data.notes || [];
    pagination.offset += notes.length;
    pagination.done = notes.length < PAGE_SIZE;

    appendCards(notes);
    updateHeader();
    setSentinel(pagination.done ? 'done' : 'idle');
  } catch (err) {
    if (gen === generation) {
      console.error('fetchPage error:', err);
      setSentinel('idle');
    }
  } finally {
    if (gen === generation) pagination.loading = false;
  }
}

function setupObserver() {
  if (pagination.done) return;

  const sentinel = document.getElementById('notes-sentinel');
  if (!sentinel) return;

  observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !pagination.loading && !pagination.done) {
      fetchPage(generation);
    }
  }, { rootMargin: '300px' });

  observer.observe(sentinel);
}

function disconnectObserver() {
  if (observer) { observer.disconnect(); observer = null; }
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function appendCards(notes) {
  const list = document.getElementById('notes-list');
  const empty = document.getElementById('notes-empty');
  if (!list) return;

  if (notes.length === 0 && pagination.offset === 0) {
    if (empty) empty.hidden = false;
    return;
  }

  const frag = document.createDocumentFragment();
  for (const note of notes) {
    const tmp = document.createElement('div');
    tmp.innerHTML = noteCardHTML(note);
    const card = tmp.firstElementChild;
    bindCardEvents(card);
    frag.appendChild(card);
  }
  list.appendChild(frag);
}

function bindCardEvents(card) {
  card.addEventListener('dblclick', e => {
    if (e.target.closest('button, .note-tag, .note-card-attach-link')) return;
    document.dispatchEvent(new CustomEvent('note:edit', { detail: { id: Number(card.dataset.id) } }));
  });

  card.querySelector('.btn-pin')?.addEventListener('click', async e => {
    e.stopPropagation();
    const btn = e.currentTarget;
    await togglePin(Number(btn.dataset.id), btn.dataset.pinned !== 'true');
  });

  card.querySelectorAll('.note-tag[data-tag]').forEach(tag =>
    tag.addEventListener('click', e => {
      e.stopPropagation();
      document.dispatchEvent(new CustomEvent('note:tag-click', { detail: { tag: tag.dataset.tag } }));
    })
  );

  card.querySelector('.btn-trash')?.addEventListener('click', async e => {
    e.stopPropagation();
    await trashNote(Number(e.currentTarget.dataset.id));
  });

  card.querySelector('.btn-expand')?.addEventListener('click', e => {
    e.stopPropagation();
    const content = card.querySelector('.note-content');
    const expanded = content.classList.toggle('expanded');
    e.currentTarget.textContent = expanded ? 'Ver menos' : 'Ver mais…';
    e.currentTarget.setAttribute('aria-expanded', String(expanded));
  });
}

function updateHeader() {
  const header = document.getElementById('feed-header');
  const count = document.getElementById('notes-count');
  const loaded = document.querySelectorAll('#notes-list .note-card').length;
  if (loaded > 0) {
    if (header) header.hidden = false;
    if (count) count.textContent = `${loaded} nota${loaded !== 1 ? 's' : ''}`;
  }
}

function setSentinel(state) {
  const el = document.getElementById('notes-sentinel');
  if (el) el.dataset.state = state;
}

function noteCardHTML(note) {
  const pinClass = note.pinned ? 'pinned' : '';
  const tags = (note.hashtags || []).map(t => {
    const color = getTagColor(t);
    const style = color ? `style="color:${color};background:${color}1a"` : '';
    return `<span class="note-tag" data-tag="${esc(t)}" ${style}>#${esc(t)}</span>`;
  }).join('');
  const time = relativeTime(note.updated_at || note.created_at);
  const rendered = typeof marked !== 'undefined' ? marked.parse(note.content || '', { breaks: true }) : `<p>${esc(note.content || '')}</p>`;
  const long = (note.content || '').length > 400;
  const attachments = note.attachments || [];
  const attachThumbsHTML = attachments.length > 0
    ? `<div class="note-card-attachments">${attachments.map(a => {
        const isImage = a.mime_type && a.mime_type.startsWith('image/');
        const preview = isImage
          ? `<img src="${a.url}" alt="${esc(a.original_name)}" loading="lazy">`
          : `<span>&#128196;</span>`;
        return `<div class="attachment-item">
          <a href="${a.url}" target="_blank" rel="noopener" title="${esc(a.original_name)}">${preview}</a>
          <span class="attachment-name" title="${esc(a.original_name)}">${esc(a.original_name)}</span>
        </div>`;
      }).join('')}</div>`
    : '';

  return `<div class="note-card ${pinClass}" data-id="${note.id}" role="listitem">
    <div class="note-card-header">
      <span class="note-card-time">${note.pinned ? '<span class="pin-badge">📌</span>' : ''}${time}</span>
      <div class="note-card-actions">
        <button class="tb-btn btn-pin" data-id="${note.id}" data-pinned="${note.pinned}" title="${note.pinned ? 'Desafixar' : 'Fixar'}">${note.pinned ? '📌' : '📍'}</button>
        <button class="tb-btn btn-trash" data-id="${note.id}" title="Mover para lixeira">🗑️</button>
      </div>
    </div>
    <div class="note-content">${rendered}${long ? '<div class="note-content-fade"></div>' : ''}</div>
    ${long ? '<button class="btn-expand" aria-expanded="false">Ver mais…</button>' : ''}
    ${attachThumbsHTML}
    ${tags ? `<div class="note-card-footer"><div class="note-hashtags">${tags}</div></div>` : ''}
  </div>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function togglePin(id, pinned) {
  try {
    await fetch(`/api/notes/${id}/pin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned }),
    });
    await loadNotes(currentFilter);
  } catch (err) {
    console.error('togglePin error:', err);
  }
}

function relativeTime(d) {
  if (!d) return '';
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `há ${Math.floor(diff/60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff/3600)} h`;
  if (diff < 2592000) return `há ${Math.floor(diff/86400)} dias`;
  if (diff < 31536000) return `há ${Math.floor(diff/2592000)} meses`;
  return `há ${Math.floor(diff/31536000)} anos`;
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
