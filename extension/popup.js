document.addEventListener('DOMContentLoaded', async () => {
  const configWarning = document.getElementById('configWarning');
  const form = document.getElementById('form');
  const openOptionsBtn = document.getElementById('openOptions');
  const configLink = document.getElementById('configLink');
  const titleEl = document.getElementById('title');
  const urlEl = document.getElementById('url');
  const commentEl = document.getElementById('comment');
  const statusEl = document.getElementById('status');

  openOptionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  configLink.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  const { serverUrl } = await chrome.storage.local.get('serverUrl');
  if (!serverUrl) {
    configWarning.classList.remove('hidden');
    return;
  }
  form.classList.remove('hidden');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  titleEl.value = (tab && tab.title) || '';
  urlEl.value = (tab && tab.url) || '';

  try {
    const [r] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString(),
    });
    if (r && r.result) commentEl.value = r.result;
  } catch (_) {
    // páginas chrome:// bloqueiam scripting — ignora
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusEl.textContent = 'Salvando…';
    const parts = { title: titleEl.value, text: commentEl.value.trim(), url: urlEl.value };
    const result = await chrome.runtime.sendMessage({ type: 'createNote', parts });
    if (result && result.ok) {
      statusEl.textContent = 'Salvo!';
      setTimeout(() => window.close(), 800);
      return;
    }
    const error = result && result.error;
    if (error === 'http-401') {
      statusEl.textContent = 'Falha de autenticação: verifique o token';
    } else if (error === 'not-configured') {
      statusEl.textContent = 'Configure o servidor primeiro';
    } else {
      statusEl.textContent = `Falha ao salvar (${error || 'erro desconhecido'})`;
    }
  });
});
