function buildContent({ title, text, url }) {
  const parts = [];
  if (title) parts.push(`## ${title}`);
  if (text) parts.push(text);
  if (url && !(text || '').includes(url)) parts.push(url);
  const content = parts.join('\n');
  return content ? content + '\n#chrome' : '';
}

async function createNote(content) {
  const { serverUrl, token } = await chrome.storage.local.get(['serverUrl', 'token']);
  if (!serverUrl) { chrome.runtime.openOptionsPage(); throw new Error('not-configured'); }
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${serverUrl}/api/notes`, {
    method: 'POST', headers, body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`http-${res.status}`);
  return res.json();
}

function flashBadge(ok) {
  chrome.action.setBadgeBackgroundColor({ color: ok ? '#22c55e' : '#ef4444' });
  chrome.action.setBadgeText({ text: ok ? '\u2713' : '!' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2500);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'send-to-notas',
    title: 'Enviar para Notas',
    contexts: ['page', 'selection', 'link'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'send-to-notas') return;
  const url = info.linkUrl || info.pageUrl || (tab && tab.url) || '';
  const content = buildContent({ title: tab && tab.title, text: info.selectionText || '', url });
  if (!content) { flashBadge(false); return; }
  try { await createNote(content); flashBadge(true); }
  catch (_) { flashBadge(false); }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'createNote') {
    const content = buildContent(msg.parts || {});
    if (!content) { sendResponse({ ok: false, error: 'empty' }); return; }
    createNote(content).then(
      (note) => sendResponse({ ok: true, note }),
      (err) => sendResponse({ ok: false, error: String(err.message || err) }),
    );
    return true; // resposta assíncrona
  }
});
