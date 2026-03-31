import { getTagColor } from './tagStore.js';

let currentFilter = {};

export async function loadNotes(params = {}) {
  currentFilter = params;
  const qs = new URLSearchParams({ limit: '100', ...params });
  try {
    const res = await fetch(`/api/notes?${qs}`);
    const data = await res.json();
    renderFeed(data.notes || []);
  } catch (err) {
    console.error('loadNotes error:', err);
  }
}

function renderFeed(notes) {
  const list = document.getElementById('notes-list');
  const empty = document.getElementById('notes-empty');
  const header = document.getElementById('feed-header');
  const count = document.getElementById('notes-count');

  if (!notes.length) {
    list.innerHTML = '';
    if (empty) empty.hidden = false;
    if (header) header.hidden = true;
    return;
  }
  if (empty) empty.hidden = true;
  if (header) header.hidden = false;
  if (count) count.textContent = `${notes.length} nota${notes.length !== 1 ? 's' : ''}`;

  list.innerHTML = notes.map(noteCardHTML).join('');

  // Double-click on card body → edit (ignore clicks on buttons/tags)
  list.querySelectorAll('.note-card').forEach(card =>
    card.addEventListener('dblclick', e => {
      if (e.target.closest('button, .note-tag, .note-card-attach-link')) return;
      document.dispatchEvent(new CustomEvent('note:edit', { detail: { id: Number(card.dataset.id) } }));
    })
  );

  list.querySelectorAll('.btn-pin').forEach(btn =>
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await togglePin(Number(btn.dataset.id), btn.dataset.pinned !== 'true');
    })
  );

  list.querySelectorAll('.note-tag[data-tag]').forEach(tag =>
    tag.addEventListener('click', e => {
      e.stopPropagation();
      document.dispatchEvent(new CustomEvent('note:tag-click', { detail: { tag: tag.dataset.tag } }));
    })
  );
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
        return isImage
          ? `<a href="${a.url}" target="_blank" rel="noopener" class="note-card-attach-link" title="${esc(a.original_name)}"><img src="${a.url}" alt="${esc(a.original_name)}" class="note-card-attach-img" loading="lazy"></a>`
          : `<a href="${a.url}" target="_blank" rel="noopener" class="note-card-attach-link note-card-attach-icon" title="${esc(a.original_name)}">${noteAttachIcon(a.mime_type)}</a>`;
      }).join('')}</div>`
    : '';

  return `<div class="note-card ${pinClass}" data-id="${note.id}" role="listitem">
    <div class="note-card-header">
      <span class="note-card-time">${note.pinned ? '<span class="pin-badge">📌</span>' : ''}${time}</span>
      <div class="note-card-actions">
        <button class="tb-btn btn-pin" data-id="${note.id}" data-pinned="${note.pinned}" title="${note.pinned ? 'Desafixar' : 'Fixar'}">${note.pinned ? '📌' : '📍'}</button>
      </div>
    </div>
    <div class="note-content">${rendered}${long ? '<div class="note-content-fade"></div>' : ''}</div>
    ${attachThumbsHTML}
    ${tags ? `<div class="note-card-footer"><div class="note-hashtags">${tags}</div></div>` : ''}
  </div>`;
}

function noteAttachIcon(mime) {
  if (!mime) return '📄';
  if (mime === 'application/pdf') return '📕';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('sheet') || mime.includes('excel')) return '📊';
  return '📄';
}

export async function deleteNote(id) {
  if (!confirm('Excluir esta nota? Esta ação não pode ser desfeita.')) return false;
  try {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error('Delete failed');
    document.dispatchEvent(new CustomEvent('note:deleted'));
    return true;
  } catch (err) {
    console.error('deleteNote error:', err);
    alert('Erro ao excluir nota.');
    return false;
  }
}

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
