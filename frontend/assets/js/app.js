import { loadNotes } from './notes.js';
import { loadHashtags, clearFilter } from './hashtags.js';
import { initTheme, toggleTheme } from './theme.js';
import { initEditor, loadNoteForEdit } from './editor.js';
import { openHashtagManager, closeHashtagManager } from './hashtags.js';
import { loadAttachmentsView, onAttachmentDeleted } from './attachments-view.js';
import { loadTrash, initTrash } from './trash.js';
import { loadSharedNotes } from './shared.js';
import { initBackup } from './backup.js';

// Open all markdown links in a new tab
marked.use({
  renderer: {
    link({ href, title, text }) {
      return `<a href="${href}"${title ? ` title="${title}"` : ''} target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  },
});

// Register SW as early as possible so update checks happen on every launch,
// including when opened from a home-screen icon (PWA standalone mode).
// Also listen for SW_UPDATED messages so the page reloads after a new SW
// activates — without this, skipWaiting() hands control to the new SW but
// the old JS bundle is still running in memory.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'SW_UPDATED') window.location.reload();
  });
  navigator.serviceWorker.register('/sw.js').then(reg => {
    // Force an immediate update check. Browsers in standalone PWA mode may
    // delay the routine check; calling update() here ensures each launch
    // fetches the latest sw.js and installs a new SW if the file changed.
    reg.update().catch(() => {});
  }).catch(() => {});
}

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();

  const authenticated = await checkAuth();
  if (!authenticated) {
    showPINOverlay();
    return;
  }

  initApp();
});

// Cross-module events — safe to register early; they only fire from user actions inside the app
document.addEventListener('note:saved', () => { loadNotes(); loadHashtags(); });
document.addEventListener('note:deleted', () => { loadNotes(); loadHashtags(); });
document.addEventListener('note:edit', e => loadNoteForEdit(e.detail.id));
document.addEventListener('note:tag-click', e => {
  import('./hashtags.js').then(m => m.setActiveHashtag(e.detail.tag));
});

async function initApp() {
  initEditor();
  initTrash();
  initBackup();
  await loadHashtags(); // load tags first so colors are available when notes render
  loadNotes();
  bindUI();
  onAttachmentDeleted(() => loadNotes()); // refresh note badges after global delete

  document.addEventListener('hashtag:selected', e => {
    if (!document.getElementById('attachments-view').hidden) {
      loadAttachmentsView(e.detail.tag);
    }
  });

  await handleIncomingShare();
}

// Handles content arriving via the Web Share Target API.
// The SW creates the note and redirects here with ?share_edit=<id>.
async function handleIncomingShare() {
  const params = new URLSearchParams(location.search);
  const noteId = parseInt(params.get('share_edit'), 10);
  if (!noteId) return;

  history.replaceState(null, '', '/');
  loadNoteForEdit(noteId);
  document.dispatchEvent(new CustomEvent('note:saved'));
}

async function checkAuth() {
  try {
    const res = await fetch('/api/notes?limit=1');
    return res.status !== 401;
  } catch {
    return true; // network error — proceed and let API calls fail naturally
  }
}

function showPINOverlay() {
  const overlay = document.getElementById('pin-overlay');
  if (!overlay) return;
  overlay.hidden = false;

  const input = document.getElementById('pin-input');
  const errorEl = document.getElementById('pin-error');
  input?.focus();

  async function submit() {
    if (errorEl) errorEl.hidden = true;
    const pin = input?.value ?? '';
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        overlay.hidden = true;
        initApp();
      } else {
        if (errorEl) errorEl.hidden = false;
        input?.select();
      }
    } catch {
      if (errorEl) { errorEl.textContent = 'Erro de conexão'; errorEl.hidden = false; }
    }
  }

  document.getElementById('btn-pin-submit')?.addEventListener('click', submit);
  input?.addEventListener('keydown', e => {
    if (e.key === 'Enter') submit();
    if (errorEl) errorEl.hidden = true;
  });
}

function bindUI() {
  document.getElementById('btn-theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById('btn-manage-hashtags')?.addEventListener('click', openHashtagManager);
  document.getElementById('btn-close-modal')?.addEventListener('click', closeHashtagManager);
  document.getElementById('modal-hashtags')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeHashtagManager();
  });
  document.getElementById('btn-all-notes')?.addEventListener('click', () => {
    setActiveNav(document.getElementById('btn-all-notes'));
    showNotesView();
    clearFilter();
  });

  document.getElementById('btn-attachments')?.addEventListener('click', () => {
    setActiveNav(document.getElementById('btn-attachments'));
    showAttachmentsView();
  });

  document.getElementById('btn-shared-notes')?.addEventListener('click', () => {
    setActiveNav(document.getElementById('btn-shared-notes'));
    showSharedView();
  });

  document.getElementById('btn-trash')?.addEventListener('click', () => {
    setActiveNav(document.getElementById('btn-trash'));
    showTrashView();
  });

  document.getElementById('btn-backup')?.addEventListener('click', () => {
    setActiveNav(document.getElementById('btn-backup'));
    showBackupView();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('modal-confirm');
      if (modal && !modal.hidden) modal.hidden = true;
    }
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

  // Search (now in sidebar — binds by ID regardless of position)
  let searchTimer = null;
  document.getElementById('search-input')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    searchTimer = setTimeout(() => loadNotes(q ? { q } : {}), 300);
  });

}

export function setActiveNav(el) {
  document.querySelectorAll('#sidebar-nav .nav-item, #hashtag-list .hashtag-item').forEach(n => n.classList.remove('active'));
  el?.classList.add('active');
}

function showNotesView() {
  document.getElementById('editor-box').hidden = false;
  document.getElementById('notes-feed').hidden = false;
  document.getElementById('attachments-view').hidden = true;
  document.getElementById('shared-view').hidden = true;
  document.getElementById('trash-view').hidden = true;
  document.getElementById('backup-view').hidden = true;
}

function showAttachmentsView() {
  document.getElementById('editor-box').hidden = true;
  document.getElementById('notes-feed').hidden = true;
  document.getElementById('attachments-view').hidden = false;
  document.getElementById('shared-view').hidden = true;
  document.getElementById('trash-view').hidden = true;
  document.getElementById('backup-view').hidden = true;
  loadAttachmentsView();
}

function showSharedView() {
  document.getElementById('editor-box').hidden = true;
  document.getElementById('notes-feed').hidden = true;
  document.getElementById('attachments-view').hidden = true;
  document.getElementById('shared-view').hidden = false;
  document.getElementById('trash-view').hidden = true;
  document.getElementById('backup-view').hidden = true;
  loadSharedNotes();
}

function showTrashView() {
  document.getElementById('editor-box').hidden = true;
  document.getElementById('notes-feed').hidden = true;
  document.getElementById('attachments-view').hidden = true;
  document.getElementById('shared-view').hidden = true;
  document.getElementById('trash-view').hidden = false;
  document.getElementById('backup-view').hidden = true;
  loadTrash();
}

function showBackupView() {
  document.getElementById('editor-box').hidden = true;
  document.getElementById('notes-feed').hidden = true;
  document.getElementById('attachments-view').hidden = true;
  document.getElementById('shared-view').hidden = true;
  document.getElementById('trash-view').hidden = true;
  document.getElementById('backup-view').hidden = false;
}
