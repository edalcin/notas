import { loadAttachments, renderAttachments, uploadAttachment } from './attachments.js';

let easyMDE = null;
let currentNoteId = null;
let saveTimer = null;
let isDirty = false;

export async function initEditor(noteId) {
  currentNoteId = noteId;

  const res = await fetch(`/api/notes/${noteId}`);
  if (!res.ok) {
    alert('Nota não encontrada.');
    window.location.hash = '#list';
    return;
  }
  const note = await res.json();

  // Destroy previous editor instance
  if (easyMDE) {
    easyMDE.toTextArea();
    easyMDE = null;
  }

  const textarea = document.getElementById('editor-textarea');
  textarea.value = note.content || '';

  easyMDE = new EasyMDE({
    element: textarea,
    autofocus: true,
    spellChecker: false,
    status: false,
    toolbar: ['bold', 'italic', 'heading', '|', 'unordered-list', 'ordered-list', '|', 'link', '|', 'preview', 'side-by-side', 'fullscreen'],
    placeholder: 'Escreva sua nota em Markdown...',
  });

  easyMDE.codemirror.on('change', onEditorChange);

  // Update pin button
  const pinBtn = document.getElementById('btn-toggle-pin');
  if (pinBtn) {
    pinBtn.dataset.pinned = note.pinned ? 'true' : 'false';
    pinBtn.title = note.pinned ? 'Desafixar nota' : 'Fixar nota';
  }

  setSaveStatus('');
  renderAttachments(noteId, note.attachments || []);

  // File upload handler
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    const newInput = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(newInput, fileInput);
    newInput.addEventListener('change', async () => {
      if (!newInput.files.length) return;
      for (const file of newInput.files) {
        try {
          await uploadAttachment(noteId, file);
        } catch (err) {
          alert(err.message);
        }
      }
      await loadAttachments(noteId);
      newInput.value = '';
    });
  }
}

function onEditorChange() {
  isDirty = true;
  setSaveStatus('Editando...');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNote, 2000);
}

export async function saveNote() {
  if (!currentNoteId || !easyMDE) return;
  clearTimeout(saveTimer);

  const content = easyMDE.value();
  setSaveStatus('Salvando...');

  try {
    const res = await fetch(`/api/notes/${currentNoteId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error('Save failed');
    isDirty = false;
    setSaveStatus('Salvo ✓');
  } catch (err) {
    console.error('saveNote error:', err);
    setSaveStatus('Erro ao salvar');
  }
}

function setSaveStatus(msg) {
  const el = document.getElementById('save-status');
  if (el) el.textContent = msg;
}

export function destroyEditor() {
  if (saveTimer) clearTimeout(saveTimer);
  if (isDirty && easyMDE) saveNote();
  if (easyMDE) {
    easyMDE.toTextArea();
    easyMDE = null;
  }
  currentNoteId = null;
  isDirty = false;
}
