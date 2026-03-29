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

  list.querySelectorAll('.btn-edit-card').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation();
      document.dispatchEvent(new CustomEvent('note:edit', { detail: { id: Number(btn.dataset.id) } }));
    })
  );
  list.querySelectorAll('.btn-pin').forEach(btn =>
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await togglePin(Number(btn.dataset.id), btn.dataset.pinned !== 'true');
    })
  );
  list.querySelectorAll('.btn-delete-card').forEach(btn =>
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await deleteNote(Number(btn.dataset.id));
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
  const tags = (note.hashtags || []).map(t =>
    `<span class="note-tag" data-tag="${esc(t)}">#${esc(t)}</span>`
  ).join('');
  const time = relativeTime(note.updated_at || note.created_at);
  const rendered = typeof marked !== 'undefined' ? marked.parse(note.content || '') : `<p>${esc(note.content || '')}</p>`;
  const long = (note.content || '').length > 400;

  return `<div class="note-card ${pinClass}" data-id="${note.id}" role="listitem">
    <div class="note-card-header">
      <span class="note-card-time">${note.pinned ? '<span class="pin-badge">📌</span>' : ''}${time}</span>
      <div class="note-card-actions">
        <button class="tb-btn btn-edit-card" data-id="${note.id}" title="Editar">✏️</button>
        <button class="tb-btn btn-pin" data-id="${note.id}" data-pinned="${note.pinned}" title="${note.pinned ? 'Desafixar' : 'Fixar'}">${note.pinned ? '📌' : '📍'}</button>
        <button class="tb-btn btn-danger-sm btn-delete-card" data-id="${note.id}" title="Excluir">🗑</button>
      </div>
    </div>
    <div class="note-content">${rendered}${long ? '<div class="note-content-fade"></div>' : ''}</div>
    ${tags ? `<div class="note-card-footer"><div class="note-hashtags">${tags}</div></div>` : ''}
  </div>`;
}

async function deleteNote(id) {
  if (!confirm('Excluir esta nota? Esta ação não pode ser desfeita.')) return;
  try {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error('Delete failed');
    document.dispatchEvent(new CustomEvent('note:deleted'));
  } catch (err) {
    console.error('deleteNote error:', err);
    alert('Erro ao excluir nota.');
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
