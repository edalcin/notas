import { loadNotes } from './notes.js';
import { setTags } from './tagStore.js';

// Predefined color palette (lowercase hex)
const PALETTE = [
  '#6b7280', // cinza
  '#ef4444', // vermelho
  '#f97316', // laranja
  '#eab308', // amarelo
  '#22c55e', // verde
  '#14b8a6', // teal
  '#3b82f6', // azul
  '#6366f1', // índigo
  '#8b5cf6', // violeta
  '#ec4899', // rosa
  '#0ea5e9', // azul-claro
  '#a78bfa', // lavanda
];

let activeHashtag = '';

export async function loadHashtags() {
  try {
    const res = await fetch('/api/hashtags');
    const data = await res.json();
    const hashtags = data.hashtags || [];
    setTags(hashtags);
    renderHashtagList(hashtags);
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
    const colorStyle = ht.color ? `style="color:${ht.color}"` : '';
    const countStr = ht.count > 1 ? `<span class="hashtag-count-inline">(${ht.count})</span>` : '';
    return `<li><button class="hashtag-item ${active}" data-hashtag="${esc(ht.name)}" ${colorStyle}>#&nbsp;${esc(ht.name)}${countStr}</button></li>`;
  }).join('');

  list.querySelectorAll('.hashtag-item').forEach(btn =>
    btn.addEventListener('click', () => setActiveHashtag(btn.dataset.hashtag))
  );
}

export function setActiveHashtag(name) {
  activeHashtag = name;
  document.querySelectorAll('#sidebar-nav .nav-item').forEach(n => n.classList.remove('active'));
  loadHashtags();
  loadNotes({ hashtag: name });
}

export function clearFilter() {
  activeHashtag = '';
  document.getElementById('btn-all-notes')?.classList.add('active');
  loadHashtags();
  loadNotes({});
}

// ─── Tag Manager Modal ──────────────────────────────────────────────────────

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
    setTags(hashtags);

    if (!hashtags.length) {
      container.innerHTML = '<p class="tag-manager-empty">Nenhuma tag ainda.</p>';
      return;
    }

    container.innerHTML = hashtags.map(tagRowHTML).join('');
    bindTagManagerEvents(container);
  } catch (err) {
    console.error('renderHashtagManagerContent error:', err);
  }
}

function tagRowHTML(ht) {
  const dotStyle = ht.color ? `background:${ht.color}` : '';
  return `<div class="tag-manager-row" data-name="${esc(ht.name)}">
    <div class="tag-row-main">
      <span class="tag-manager-dot" style="${dotStyle}"></span>
      <span class="tag-manager-name">#${esc(ht.name)}</span>
      <span class="tag-manager-count">${ht.count} nota${ht.count !== 1 ? 's' : ''}</span>
      <div class="tag-manager-actions">
        <button class="btn-tag-color btn-icon-sm" data-name="${esc(ht.name)}" title="Cor">🎨</button>
        <button class="btn-tag-rename btn-icon-sm" data-name="${esc(ht.name)}" title="Renomear">✏️</button>
        <button class="btn-tag-delete btn-icon-sm" data-name="${esc(ht.name)}" title="Excluir">🗑️</button>
      </div>
    </div>
    <div class="tag-color-picker" hidden></div>
    <div class="tag-rename-form" hidden></div>
  </div>`;
}

function bindTagManagerEvents(container) {
  container.querySelectorAll('.btn-tag-rename').forEach(btn =>
    btn.addEventListener('click', () => showRenameForm(container, btn.dataset.name))
  );
  container.querySelectorAll('.btn-tag-delete').forEach(btn =>
    btn.addEventListener('click', () => deleteHashtag(btn.dataset.name))
  );
  container.querySelectorAll('.btn-tag-color').forEach(btn =>
    btn.addEventListener('click', () => toggleColorPicker(container, btn.dataset.name))
  );
}

