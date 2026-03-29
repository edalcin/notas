import { loadNotes, createNote } from './notes.js';
import { loadHashtags, clearFilter, openHashtagManager, closeHashtagManager } from './hashtags.js';
import { initTheme, toggleTheme } from './theme.js';
import { initEditor, saveNote, destroyEditor } from './editor.js';

let currentView = 'list';

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  bindButtons();
  bindSearch();
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
  registerServiceWorker();
});

function bindButtons() {
  document.getElementById('btn-theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById('btn-new-note')?.addEventListener('click', createNote);
  document.getElementById('btn-empty-new')?.addEventListener('click', createNote);
  document.getElementById('btn-manage-hashtags')?.addEventListener('click', openHashtagManager);
  document.getElementById('btn-close-modal')?.addEventListener('click', closeHashtagManager);
  document.getElementById('modal-hashtags')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeHashtagManager();
  });

  document.getElementById('btn-sidebar-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  document.getElementById('btn-back')?.addEventListener('click', () => {
    window.location.hash = '#list';
  });

  document.getElementById('btn-save')?.addEventListener('click', saveNote);

  document.getElementById('btn-delete-note')?.addEventListener('click', async () => {
    const hash = window.location.hash;
    const match = hash.match(/^#note\/(\d+)/);
    if (!match) return;
    const id = Number(match[1]);
    if (!confirm('Excluir esta nota? Esta ação não pode ser desfeita.')) return;
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    destroyEditor();
    window.location.hash = '#list';
  });

  document.getElementById('btn-toggle-pin')?.addEventListener('click', async () => {
    const hash = window.location.hash;
    const match = hash.match(/^#note\/(\d+)/);
    if (!match) return;
    const id = Number(match[1]);
    const btn = document.getElementById('btn-toggle-pin');
    const pinned = btn.dataset.pinned !== 'true';
    await fetch(`/api/notes/${id}/pin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned }),
    });
    btn.dataset.pinned = pinned ? 'true' : 'false';
    btn.title = pinned ? 'Desafixar nota' : 'Fixar nota';
  });
}

let searchTimer = null;
function bindSearch() {
  const input = document.getElementById('search-input');
  if (!input) return;
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const val = input.value.trim();
    searchTimer = setTimeout(() => {
      loadNotes(val ? { q: val } : {});
    }, 300);
  });
}

async function handleRoute() {
  const hash = window.location.hash || '#list';

  if (hash.startsWith('#note/')) {
    const id = Number(hash.slice(6));
    if (id) {
      await showView('editor');
      await initEditor(id);
    } else {
      window.location.hash = '#list';
    }
  } else if (hash === '#new') {
    createNote();
  } else {
    if (currentView === 'editor') destroyEditor();
    await showView('list');
    await Promise.all([loadNotes(), loadHashtags()]);
  }
}

async function showView(view) {
  currentView = view;
  const listView = document.getElementById('view-list');
  const editorView = document.getElementById('view-editor');

  if (view === 'editor') {
    if (listView) listView.hidden = true;
    if (editorView) editorView.hidden = false;
  } else {
    if (listView) listView.hidden = false;
    if (editorView) editorView.hidden = true;
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration failed:', err);
    });
  }
}
