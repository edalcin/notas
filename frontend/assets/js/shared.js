import { getTagColor } from './tagStore.js';

let currentNoteId = null;

// ─── Share Modal ──────────────────────────────────────────────────────────────

export async function openShareModal(noteId) {
  currentNoteId = noteId;

  const modal = document.getElementById('share-modal');
  const urlInput = document.getElementById('share-url-input');
  const copyBtn = document.getElementById('share-copy-btn');
  const generateBtn = document.getElementById('share-generate-btn');
  const revokeBtn = document.getElementById('share-revoke-btn');

  if (!modal) return;

  // Reset state before showing
  urlInput.value = '';
  copyBtn.hidden = true;
  revokeBtn.hidden = true;
  generateBtn.hidden = false;
  generateBtn.textContent = 'Gerar link';

  modal.hidden = false;

  // Wire up close button (idempotent — remove old listener first)
  const closeBtn = document.getElementById('share-modal-close');
  closeBtn.onclick = () => { modal.hidden = true; };
  modal.onclick = e => { if (e.target === modal) modal.hidden = true; };

  // Wire generate button
  generateBtn.onclick = async () => {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Gerando…';
    try {
      const res = await fetch(`/api/notes/${noteId}/share`, { method: 'POST' });
      if (!res.ok) throw new Error('Share failed');
      const data = await res.json();
      setSharedState(data.url);
      updateNoteCardShareState(noteId, true);
    } catch (err) {
      console.error('openShareModal: generate error', err);
    } finally {
      generateBtn.disabled = false;
    }
  };

  // Wire copy button
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(urlInput.value);
      copyBtn.textContent = 'Copiado!';
      setTimeout(() => { copyBtn.textContent = 'Copiar'; }, 1500);
    } catch {
      urlInput.select();
    }
  };

  // Wire revoke button
  revokeBtn.onclick = async () => {
    if (!confirm('Revogar o link público desta nota?')) return;
    try {
      const res = await fetch(`/api/notes/${noteId}/share`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Revoke failed');
      setRevokedState();
      updateNoteCardShareState(noteId, false);
      removeFromSharedList(noteId);
    } catch (err) {
      console.error('openShareModal: revoke error', err);
    }
  };

  // If the note is already shared, fetch the current URL immediately
  const noteCard = document.querySelector(`.note-card[data-id="${noteId}"]`);
  const isShared = noteCard?.querySelector('.btn-share')?.dataset.shared === 'true'
    || noteCard?.querySelector('.btn-share')?.classList.contains('btn-share--active');

  if (isShared) {
    generateBtn.disabled = true;
    generateBtn.textContent = 'Gerando…';
    try {
      const res = await fetch(`/api/notes/${noteId}/share`, { method: 'POST' });
      if (!res.ok) throw new Error('Share fetch failed');
      const data = await res.json();
      setSharedState(data.url);
    } catch {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Gerar link';
    }
  }
}

function setSharedState(url) {
  const urlInput = document.getElementById('share-url-input');
  const copyBtn = document.getElementById('share-copy-btn');
  const generateBtn = document.getElementById('share-generate-btn');
  const revokeBtn = document.getElementById('share-revoke-btn');

  urlInput.value = url;
  copyBtn.hidden = false;
  generateBtn.hidden = true;
  revokeBtn.hidden = false;
}

function setRevokedState() {
  const urlInput = document.getElementById('share-url-input');
  const copyBtn = document.getElementById('share-copy-btn');
  const generateBtn = document.getElementById('share-generate-btn');
  const revokeBtn = document.getElementById('share-revoke-btn');

  urlInput.value = '';
  copyBtn.hidden = true;
  generateBtn.hidden = false;
  generateBtn.textContent = 'Gerar link';
  revokeBtn.hidden = true;
}

function updateNoteCardShareState(noteId, shared) {
  const btn = document.querySelector(`.note-card[data-id="${noteId}"] .btn-share`);
  if (!btn) return;
  btn.dataset.shared = String(shared);
  btn.classList.toggle('btn-share--active', shared);
  btn.title = shared ? 'Link compartilhado' : 'Compartilhar';
}

function removeFromSharedList(noteId) {
  const sharedView = document.getElementById('shared-view');
  if (!sharedView || sharedView.hidden) return;
  const card = document.querySelector(`#shared-list .note-card[data-id="${noteId}"]`);
  if (card) card.remove();
  const remaining = document.querySelectorAll('#shared-list .note-card').length;
  const emptyEl = document.getElementById('shared-empty');
  if (emptyEl) emptyEl.hidden = remaining > 0;
}

// ─── Shared Notes View ────────────────────────────────────────────────────────

export async function loadSharedNotes() {
  const list = document.getElementById('shared-list');
  const emptyEl = document.getElementById('shared-empty');
  if (!list) return;

  list.innerHTML = '';
  if (emptyEl) emptyEl.hidden = true;

  try {
    const res = await fetch('/api/notes/shared?limit=200');
    const data = await res.json();
    const notes = data.notes || [];

    if (notes.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    const frag = document.createDocumentFragment();
    for (const note of notes) {
      const tmp = document.createElement('div');
      tmp.innerHTML = sharedNoteCardHTML(note);
      const card = tmp.firstElementChild;
      bindSharedCardEvents(card);
      frag.appendChild(card);
    }
    list.appendChild(frag);
  } catch (err) {
    console.error('loadSharedNotes error:', err);
  }
}

function sharedNoteCardHTML(note) {
  const tags = (note.hashtags || []).map(t => {
    const color = getTagColor(t);
    const style = color ? `style="color:${color};background:${color}1a"` : '';
    return `<span class="note-tag" data-tag="${esc(t)}" ${style}>#${esc(t)}</span>`;
  }).join('');
  const time = relativeTime(note.updated_at || note.created_at);
  const rendered = typeof marked !== 'undefined'
    ? DOMPurify.sanitize(marked.parse(note.content || '', { breaks: true }))
    : `<p>${esc(note.content || '')}</p>`;
  const long = (note.content || '').length > 400;

  return `<div class="note-card" data-id="${note.id}" role="listitem">
    <div class="note-card-header">
      <span class="note-card-time">${time}</span>
      <div class="note-card-actions">
        <button class="tb-btn btn-share btn-share--active" data-id="${note.id}" data-shared="true" title="Link compartilhado">🔗</button>
      </div>
    </div>
    <div class="note-content">${rendered}${long ? '<div class="note-content-fade"></div>' : ''}</div>
    ${long ? '<button class="btn-expand" aria-expanded="false">Ver mais…</button>' : ''}
    ${tags ? `<div class="note-card-footer"><div class="note-hashtags">${tags}</div></div>` : ''}
  </div>`;
}

function bindSharedCardEvents(card) {
  card.querySelector('.btn-share')?.addEventListener('click', async e => {
    e.stopPropagation();
    await openShareModal(Number(e.currentTarget.dataset.id));
  });

  card.querySelector('.btn-expand')?.addEventListener('click', e => {
    e.stopPropagation();
    const content = card.querySelector('.note-content');
    const expanded = content.classList.toggle('expanded');
    e.currentTarget.textContent = expanded ? 'Ver menos' : 'Ver mais…';
    e.currentTarget.setAttribute('aria-expanded', String(expanded));
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(d) {
  if (!d) return '';
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 2592000) return `há ${Math.floor(diff / 86400)} dias`;
  if (diff < 31536000) return `há ${Math.floor(diff / 2592000)} meses`;
  return `há ${Math.floor(diff / 31536000)} anos`;
}

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
