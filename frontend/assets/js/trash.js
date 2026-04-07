import { getTagColor } from './tagStore.js';
import { showConfirmModal } from './modal.js';

const PAGE_SIZE = 20;

export async function loadTrash() {
  const list = document.getElementById('trash-list');
  const empty = document.getElementById('trash-empty');
  const btnEmpty = document.getElementById('btn-empty-trash');

  if (list) list.innerHTML = '';
  if (empty) empty.hidden = true;

  try {
    const res = await fetch(`/api/trash?limit=${PAGE_SIZE}&offset=0`);
    const data = await res.json();
    const notes = data.notes || [];

    if (notes.length === 0) {
      if (empty) empty.hidden = false;
      if (btnEmpty) btnEmpty.disabled = true;
      return;
    }

    if (btnEmpty) btnEmpty.disabled = false;

    const frag = document.createDocumentFragment();
    for (const note of notes) {
      const tmp = document.createElement('div');
      tmp.innerHTML = trashCardHTML(note);
      const card = tmp.firstElementChild;
      bindTrashCardEvents(card);
      frag.appendChild(card);
    }
    if (list) list.appendChild(frag);
  } catch (err) {
    console.error('loadTrash error:', err);
  }
}

export function initTrash() {
  document.getElementById('btn-empty-trash')?.addEventListener('click', emptyTrash);
}

async function emptyTrash() {
  showConfirmModal('Esvaziar a lixeira? Esta ação é irreversível e todos os arquivos serão excluídos permanentemente.', async () => {
    try {
      const res = await fetch('/api/trash', { method: 'DELETE' });
      if (!res.ok) throw new Error('EmptyTrash failed');
      await loadTrash();
    } catch (err) {
      console.error('emptyTrash error:', err);
    }
  });
}

function bindTrashCardEvents(card) {
  card.querySelector('.btn-restore')?.addEventListener('click', async e => {
    e.stopPropagation();
    const id = Number(e.currentTarget.dataset.id);
    try {
      const res = await fetch(`/api/notes/${id}/restore`, { method: 'PUT' });
      if (!res.ok) throw new Error('Restore failed');
      document.dispatchEvent(new CustomEvent('note:restored'));
      await loadTrash();
    } catch (err) {
      console.error('restore error:', err);
    }
  });
}

function trashCardHTML(note) {
  const tags = (note.hashtags || []).map(t => {
    const color = getTagColor(t);
    const style = color ? `style="color:${color};background:${color}1a"` : '';
    return `<span class="note-tag" data-tag="${esc(t)}" ${style}>#${esc(t)}</span>`;
  }).join('');
  const deletedTime = note.deleted_at ? formatDeletedAt(note.deleted_at) : '';
  const rendered = typeof marked !== 'undefined' ? marked.parse(note.content || '', { breaks: true }) : `<p>${esc(note.content || '')}</p>`;

  return `<div class="note-card" data-id="${note.id}" role="listitem">
    <div class="note-card-header">
      <span class="note-card-time">${deletedTime}</span>
      <div class="note-card-actions">
        <button class="tb-btn btn-restore" data-id="${note.id}" title="Restaurar nota">↩️ Restaurar</button>
      </div>
    </div>
    <div class="note-content">${rendered}</div>
    ${tags ? `<div class="note-card-footer"><div class="note-hashtags">${tags}</div></div>` : ''}
  </div>`;
}

function formatDeletedAt(d) {
  if (!d) return '';
  const date = new Date(d);
  return `Deletada em ${date.toLocaleDateString('pt-BR')} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
