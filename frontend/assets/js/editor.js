import { loadAttachments, renderAttachments, uploadAttachment } from './attachments.js';

let currentNoteId = null;

export function initEditor() {
  const ta = document.getElementById('editor-textarea');
  if (!ta) return;

  ta.addEventListener('input', () => { autoResize(ta); updateTagsPreview(ta.value); });
  ta.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); insertMarkdown('bold'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); insertMarkdown('italic'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveNote(); }
    if (e.key === 'Tab') { e.preventDefault(); insertAtCursor(ta, '  '); }
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      if (handleSmartList(ta)) e.preventDefault();
    }
  });

  document.getElementById('editor-toolbar')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) insertMarkdown(btn.dataset.action);
  });

  document.getElementById('btn-save')?.addEventListener('click', saveNote);
  document.getElementById('btn-cancel-edit')?.addEventListener('click', resetEditor);

  document.getElementById('file-input')?.addEventListener('change', async e => {
    if (!currentNoteId) return;
    for (const file of e.target.files) {
      try { await uploadAttachment(currentNoteId, file); }
      catch (err) { alert(err.message); }
    }
    await loadAttachments(currentNoteId);
    e.target.value = '';
  });
}

export async function loadNoteForEdit(noteId) {
  const res = await fetch(`/api/notes/${noteId}`);
  if (!res.ok) { alert('Nota não encontrada.'); return; }
  const note = await res.json();

  currentNoteId = noteId;
  const ta = document.getElementById('editor-textarea');
  ta.value = note.content || '';
  autoResize(ta);
  updateTagsPreview(ta.value);
  ta.focus();

  const bar = document.getElementById('editor-mode-bar');
  if (bar) bar.hidden = false;
  const label = document.getElementById('editor-mode-label');
  if (label) label.textContent = `Editando nota #${noteId}`;

  const attachSection = document.getElementById('attachments-section');
  if (attachSection) attachSection.hidden = false;
  renderAttachments(noteId, note.attachments || []);

  document.getElementById('editor-box')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function resetEditor() {
  currentNoteId = null;
  const ta = document.getElementById('editor-textarea');
  if (ta) { ta.value = ''; autoResize(ta); }
  updateTagsPreview('');
  const bar = document.getElementById('editor-mode-bar');
  if (bar) bar.hidden = true;
  const attachSection = document.getElementById('attachments-section');
  if (attachSection) {
    attachSection.hidden = true;
    const list = document.getElementById('attachments-list');
    if (list) list.innerHTML = '';
  }
}

async function saveNote() {
  const ta = document.getElementById('editor-textarea');
  if (!ta) return;
  const content = ta.value;
  if (!currentNoteId && !content.trim()) return;

  try {
    if (currentNoteId) {
      const res = await fetch(`/api/notes/${currentNoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Save failed');
    } else {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (!res.ok) throw new Error('Create failed');
    }
    resetEditor();
    document.dispatchEvent(new CustomEvent('note:saved'));
  } catch (err) {
    console.error('saveNote error:', err);
    alert('Erro ao salvar nota.');
  }
}

// Smart list: when Enter is pressed inside a list item, continue or exit the list.
// Returns true if the Enter was handled (caller should preventDefault).
function handleSmartList(ta) {
  const pos = ta.selectionStart;
  // Only act when cursor is at the end of a selection (no multi-line selection)
  if (ta.selectionEnd !== pos) return false;

  const text = ta.value;
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
  // currentLine = content from start of line up to cursor
  const currentLine = text.slice(lineStart, pos);

  // Bullet list: "- " or "* " with optional leading spaces
  const bulletMatch = currentLine.match(/^(\s*)([-*]) (.*)/);
  if (bulletMatch) {
    const [, indent, bullet, content] = bulletMatch;
    if (!content.trim()) {
      // Empty list item — exit list by removing the prefix
      ta.value = text.slice(0, lineStart) + text.slice(pos);
      ta.setSelectionRange(lineStart, lineStart);
      autoResize(ta);
      updateTagsPreview(ta.value);
      return true;
    }
    // Continue list
    const insert = '\n' + indent + bullet + ' ';
    ta.value = text.slice(0, pos) + insert + text.slice(ta.selectionEnd);
    const newPos = pos + insert.length;
    ta.setSelectionRange(newPos, newPos);
    autoResize(ta);
    updateTagsPreview(ta.value);
    return true;
  }

  // Ordered list: "1. " with optional leading spaces
  const orderedMatch = currentLine.match(/^(\s*)(\d+)\. (.*)/);
  if (orderedMatch) {
    const [, indent, numStr, content] = orderedMatch;
    if (!content.trim()) {
      // Empty list item — exit list
      ta.value = text.slice(0, lineStart) + text.slice(pos);
      ta.setSelectionRange(lineStart, lineStart);
      autoResize(ta);
      updateTagsPreview(ta.value);
      return true;
    }
    const nextNum = parseInt(numStr, 10) + 1;
    const insert = '\n' + indent + nextNum + '. ';
    ta.value = text.slice(0, pos) + insert + text.slice(ta.selectionEnd);
    const newPos = pos + insert.length;
    ta.setSelectionRange(newPos, newPos);
    autoResize(ta);
    updateTagsPreview(ta.value);
    return true;
  }

  return false;
}

function autoResize(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

function updateTagsPreview(content) {
  const container = document.getElementById('editor-tags-preview');
  if (!container) return;
  const tags = [...new Set((content.match(/#([a-zA-Z0-9_\u00C0-\u024F]+)/g) || []))].map(t => t.slice(1));
  container.innerHTML = tags.map(t => `<span class="editor-tag-pill">#${escapeHtml(t)}</span>`).join('');
}

function insertMarkdown(type) {
  const ta = document.getElementById('editor-textarea');
  if (!ta) return;
  const s = ta.selectionStart, e = ta.selectionEnd;
  const sel = ta.value.slice(s, e);
  const map = {
    bold:    ['**', '**', 'negrito'],
    italic:  ['_', '_', 'itálico'],
    heading: ['## ', '', 'Título'],
    ul:      ['- ', '', 'item'],
    ol:      ['1. ', '', 'item'],
    code:    ['`', '`', 'código'],
    link:    ['[', '](url)', 'texto'],
  };
  const [before, after, ph] = map[type] || ['', '', ''];
  const text = sel || ph;
  const insert = before + text + after;
  ta.value = ta.value.slice(0, s) + insert + ta.value.slice(e);
  const ns = sel ? s + insert.length : s + before.length;
  const ne = sel ? s + insert.length : s + before.length + ph.length;
  ta.setSelectionRange(ns, ne);
  ta.focus();
  autoResize(ta);
  updateTagsPreview(ta.value);
}

function insertAtCursor(ta, text) {
  const s = ta.selectionStart;
  ta.value = ta.value.slice(0, s) + text + ta.value.slice(ta.selectionEnd);
  ta.setSelectionRange(s + text.length, s + text.length);
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
