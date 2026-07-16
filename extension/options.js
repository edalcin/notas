const serverUrlEl = document.getElementById('serverUrl');
const tokenEl = document.getElementById('token');
const statusEl = document.getElementById('status');

function status(msg) {
  statusEl.textContent = msg;
}

function normalizeUrl(u) {
  return u.trim().replace(/\/+$/, '');
}

document.addEventListener('DOMContentLoaded', async () => {
  const { serverUrl, token } = await chrome.storage.local.get(['serverUrl', 'token']);
  if (serverUrl) serverUrlEl.value = serverUrl;
  if (token) tokenEl.value = token;
});

document.getElementById('save').addEventListener('click', async () => {
  const url = normalizeUrl(serverUrlEl.value);
  let parsed;
  try {
    parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('bad-protocol');
  } catch (_) {
    status('URL inválida. Use http:// ou https://');
    return;
  }

  const origin = parsed.origin;
  const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
  if (!granted) {
    status('Permissão negada para ' + origin);
    return;
  }

  await chrome.storage.local.set({ serverUrl: url, token: tokenEl.value.trim() });
  status('Configuração salva.');
});

document.getElementById('test').addEventListener('click', async () => {
  const url = normalizeUrl(serverUrlEl.value);
  let parsed;
  try {
    parsed = new URL(url);
  } catch (_) {
    status('URL inválida.');
    return;
  }

  const origin = parsed.origin;
  const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
  if (!granted) {
    status('Permissão negada para ' + origin);
    return;
  }

  status('Testando…');
  try {
    const res = await fetch(url + '/health');
    status(res.ok ? 'Conexão OK' : `Falha (${res.status})`);
  } catch (_) {
    status('Servidor inacessível');
  }
});
