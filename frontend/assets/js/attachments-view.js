let _deleteCallback = null;

export async function loadAttachmentsView(hashtag = '') {
  const container = document.getElementById('attachments-view-list');
  if (!container) return;

  container.innerHTML = '<p class="attach-view-loading">Carregando…</p>';

  try {
    const url = hashtag
      ? `/api/attachments?hashtag=${encodeURIComponent(hashtag)}`
      : '/api/attachments';
    const res = await fetch(url, { cache: 'no-store' });
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
      e.preventDefault(); e.stopPropagation();
      deleteGlobalAttachment(Number(btn.dataset.id), Number(btn.dataset.noteId));
    });
  });

  container.querySelectorAll('.attach-caption-tag').forEach(tag => {
    tag.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      import('./hashtags.js').then(m => m.setActiveHashtag(tag.dataset.tag));
    });
  });

  renderPDFThumbs(container);
}

function itemHTML(a) {
  const isImage = a.mime_type && a.mime_type.startsWith('image/');
  const isPDF   = a.mime_type === 'application/pdf';

  let thumb;
  if (isImage) {
    thumb = `<img src="${a.url}" alt="${esc(a.original_name)}" class="attach-grid-img" loading="lazy">`;
  } else if (isPDF) {
    thumb = `<canvas class="attach-grid-img attach-pdf-canvas" data-pdf-url="${a.url}"></canvas>`;
  } else {
    thumb = `<span class="attach-grid-icon">${mimeIcon(a.mime_type)}</span>`;
  }

  const dateStr = a.note_created_at
    ? new Date(a.note_created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  const tagsHTML = (a.hashtags || []).length
    ? `<div class="attach-caption-tags">${(a.hashtags).map(t =>
        `<span class="attach-caption-tag" data-tag="${esc(t)}">#${esc(t)}</span>`).join('')}</div>`
    : '';

  return `<div class="attach-grid-item" title="${esc(a.original_name)}">
    <div class="attach-grid-thumb">
      <a href="${a.url}" target="_blank" rel="noopener" class="attach-grid-link">${thumb}</a>
      <button class="btn-delete-attach-global attach-grid-delete" data-id="${a.id}" data-note-id="${a.note_id}" aria-label="Excluir ${esc(a.original_name)}">🗑️</button>
    </div>
    <div class="attach-grid-caption">
      ${a.note_title ? `<div class="attach-caption-title">${esc(a.note_title)}</div>` : ''}
      ${dateStr ? `<div class="attach-caption-date">${dateStr}</div>` : ''}
      ${tagsHTML}
    </div>
  </div>`;
}

async function renderPDFThumbs(container) {
  if (!window.pdfjsLib) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
  for (const canvas of container.querySelectorAll('.attach-pdf-canvas')) {
    try {
      const pdf  = await pdfjsLib.getDocument(canvas.dataset.pdfUrl).promise;
      const page = await pdf.getPage(1);
      const vp   = page.getViewport({ scale: 1 });
      const scale = (canvas.closest('.attach-grid-thumb')?.clientWidth || 150) / vp.width;
      const scaled = page.getViewport({ scale });
      canvas.width  = scaled.width;
      canvas.height = scaled.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: scaled }).promise;
    } catch { /* leave canvas blank on error */ }
  }
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
    const container = document.getElementById('attachments-view-list');

    // Remove thumbnails from DOM immediately — before any network call.
    // Deleting the note removes ALL its attachments; deleting just the file removes one.
    if (deleteNoteAlso) {
      container?.querySelectorAll(`.btn-delete-attach-global[data-note-id="${noteId}"]`)
        .forEach(b => b.closest('.attach-grid-item')?.remove());
    } else {
      document.querySelector(`.btn-delete-attach-global[data-id="${attachmentId}"]`)
        ?.closest('.attach-grid-item')?.remove();
    }

    // Update header count; show empty state if the grid is now empty.
    const remaining = container?.querySelectorAll('.attach-grid-item').length ?? 0;
    const header = document.getElementById('attach-view-header');
    if (header) header.textContent = remaining ? `${remaining} anexo${remaining !== 1 ? 's' : ''}` : '';
    if (remaining === 0 && container) {
      container.innerHTML = '<p class="attach-view-empty">Nenhum arquivo anexado ainda.</p>';
    }

    try {
      if (deleteNoteAlso) {
        const res = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 404) throw new Error('delete note failed');
        document.dispatchEvent(new CustomEvent('note:deleted'));
      } else {
        const res = await fetch(`/api/notes/${noteId}/attachments/${attachmentId}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 404) throw new Error('delete failed');
      }
      if (_deleteCallback) _deleteCallback();
    } catch (err) {
      console.error('deleteGlobalAttachment error:', err);
      alert('Erro ao excluir.');
      await loadAttachmentsView(); // full reload only on failure to restore correct state
    }
  });
}

function showDeleteConfirm(noteContent, onConfirm) {
  const rendered = typeof marked !== 'undefined'
    ? DOMPurify.sanitize(marked.parse(noteContent, { breaks: true }))
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
