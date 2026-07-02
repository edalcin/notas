import { getTagColor } from './tagStore.js';

const PAGE_SIZE = 20;

export async function loadArchive() {
  const list = document.getElementById('archive-list');
  const empty = document.getElementById('archive-empty');

  if (list) list.innerHTML = '';
  if (empty) empty.hidden = true;

  try {
    const res = await fetch(`/api/archive?limit=${PAGE_SIZE}&offset=0`);
    const data = await res.json();
    const notes = data.notes || [];

    if (notes.length === 0) {
      if (empty) empty.hidden = false;
      return;
    }

    const frag = document.createDocumentFragment();
    for (const note of notes) {
      const tmp = document.createElement('div');
      tmp.innerHTML = archiveCardHTML(note);
      const card = tmp.firstElementChild;
      bindArchiveCardEvents(card);
      frag.appendChild(card);
    }
    if (list) list.appendChild(frag);
  } catch (err) {
    console.error('loadArchive error:', err);
  }
}

function bindArchiveCardEvents(card) {
  card.querySelector('.btn-unarchive')?.addEventListener('click', async e => {
    e.stopPropagation();
    const id = Number(e.currentTarget.dataset.id);
    try {
      const res = await fetch(`/api/notes/${id}/unarchive`, { method: 'PUT' });
      if (!res.ok) throw new Error('Unarchive failed');
      document.dispatchEvent(new CustomEvent('note:unarchived'));
      await loadArchive();
    } catch (err) {
      console.error('unarchive error:', err);
    }
  });
}

function archiveCardHTML(note) {
  const tags = (note.hashtags || []).map(t => {
    const color = getTagColor(t);
    const style = color ? `style="color:${color};background:${color}1a"` : '';
    return `<span class="note-tag" data-tag="${esc(t)}" ${style}>#${esc(t)}</span>`;
  }).join('');
  const createdTime = note.created_at ? formatDate(note.created_at) : '';
  const archivedTime = note.archived_at ? formatArchivedAt(note.archived_at) : '';
  const rendered = typeof marked !== 'undefined' ? DOMPurify.sanitize(marked.parse(note.content || '', { breaks: true })) : `<p>${esc(note.content || '')}</p>`;

  return `<div class="note-card" data-id="${note.id}" role="listitem">
    <div class="note-card-header">
      <span class="note-card-time">Criada em ${createdTime}${archivedTime ? ' · ' + archivedTime : ''}</span>
      <div class="note-card-actions">
        <button class="tb-btn btn-unarchive" data-id="${note.id}" title="Desarquivar nota">📤 Desarquivar</button>
      </div>
    </div>
    <div class="note-content">${rendered}</div>
    ${tags ? `<div class="note-card-footer"><div class="note-hashtags">${tags}</div></div>` : ''}
  </div>`;
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return `${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatArchivedAt(d) {
  if (!d) return '';
  return `arquivada em ${formatDate(d)}`;
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
