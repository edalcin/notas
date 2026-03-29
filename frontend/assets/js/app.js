import { loadNotes } from './notes.js';
import { loadHashtags, clearFilter } from './hashtags.js';
import { initTheme, toggleTheme } from './theme.js';
import { initEditor, loadNoteForEdit, resetEditor } from './editor.js';
import { openHashtagManager, closeHashtagManager } from './hashtags.js';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initEditor();
  loadNotes();
  loadHashtags();
  bindUI();
});

// Cross-module events
document.addEventListener('note:saved', () => { loadNotes(); loadHashtags(); });
document.addEventListener('note:deleted', () => { loadNotes(); loadHashtags(); });
document.addEventListener('note:edit', e => loadNoteForEdit(e.detail.id));
document.addEventListener('note:tag-click', e => {
  import('./hashtags.js').then(m => m.setActiveHashtag(e.detail.tag));
});

function bindUI() {
  document.getElementById('btn-theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById('btn-manage-hashtags')?.addEventListener('click', openHashtagManager);
  document.getElementById('btn-close-modal')?.addEventListener('click', closeHashtagManager);
  document.getElementById('modal-hashtags')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeHashtagManager();
  });
  document.getElementById('btn-all-notes')?.addEventListener('click', () => {
    setActiveNav(document.getElementById('btn-all-notes'));
    clearFilter();
  });

  // Mobile sidebar
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  document.getElementById('btn-sidebar-toggle')?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
    overlay?.classList.toggle('visible');
  });
  overlay?.addEventListener('click', () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('visible');
  });

  // Search with debounce
  let searchTimer = null;
  document.getElementById('search-input')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    searchTimer = setTimeout(() => loadNotes(q ? { q } : {}), 300);
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

export function setActiveNav(el) {
  document.querySelectorAll('#sidebar-nav .nav-item, #hashtag-list .hashtag-item').forEach(n => n.classList.remove('active'));
  el?.classList.add('active');
}
