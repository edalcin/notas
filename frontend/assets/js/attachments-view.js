let _deleteCallback = null;

export async function loadAttachmentsView() {
  const container = document.getElementById('attachments-view-list');
  if (!container) return;

  container.innerHTML = '<p class="attach-view-loading">Carregando…</p>';

  try {
    const res = await fetch('/api/attachments');
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    const items = data.attachments || [];
    renderAttachmentsView(container, items);
  } catch (err) {
    console.error('loadAttachmentsView error:', err);
    container.innerHTML = '<p class="attach-view-empty">Erro ao carregar anexos.</p>';
  }
}

function renderAttachmentsView(container, items) {
  const header = document.getElementById('attach-view-header');
  if (header) {
    header.textContent = items.length
      ? `${items.length} anexo${items.length !== 1 ? 's' : ''}`
      : '';
  }

  if (!items.length) {
    container.innerHTML = '<p class="attach-view-empty">Nenhum arquivo anexado ainda.</p>';
    return;
  }

  container.innerHTML = items.map(itemHTML).join('');

  container.querySelectorAll('.btn-delete-attach-global').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      deleteGlobalAttachment(Number(btn.dataset.id), Number(btn.dataset.noteId));
    });
  });
}

function itemHTML(a) {
  const isImage = a.mime_type && a.mime_type.startsWith('image/');
  const thumb = isImage
    ? `<img src="${a.url}" alt="${esc(a.original_name)}" class="attach-grid-img" loading="lazy">`
    : `<span class="attach-grid-icon">${mimeIcon(a.mime_type)}</span>`;

  return `<div class="attach-grid-item" title="${esc(a.original_name)}">
    <a href="${a.url}" target="_blank" rel="noopener" class="attach-grid-link">${thumb}</a>
    <button class="btn-delete-attach-global attach-grid-delete" data-id="${a.id}" data-note-id="${a.note_id}" aria-label="Excluir ${esc(a.original_name)}">🗑️</button>
  </div>`;
}

async function deleteGlobalAttachment(attachmentId, noteId) {
  let noteContent = '';
  try {
    const res = await fetch(`/api/notes/${noteId}`);
    if (res.ok) {
      const note = await res.json();
      noteContent = note.content || '';
    }
  } catch {}

  showDeleteConfirm(noteContent, async (deleteNoteAlso) => {
    // Remove thumbnail immediately so it disappears before the network call.
    const btn = document.querySelector(`.btn-delete-attach-global[data-id="${attachmentId}"]`);
    btn?.closest('.attach-grid-item')?.remove();

    try {
      if (deleteNoteAlso) {
        const res = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 404) throw new Error('delete note failed');
        document.dispatchEvent(new CustomEvent('note:deleted'));
      } else {
        const res = await fetch(`/api/notes/${noteId}/attachments/${attachmentId}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 404) throw new Error('delete failed');
      }
      await loadAttachmentsView();
      if (_deleteCallback) _deleteCallback();
    } catch (err) {
      console.error('deleteGlobalAttachment error:', err);
      alert('Erro ao excluir.');
      await loadAttachmentsView(); // restore correct state on failure
    }
  });
}

function showDeleteConfirm(noteContent, onConfirm) {
  const rendered = typeof marked !== 'undefined'
    ? marked.parse(noteContent, { breaks: true })
    : `<p>${esc(noteContent)}</p>`;

  const overlay = document.createElement('div');
  overlay.className = 'attach-confirm-overlay';
  overlay.innerHTML = `
    <div class="attach-confirm-box">
      <p class="attach-confirm-title">O que deseja excluir?</p>
      <div class="attach-confirm-note-preview">${rendered}</div>
      <div class="attach-confirm-actions">
        <button class="btn-confirm-file-only">Excluir apenas o arquivo</button>
        <button class="btn-confirm-note-too">Excluir nota e arquivo</button>
        <button class="btn-confirm-cancel">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => document.body.removeChild(overlay);

  overlay.querySelector('.btn-confirm-file-only').addEventListener('click', () => { close(); onConfirm(false); });
  overlay.querySelector('.btn-confirm-note-too').addEventListener('click', () => { close(); onConfirm(true); });
  overlay.querySelector('.btn-confirm-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}

export function onAttachmentDeleted(cb) {
  _deleteCallback = cb;
}

function mimeIcon(mime) {
  if (!mime) return '📄';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime === 'application/pdf') return '📕';
  if (mime.includes('word') || mime.includes('document')) return '📝';
  if (mime.includes('sheet') || mime.includes('excel')) return '📊';
  return '📄';
}

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
