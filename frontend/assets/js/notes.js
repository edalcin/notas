let currentFilter = {};

export async function loadNotes(params = {}) {
  currentFilter = params;
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.hashtag) qs.set('hashtag', params.hashtag);
  qs.set('limit', '100');

  try {
    const res = await fetch(`/api/notes?${qs}`);
    const data = await res.json();
    renderNotesList(data.notes || []);
  } catch (err) {
    console.error('loadNotes error:', err);
  }
}

function renderNotesList(notes) {
  const list = document.getElementById('notes-list');
  const empty = document.getElementById('notes-empty');
  const count = document.getElementById('notes-count');

  if (!notes.length) {
    list.innerHTML = '';
    if (empty) empty.hidden = false;
    if (count) count.textContent = '';
    return;
  }

  if (empty) empty.hidden = true;
  if (count) count.textContent = `${notes.length} nota${notes.length !== 1 ? 's' : ''}`;

  list.innerHTML = notes.map(renderNoteCard).join('');

  list.querySelectorAll('.note-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.note-card-actions')) return;
      openNote(Number(card.dataset.id));
    });
  });

  list.querySelectorAll('.btn-pin').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const id = Number(btn.dataset.id);
      const pinned = btn.dataset.pinned !== 'true';
      await togglePin(id, pinned);
    });
  });

  list.querySelectorAll('.btn-delete-card').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await deleteNote(Number(btn.dataset.id));
    });
  });
}

export function renderNoteCard(note) {
  const pinClass = note.pinned ? 'pinned' : '';
  const pinTitle = note.pinned ? 'Desafixar' : 'Fixar';
  const pinIcon = note.pinned ? '📌' : '📍';
  const tags = (note.hashtags || []).map(t => `<span class="note-tag">#${t}</span>`).join('');
  const time = formatRelativeTime(note.updated_at || note.created_at);
  const preview = escapeHtml(note.preview || '(sem conteúdo)');

  return `
    <div class="note-card ${pinClass}" data-id="${note.id}" role="listitem">
      <div class="note-card-header">
        <span class="note-preview">${preview}</span>
        <div class="note-card-actions">
          <button class="btn-icon btn-pin" data-id="${note.id}" data-pinned="${note.pinned}" title="${pinTitle}" aria-label="${pinTitle}">${pinIcon}</button>
          <button class="btn-icon btn-delete-card" data-id="${note.id}" title="Excluir" aria-label="Excluir nota">&#x1F5D1;</button>
        </div>
      </div>
      <div class="note-card-meta">
        <span class="note-time">${time}</span>
        <div class="note-hashtags">${tags}</div>
      </div>
    </div>
  `;
}

export async function createNote() {
  try {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '' }),
    });
    if (!res.ok) throw new Error('Create failed');
    const note = await res.json();
    window.location.hash = `#note/${note.id}`;
  } catch (err) {
    console.error('createNote error:', err);
    alert('Erro ao criar nota.');
  }
}

export function openNote(id) {
  window.location.hash = `#note/${id}`;
}

export async function deleteNote(id) {
  if (!confirm('Excluir esta nota? Esta ação não pode ser desfeita.')) return;
  try {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    if (res.status === 404) {
      alert('Nota não encontrada.');
      return;
    }
    if (!res.ok) throw new Error('Delete failed');
    await loadNotes(currentFilter);
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

export function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date)) return '';
  const diff = (Date.now() - date.getTime()) / 1000;

  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 2592000) return `há ${Math.floor(diff / 86400)} dias`;
  if (diff < 31536000) return `há ${Math.floor(diff / 2592000)} meses`;
  return `há ${Math.floor(diff / 31536000)} anos`;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
