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
    btn.addEventListener('click', () => deleteGlobalAttachment(Number(btn.dataset.id), Number(btn.dataset.noteId)));
  });
}

function itemHTML(a) {
  const isImage = a.mime_type && a.mime_type.startsWith('image/');
  const thumb = isImage
    ? `<img src="${a.url}" alt="${esc(a.original_name)}" class="attach-thumb" loading="lazy">`
    : `<span class="attach-icon-placeholder">${mimeIcon(a.mime_type)}</span>`;
  const size = formatBytes(a.size_bytes);
  const preview = a.note_preview ? `<span class="attach-note-preview">${esc(a.note_preview)}</span>` : '';

  return `<div class="attach-view-item" data-id="${a.id}">
    <a href="${a.url}" target="_blank" rel="noopener" class="attach-thumb-link">${thumb}</a>
    <div class="attach-view-meta">
      <a href="${a.url}" target="_blank" rel="noopener" class="attach-filename">${esc(a.original_name)}</a>
      <span class="attach-size">${size}</span>
      ${preview}
    </div>
    <button class="btn-icon btn-delete-attach-global" data-id="${a.id}" data-note-id="${a.note_id}" title="Excluir anexo" aria-label="Excluir anexo">🗑️</button>
  </div>`;
}

async function deleteGlobalAttachment(attachmentId, noteId) {
  if (!confirm('Excluir este anexo permanentemente?')) return;
  try {
    const res = await fetch(`/api/notes/${noteId}/attachments/${attachmentId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error('delete failed');
    await loadAttachmentsView();
    if (_deleteCallback) _deleteCallback();
  } catch (err) {
    console.error('deleteGlobalAttachment error:', err);
    alert('Erro ao excluir anexo.');
  }
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

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
