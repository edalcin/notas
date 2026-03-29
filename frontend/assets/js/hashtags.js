import { loadNotes } from './notes.js';

let activeHashtag = '';

export async function loadHashtags() {
  try {
    const res = await fetch('/api/hashtags');
    const data = await res.json();
    renderHashtagList(data.hashtags || []);
  } catch (err) {
    console.error('loadHashtags error:', err);
  }
}

function renderHashtagList(hashtags) {
  const list = document.getElementById('hashtag-list');
  if (!list) return;

  if (!hashtags.length) {
    list.innerHTML = '<li class="hashtag-empty">Nenhuma tag ainda</li>';
    return;
  }

  list.innerHTML = hashtags.map(ht => {
    const active = ht.name === activeHashtag ? 'active' : '';
    return `<li><button class="hashtag-item ${active}" data-hashtag="${esc(ht.name)}">
      #${esc(ht.name)}<span class="hashtag-count">${ht.count}</span>
    </button></li>`;
  }).join('');

  list.querySelectorAll('.hashtag-item').forEach(btn =>
    btn.addEventListener('click', () => setActiveHashtag(btn.dataset.hashtag))
  );
}

export function setActiveHashtag(name) {
  activeHashtag = name;
  // Clear the "All notes" nav active state
  document.querySelectorAll('#sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
  loadHashtags(); // re-renders with updated active state
  loadNotes({ hashtag: name });
}

export function clearFilter() {
  activeHashtag = '';
  document.getElementById('btn-all-notes')?.classList.add('active');
  loadHashtags();
  loadNotes({});
}

export function openHashtagManager() {
  const modal = document.getElementById('modal-hashtags');
  if (!modal) return;
  modal.hidden = false;
  renderHashtagManagerContent();
}

export function closeHashtagManager() {
  const modal = document.getElementById('modal-hashtags');
  if (modal) modal.hidden = true;
}

async function renderHashtagManagerContent() {
  const container = document.getElementById('modal-hashtags-list');
  if (!container) return;
  try {
    const res = await fetch('/api/hashtags');
    const data = await res.json();
    const hashtags = data.hashtags || [];

    if (!hashtags.length) {
      container.innerHTML = '<p style="color:var(--text-muted);padding:12px 0">Nenhuma hashtag ainda.</p>';
      return;
    }

    container.innerHTML = hashtags.map(ht => `
      <div class="modal-hashtag-row" data-name="${esc(ht.name)}">
        <span class="modal-hashtag-name">#${esc(ht.name)}</span>
        <span class="modal-hashtag-count">${ht.count} nota${ht.count !== 1 ? 's' : ''}</span>
        <button class="btn-link btn-rename-hashtag" data-name="${esc(ht.name)}">Renomear</button>
        <button class="btn-icon btn-delete-hashtag" data-name="${esc(ht.name)}" title="Excluir">&times;</button>
      </div>
    `).join('');

    container.querySelectorAll('.btn-rename-hashtag').forEach(btn =>
      btn.addEventListener('click', () => startRenameHashtag(btn.dataset.name))
    );
    container.querySelectorAll('.btn-delete-hashtag').forEach(btn =>
      btn.addEventListener('click', () => deleteHashtag(btn.dataset.name))
    );
  } catch (err) {
    console.error('renderHashtagManagerContent error:', err);
  }
}

function startRenameHashtag(name) {
  const container = document.getElementById('modal-hashtags-list');
  const row = container.querySelector(`[data-name="${CSS.escape(name)}"]`);
  if (!row) return;
  row.innerHTML = `
    <input class="modal-hashtag-input" type="text" value="${esc(name)}" aria-label="Novo nome">
    <button class="btn-primary btn-confirm-rename" style="padding:5px 10px">OK</button>
    <button class="btn-icon btn-cancel-rename">Cancelar</button>
  `;
  const input = row.querySelector('.modal-hashtag-input');
  input.focus(); input.select();
  row.querySelector('.btn-confirm-rename').addEventListener('click', () => renameHashtag(name, input.value.trim()));
  row.querySelector('.btn-cancel-rename').addEventListener('click', renderHashtagManagerContent);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') renameHashtag(name, input.value.trim());
    if (e.key === 'Escape') renderHashtagManagerContent();
  });
}

async function renameHashtag(oldName, newName) {
  if (!newName || newName === oldName) { renderHashtagManagerContent(); return; }
  try {
    const res = await fetch(`/api/hashtags/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_name: newName }),
    });
    if (res.status === 409) { alert('Já existe uma hashtag com esse nome.'); return; }
    if (res.status === 404) { alert('Hashtag não encontrada.'); return; }
    if (!res.ok) throw new Error('Rename failed');
    if (activeHashtag === oldName) activeHashtag = newName;
    await loadHashtags();
    await loadNotes(activeHashtag ? { hashtag: activeHashtag } : {});
    renderHashtagManagerContent();
  } catch (err) {
    console.error('renameHashtag error:', err);
    alert('Erro ao renomear hashtag.');
  }
}

async function deleteHashtag(name) {
  if (!confirm(`Excluir #${name} de todas as notas?`)) return;
  try {
    const res = await fetch(`/api/hashtags/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (res.status === 404) { alert('Hashtag não encontrada.'); return; }
    if (!res.ok) throw new Error('Delete failed');
    if (activeHashtag === name) activeHashtag = '';
    await loadHashtags();
    await loadNotes(activeHashtag ? { hashtag: activeHashtag } : {});
    renderHashtagManagerContent();
  } catch (err) {
    console.error('deleteHashtag error:', err);
    alert('Erro ao excluir hashtag.');
  }
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
