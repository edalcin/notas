import { loadNotes } from './notes.js';
import { loadHashtags, clearFilter } from './hashtags.js';
import { initTheme, toggleTheme } from './theme.js';
import { initEditor, loadNoteForEdit } from './editor.js';
import { openHashtagManager, closeHashtagManager } from './hashtags.js';
import { loadAttachmentsView, onAttachmentDeleted } from './attachments-view.js';
import { loadTrash, initTrash } from './trash.js';
import { loadSharedNotes } from './shared.js';

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
// The SW stores share data (query params + files in Cache) and redirects here.
async function handleIncomingShare() {
  const params = new URLSearchParams(location.search);
  const content = params.get('share_content') || '';
  const hasFiles = params.get('share_files') === '1';
  if (!content && !hasFiles) return;

  // Clean share params from URL without triggering a reload
  history.replaceState(null, '', '/');

  if (hasFiles) {
    try {
      const cache = await caches.open('notas-share-pending');
      const keys = await cache.keys();
      if (keys.length > 0) {
        // Create note first so we have an ID to attach files to
        const noteRes = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: content || '📷 Arquivo compartilhado' }),
        });
        if (!noteRes.ok) throw new Error('create note failed');
        const note = await noteRes.json();

        for (const req of keys) {
          const cached = await cache.match(req);
          if (!cached) continue;
          const blob = await cached.blob();
          const rawName = cached.headers.get('X-File-Name') || new URL(req.url).pathname.split('/').pop();
          const file = new File([blob], decodeURIComponent(rawName), { type: blob.type });
          const fd = new FormData();
          fd.append('file', file);
          await fetch(`/api/notes/${note.id}/attachments`, { method: 'POST', body: fd });
        }
        await Promise.all(keys.map(k => cache.delete(k)));

        // Open the note in the editor so the user can review before saving
        loadNoteForEdit(note.id);
        document.dispatchEvent(new CustomEvent('note:saved'));
        return;
      }
    } catch (err) {
      console.error('[share] file upload error:', err);
    }
  }

  // Text / URL share: pre-fill the editor textarea for user review
  const ta = document.getElementById('editor-textarea');
  if (content && ta) {
    ta.value = content;
    ta.dispatchEvent(new Event('input')); // triggers autoResize + tag preview
    ta.focus();
  }
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
}

function showAttachmentsView() {
  document.getElementById('editor-box').hidden = true;
  document.getElementById('notes-feed').hidden = true;
  document.getElementById('attachments-view').hidden = false;
  document.getElementById('shared-view').hidden = true;
  document.getElementById('trash-view').hidden = true;
  loadAttachmentsView();
}

function showSharedView() {
  document.getElementById('editor-box').hidden = true;
  document.getElementById('notes-feed').hidden = true;
  document.getElementById('attachments-view').hidden = true;
  document.getElementById('shared-view').hidden = false;
  document.getElementById('trash-view').hidden = true;
  loadSharedNotes();
}

function showTrashView() {
  document.getElementById('editor-box').hidden = true;
  document.getElementById('notes-feed').hidden = true;
  document.getElementById('attachments-view').hidden = true;
  document.getElementById('shared-view').hidden = true;
  document.getElementById('trash-view').hidden = false;
  loadTrash();
}