function showRenameForm(container, name) {
  const row = container.querySelector(`[data-name="${CSS.escape(name)}"]`);
  if (!row) return;

  // Close any open color pickers
  closeAllPickers(container);

  const form = row.querySelector('.tag-rename-form');
  if (!form || !form.hidden) return;
  form.hidden = false;
  form.innerHTML = `
    <div class="rename-form-inner">
      <input class="modal-hashtag-input rename-input" type="text" value="${esc(name)}" placeholder="Novo nome" aria-label="Novo nome">
      <button class="btn-primary btn-sm btn-confirm-rename">OK</button>
      <button class="btn-icon-sm btn-cancel-rename" title="Cancelar">✕</button>
    </div>`;

  const input = form.querySelector('.rename-input');
  input.focus(); input.select();

  form.querySelector('.btn-confirm-rename').addEventListener('click', () =>
    renameHashtag(container, name, input.value.trim())
  );
  form.querySelector('.btn-cancel-rename').addEventListener('click', () => {
    form.hidden = true; form.innerHTML = '';
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') renameHashtag(container, name, input.value.trim());
    if (e.key === 'Escape') { form.hidden = true; form.innerHTML = ''; }
  });
}

function toggleColorPicker(container, name) {
  const row = container.querySelector(`[data-name="${CSS.escape(name)}"]`);
  if (!row) return;

  // Close rename forms
  container.querySelectorAll('.tag-rename-form:not([hidden])').forEach(f => { f.hidden = true; f.innerHTML = ''; });

  const picker = row.querySelector('.tag-color-picker');
  if (!picker) return;

  if (!picker.hidden) {
    picker.hidden = true; picker.innerHTML = ''; return;
  }

  // Close other pickers
  container.querySelectorAll('.tag-color-picker:not([hidden])').forEach(p => { p.hidden = true; p.innerHTML = ''; });

  const currentColor = row.querySelector('.tag-manager-dot')?.style.background || '';

  picker.innerHTML = `
    <div class="color-picker-grid">
      <button class="color-swatch color-swatch-none ${!currentColor ? 'selected' : ''}" data-color="" title="Sem cor">✕</button>
      ${PALETTE.map(c => `
        <button class="color-swatch ${currentColor === c ? 'selected' : ''}"
          data-color="${c}" style="background:${c}" title="${c}"></button>
      `).join('')}
    </div>`;
  picker.hidden = false;

  picker.querySelectorAll('.color-swatch').forEach(swatch =>
    swatch.addEventListener('click', async () => {
      await updateHashtagColor(name, swatch.dataset.color);
      picker.hidden = true; picker.innerHTML = '';
    })
  );
}

function closeAllPickers(container) {
  container.querySelectorAll('.tag-color-picker:not([hidden])').forEach(p => { p.hidden = true; p.innerHTML = ''; });
}

// ─── API calls ──────────────────────────────────────────────────────────────

async function renameHashtag(container, oldName, newName) {
  if (!newName || newName === oldName) {
    const row = container.querySelector(`[data-name="${CSS.escape(oldName)}"]`);
    const form = row?.querySelector('.tag-rename-form');
    if (form) { form.hidden = true; form.innerHTML = ''; }
    return;
  }
  try {
    const res = await fetch(`/api/hashtags/${encodeURIComponent(oldName)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_name: newName }),
    });
    if (res.status === 409) { alert('Já existe uma tag com esse nome.'); return; }
    if (res.status === 404) { alert('Tag não encontrada.'); return; }
    if (!res.ok) throw new Error('Rename failed');
    if (activeHashtag === oldName) activeHashtag = newName;
    await loadHashtags();
    await loadNotes(activeHashtag ? { hashtag: activeHashtag } : {});
    renderHashtagManagerContent();
  } catch (err) {
    console.error('renameHashtag error:', err);
    alert('Erro ao renomear tag.');
  }
}

async function updateHashtagColor(name, color) {
  try {
    const res = await fetch(`/api/hashtags/${encodeURIComponent(name)}/color`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color }),
    });
    if (!res.ok) throw new Error('Color update failed');
    await loadHashtags();
    await loadNotes(activeHashtag ? { hashtag: activeHashtag } : {});
    renderHashtagManagerContent();
  } catch (err) {
    console.error('updateHashtagColor error:', err);
    alert('Erro ao atualizar cor da tag.');
  }
}

async function deleteHashtag(name) {
  if (!confirm(`Excluir a tag #${name} de todas as notas?`)) return;
  try {
    const res = await fetch(`/api/hashtags/${encodeURIComponent(name)}`, { method: 'DELETE' });
    if (res.status === 404) { alert('Tag não encontrada.'); return; }
    if (!res.ok) throw new Error('Delete failed');
    if (activeHashtag === name) activeHashtag = '';
    await loadHashtags();
    await loadNotes(activeHashtag ? { hashtag: activeHashtag } : {});
    renderHashtagManagerContent();
  } catch (err) {
    console.error('deleteHashtag error:', err);
    alert('Erro ao excluir tag.');
  }
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
