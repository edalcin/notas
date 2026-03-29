export async function loadAttachments(noteId) {
  try {
    const res = await fetch(`/api/notes/${noteId}`);
    if (!res.ok) return;
    const note = await res.json();
    renderAttachments(noteId, note.attachments || []);
  } catch (err) {
    console.error('loadAttachments error:', err);
  }
}

export function renderAttachments(noteId, attachments) {
  const container = document.getElementById('attachments-list');
  if (!container) return;

  container.innerHTML = attachments.map(a => attachmentHTML(noteId, a)).join('');

  container.querySelectorAll('.btn-delete-attachment').forEach(btn => {
    btn.addEventListener('click', () => deleteAttachment(noteId, Number(btn.dataset.id)));
  });
}

function attachmentHTML(noteId, a) {
  const isImage = a.mime_type && a.mime_type.startsWith('image/');
  const preview = isImage
    ? `<img src="${a.url}" alt="${escapeHtml(a.original_name)}" loading="lazy">`
    : `<span>&#128196;</span>`;

  return `
    <div class="attachment-item" data-attachment-id="${a.id}">
      <a href="${a.url}" target="_blank" rel="noopener" title="${escapeHtml(a.original_name)}">${preview}</a>
      <span class="attachment-name" title="${escapeHtml(a.original_name)}">${escapeHtml(a.original_name)}</span>
      <button class="btn-icon btn-delete-attachment" data-id="${a.id}" aria-label="Remover anexo" title="Remover">&#x1F5D1;</button>
    </div>
  `;
}

export async function uploadAttachment(noteId, file) {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`/api/notes/${noteId}/attachments`, {
    method: 'POST',
    body: form,
  });

  if (res.status === 413) throw new Error('Arquivo muito grande.');
  if (res.status === 415) throw new Error('Tipo de arquivo não suportado.');
  if (!res.ok) throw new Error('Falha no upload.');

  return res.json();
}

export async function deleteAttachment(noteId, attachmentId) {
  if (!confirm('Remover este anexo?')) return;
  try {
    const res = await fetch(`/api/notes/${noteId}/attachments/${attachmentId}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error('Delete failed');
    await loadAttachments(noteId);
  } catch (err) {
    console.error('deleteAttachment error:', err);
    alert('Erro ao remover anexo.');
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
