import { loadAttachments, renderAttachments, uploadAttachment } from './attachments.js';
import { getTags } from './tagStore.js';
import { deleteNote } from './notes.js';

let currentNoteId = null;
let acSelectedIndex = -1;

export function initEditor() {
  const ta = document.getElementById('editor-textarea');
  if (!ta) return;

  ta.addEventListener('input', () => {
    autoResize(ta);
    updateTagsPreview(ta.value);
    handleAutocomplete(ta);
  });

  ta.addEventListener('keydown', e => {
    // Autocomplete keyboard navigation (takes priority over list shortcuts)
    const ac = document.getElementById('tag-autocomplete');
    if (ac && !ac.hidden) {
      if (e.key === 'ArrowDown') { e.preventDefault(); acMove(1); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); acMove(-1); return; }
      if (e.key === 'Enter' && acSelectedIndex >= 0) { e.preventDefault(); acConfirm(ta); return; }
      if (e.key === 'Escape') { e.preventDefault(); hideAutocomplete(); return; }
      if (e.key === 'Tab') { e.preventDefault(); if (acSelectedIndex >= 0) acConfirm(ta); else hideAutocomplete(); return; }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); insertMarkdown('bold'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); insertMarkdown('italic'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveNote(); }
    if (e.key === 'Tab') { e.preventDefault(); insertAtCursor(ta, '  '); }
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      if (handleSmartList(ta)) e.preventDefault();
    }
  });

  // Hide autocomplete when textarea loses focus (with delay for click events)
  ta.addEventListener('blur', () => setTimeout(hideAutocomplete, 150));

  document.getElementById('editor-toolbar')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) insertMarkdown(btn.dataset.action);
  });

  document.getElementById('btn-save')?.addEventListener('click', saveNote);
  document.getElementById('btn-cancel-edit')?.addEventListener('click', resetEditor);
  document.getElementById('btn-delete-note')?.addEventListener('click', async () => {
    if (!currentNoteId) return;
    const deleted = await deleteNote(currentNoteId);
    if (deleted) resetEditor();
  });

  document.getElementById('file-input')?.addEventListener('change', async e => {
    try {
      const noteId = await ensureNote();
      for (const file of e.target.files) {
        try { await uploadAttachment(noteId, file); }
        catch (err) { alert(err.message); }
      }
      await loadAttachments(noteId);
    } catch (err) {
      alert(err.message);
    }
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
  const btnDel = document.getElementById('btn-delete-note');
  if (btnDel) btnDel.hidden = false;

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
  hideAutocomplete();
  const bar = document.getElementById('editor-mode-bar');
  if (bar) bar.hidden = true;
  const btnDel = document.getElementById('btn-delete-note');
  if (btnDel) btnDel.hidden = true;
  const attachSection = document.getElementById('attachments-section');
  if (attachSection) {
    attachSection.hidden = true;
    const list = document.getElementById('attachments-list');
    if (list) list.innerHTML = '';
  }
}

// Creates a new note if none is open, puts the editor into edit mode, and
// returns the note id. Idempotent — returns currentNoteId immediately if set.
async function ensureNote() {
  if (currentNoteId) return currentNoteId;

  const ta = document.getElementById('editor-textarea');
  const content = ta?.value || '';

  const res = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error('Erro ao criar nota.');
  const note = await res.json();

  currentNoteId = note.id;

  const bar = document.getElementById('editor-mode-bar');
  if (bar) bar.hidden = false;
  const label = document.getElementById('editor-mode-label');
  if (label) label.textContent = `Editando nota #${note.id}`;
  const btnDel = document.getElementById('btn-delete-note');
  if (btnDel) btnDel.hidden = false;
  const attachSection = document.getElementById('attachments-section');
  if (attachSection) attachSection.hidden = false;

  document.dispatchEvent(new CustomEvent('note:saved'));
  return note.id;
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

// ─── Smart list continuation ─────────────────────────────────────────────────
function handleSmartList(ta) {
  const pos = ta.selectionStart;
  if (ta.selectionEnd !== pos) return false;

  const text = ta.value;
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
  const currentLine = text.slice(lineStart, pos);

  const bulletMatch = currentLine.match(/^(\s*)([-*]) (.*)/);
  if (bulletMatch) {
    const [, indent, bullet, content] = bulletMatch;
    if (!content.trim()) {
      ta.value = text.slice(0, lineStart) + text.slice(pos);
      ta.setSelectionRange(lineStart, lineStart);
      autoResize(ta); updateTagsPreview(ta.value); return true;
    }
    const insert = '\n' + indent + bullet + ' ';
    ta.value = text.slice(0, pos) + insert + text.slice(ta.selectionEnd);
    const np = pos + insert.length;
    ta.setSelectionRange(np, np);
    autoResize(ta); updateTagsPreview(ta.value); return true;
  }

  const orderedMatch = currentLine.match(/^(\s*)(\d+)\. (.*)/);
  if (orderedMatch) {
    const [, indent, numStr, content] = orderedMatch;
    if (!content.trim()) {
      ta.value = text.slice(0, lineStart) + text.slice(pos);
      ta.setSelectionRange(lineStart, lineStart);
      autoResize(ta); updateTagsPreview(ta.value); return true;
    }
    const insert = '\n' + indent + (parseInt(numStr, 10) + 1) + '. ';
    ta.value = text.slice(0, pos) + insert + text.slice(ta.selectionEnd);
    const np = pos + insert.length;
    ta.setSelectionRange(np, np);
    autoResize(ta); updateTagsPreview(ta.value); return true;
  }

  return false;
}

// ─── Tag autocomplete ────────────────────────────────────────────────────────
function handleAutocomplete(ta) {
  const pos = ta.selectionStart;
  const before = ta.value.slice(0, pos);
  const match = before.match(/#([a-zA-Z0-9_\u00C0-\u024F]*)$/);

  if (!match) { hideAutocomplete(); return; }

  const partial = match[1].toLowerCase();
  const allTags = getTags();
  const candidates = allTags.filter(t =>
    t.name.startsWith(partial) && t.name !== partial
  );

  if (!candidates.length) { hideAutocomplete(); return; }

  const tagStart = pos - match[0].length;
  showAutocomplete(candidates, ta, tagStart);
}

function showAutocomplete(candidates, ta, tagStart) {
  const ac = document.getElementById('tag-autocomplete');
  if (!ac) return;

  acSelectedIndex = -1;

  ac.innerHTML = candidates.slice(0, 8).map((t, i) => {
    const dotStyle = t.color ? `background:${t.color}` : '';
    return `<div class="tag-ac-item" data-name="${escHtml(t.name)}" data-index="${i}">
      <span class="tag-ac-dot" style="${dotStyle}"></span>
      <span>#${escHtml(t.name)}</span>
      <span class="tag-ac-count">${t.count}</span>
    </div>`;
  }).join('');

  // Position below the editor box (relative to #content-col which is position:relative)
  const box = document.getElementById('editor-box');
  if (box) {
    ac.style.top = (box.offsetTop + box.offsetHeight) + 'px';
    ac.style.left = '0';
    ac.style.right = '0';
    ac.style.width = '';
  }
  ac.hidden = false;

  ac.querySelectorAll('.tag-ac-item').forEach((item, i) => {
    item.addEventListener('mousedown', e => {
      e.preventDefault(); // don't blur textarea
      acSelectedIndex = i;
      acConfirm(ta);
    });
    item.addEventListener('mouseover', () => {
      acSelectedIndex = i;
      acUpdateSelection();
    });
  });

  // Store tagStart for confirmation
  ac.dataset.tagStart = tagStart;
}

function acMove(dir) {
  const ac = document.getElementById('tag-autocomplete');
  if (!ac) return;
  const items = ac.querySelectorAll('.tag-ac-item');
  acSelectedIndex = Math.max(-1, Math.min(items.length - 1, acSelectedIndex + dir));
  acUpdateSelection();
}

function acUpdateSelection() {
  const ac = document.getElementById('tag-autocomplete');
  if (!ac) return;
  ac.querySelectorAll('.tag-ac-item').forEach((item, i) => {
    item.classList.toggle('ac-active', i === acSelectedIndex);
  });
}

function acConfirm(ta) {
  const ac = document.getElementById('tag-autocomplete');
  if (!ac || ac.hidden || acSelectedIndex < 0) return;

  const item = ac.querySelectorAll('.tag-ac-item')[acSelectedIndex];
  if (!item) return;

  const tagName = item.dataset.name;
  const tagStart = parseInt(ac.dataset.tagStart, 10);
  const pos = ta.selectionStart;

  ta.value = ta.value.slice(0, tagStart) + '#' + tagName + ta.value.slice(pos);
  const newPos = tagStart + 1 + tagName.length;
  ta.setSelectionRange(newPos, newPos);

  hideAutocomplete();
  autoResize(ta);
  updateTagsPreview(ta.value);
  ta.focus();
}

function hideAutocomplete() {
  const ac = document.getElementById('tag-autocomplete');
  if (ac) { ac.hidden = true; ac.innerHTML = ''; }
  acSelectedIndex = -1;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function autoResize(ta) {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
}

function updateTagsPreview(content) {
  const container = document.getElementById('editor-tags-preview');
  if (!container) return;
  const tags = [...new Set((content.match(/#([a-zA-Z0-9_\u00C0-\u024F]+)/g) || []))].map(t => t.slice(1));
  container.innerHTML = tags.map(t => `<span class="editor-tag-pill">#${escHtml(t)}</span>`).join('');
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
    code:    ['```\n', '\n```', 'código'],
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

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
