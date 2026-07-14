# Extensão do Chrome para enviar links ao Notas

## Context
Criar uma extensão do Google Chrome (Manifest V3) que envia a página/link atual para o servidor Notas criando uma nova nota, via `POST /api/notes`. Disparo por **popup** (aba atual + comentário opcional + texto selecionado) e por **menu de contexto** (clique direito em página/link/seleção). O servidor Notas tem PIN opcional (`APP_PIN`); quando ativo, exige um cookie de sessão `SameSite=Lax` que uma extensão MV3 **não** envia de forma confiável. Solução: nova env var opcional `EXTENSION_TOKEN` (mesmo padrão do `PKD_TOKEN`) que o middleware aceita via `Authorization: Bearer <token>`. Fim: usuário instala a extensão (unpacked), configura URL + token na página de opções, e passa a salvar notas com um clique.

Estado final:
- Backend: `PINMiddleware` aceita um bearer token além do cookie; `EXTENSION_TOKEN` lido em `main.go`.
- Nova pasta `extension/` com a extensão MV3 completa.
- `README.md` documenta a env var e a extensão; `.dockerignore` exclui `extension/`.

## Approach

### 1. Backend — autenticação por bearer token (independente do resto; fazer primeiro)
Arquivo: `internal/handlers/auth.go`, função `PINMiddleware` (linha 94). `hmac` e `strings` já estão importados — nenhum import novo.

Mudar a assinatura para receber o token e checá-lo depois da validação do cookie e antes do 401:

```go
func PINMiddleware(pin, secret, extensionToken string, secureCookie bool) func(http.Handler) http.Handler {
	if pin == "" {
		return func(next http.Handler) http.Handler { return next }
	}
	expected := tokenForPIN(pin, secret)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/api/auth/login" || r.URL.Path == "/health" ||
				strings.HasPrefix(r.URL.Path, "/s/") {
				next.ServeHTTP(w, r)
				return
			}
			if c, err := r.Cookie(sessionCookieName); err == nil &&
				hmac.Equal([]byte(c.Value), []byte(expected)) {
				next.ServeHTTP(w, r)
				return
			}
			// Chrome extension: bearer token (não usa o cookie SameSite=Lax)
			if extensionToken != "" {
				const p = "Bearer "
				if a := r.Header.Get("Authorization"); strings.HasPrefix(a, p) &&
					hmac.Equal([]byte(a[len(p):]), []byte(extensionToken)) {
					next.ServeHTTP(w, r)
					return
				}
			}
			if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/files/") {
				w.Header().Set("Content-Type", "application/json")
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
```
- `hmac.Equal` dá comparação em tempo constante; token longo aleatório → sem risco de brute-force (por isso, sem rate-limit neste caminho).
- Atualizar o comentário-doc acima da função (linhas 91-93) mencionando o bearer token da extensão.

Arquivo: `main.go` (único callsite — confirmado por grep, os demais são docs em `specs/`):
- Após `appPIN := os.Getenv("APP_PIN")` (linha 108), adicionar: `extensionToken := os.Getenv("EXTENSION_TOKEN")`.
- Linha 182: `r.Use(handlers.PINMiddleware(appPIN, sessionSecret, extensionToken, secureCookie))`.
- Junto aos logs de startup (perto da linha 250), adicionar:
  ```go
  if extensionToken != "" {
  	log.Printf("Extension token: enabled")
  }
  ```

Semântica: `EXTENSION_TOKEN` só tem efeito quando `APP_PIN` está setado (middleware ativo). Sem PIN, a API é aberta e a extensão funciona só com a URL.

### 2. Extensão — scaffold: manifest + ícones
Nova pasta `extension/` na raiz. Copiar `frontend/assets/icon-192.png` e `frontend/assets/icon-512.png` para `extension/icons/icon-192.png` e `extension/icons/icon-512.png` (reuso dos ícones existentes; Chrome reescala para a toolbar).

`extension/manifest.json`:
```json
{
  "manifest_version": 3,
  "name": "Notas — Enviar link",
  "version": "1.0.0",
  "description": "Envia a página ou link atual para o Notas como nova nota.",
  "action": {
    "default_popup": "popup.html",
    "default_title": "Enviar para Notas",
    "default_icon": { "192": "icons/icon-192.png", "512": "icons/icon-512.png" }
  },
  "background": { "service_worker": "background.js" },
  "options_page": "options.html",
  "permissions": ["activeTab", "contextMenus", "storage", "scripting"],
  "optional_host_permissions": ["http://*/*", "https://*/*"],
  "icons": { "192": "icons/icon-192.png", "512": "icons/icon-512.png" }
}
```
Justificativa das permissões (mínimo privilégio): `activeTab` (ler aba ativa + executeScript sob gesto do usuário), `contextMenus`, `storage` (config), `scripting` (ler seleção da aba no popup). `optional_host_permissions` amplo mas **não concedido** até o usuário salvar as opções — aí concede-se só a origem do servidor configurado (passo 5). Service worker clássico (sem `"type":"module"`).

### 3. Extensão — service worker (`extension/background.js`)
Fonte única da lógica de formatação e rede. Depende do passo 2.

```js
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
```
Formato do conteúdo espelha `handleShareTarget` em `frontend/sw.js:125` (título como `## `, texto, URL sem duplicar), trocando a tag `#android` por `#chrome`.

### 4. Extensão — popup (`popup.html`, `popup.js`, `popup.css`)
Depende dos passos 2–3. MV3 proíbe script inline → todo JS em `popup.js` externo, sem handlers inline.

`popup.html`: campos read-only de título e URL da aba, `<textarea id="comment">` para comentário, botão `Salvar no Notas`, `<div id="status">`, e link "Configurar" que chama options. Carrega `popup.css` e `popup.js`.

`popup.js` (`DOMContentLoaded`):
- `const { serverUrl } = await chrome.storage.local.get('serverUrl')`. Se vazio → esconder o form, mostrar aviso "Configure o servidor" + botão que chama `chrome.runtime.openOptionsPage()`.
- Caso configurado: obter aba com `const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })`; preencher título (`tab.title`) e URL (`tab.url`).
- Pré-carregar seleção da página no textarea:
  ```js
  try {
    const [r] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString(),
    });
    if (r && r.result) commentEl.value = r.result;
  } catch (_) { /* páginas chrome:// bloqueiam scripting — ignora */ }
  ```
- Botão Salvar: monta `parts = { title: tab.title, text: commentEl.value.trim(), url: tab.url }`, envia `chrome.runtime.sendMessage({ type: 'createNote', parts })`, mostra status; em `ok` → status "Salvo!" e `setTimeout(() => window.close(), 800)`; em erro `http-401` → "Falha de autenticação: verifique o token"; outros → "Falha ao salvar (<erro>)".

`popup.css`: estilo mínimo (largura ~320px, fontes do sistema).

### 5. Extensão — página de opções (`options.html`, `options.js`)
Depende do passo 2. Sem script inline.

`options.html`: input `#serverUrl` (ex.: `https://notas.exemplo.com`), input `#token` (opcional; "necessário se o servidor usa PIN"), botão `#save`, botão `#test`, `<div id="status">`.

`options.js`:
- Load: preencher inputs a partir de `chrome.storage.local.get(['serverUrl','token'])`.
- `normalizeUrl(u)`: `u.trim().replace(/\/+$/, '')`. Validar com `new URL(url)` e exigir protocolo `http:`/`https:`; senão status de erro e abortar.
- Salvar:
  ```js
  const origin = new URL(url).origin;
  const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
  if (!granted) { status('Permissão negada para ' + origin); return; }
  await chrome.storage.local.set({ serverUrl: url, token: tokenEl.value.trim() });
  status('Configuração salva.');
  ```
- Testar: garantir permissão (`chrome.permissions.request` para a origem), então `fetch(url + '/health')`; `res.ok` → "Conexão OK"; senão "Falha (<status>)"; catch → "Servidor inacessível". `/health` é isento de PIN e não exige token (confirmado em `auth.go:102`), então testa só conectividade/permissão.

### 6. Docs e higiene do Docker
- `README.md`: adicionar linha na tabela de env vars (após `PKD_TOKEN`, linha ~60): `| EXTENSION_TOKEN | — | (desativado) | Token secreto para a extensão do Chrome autenticar via header Authorization: Bearer. Necessário apenas se APP_PIN estiver configurado. |`. Adicionar seção `## Extensão do Chrome` explicando: gerar um token aleatório, setar `EXTENSION_TOKEN`, carregar `extension/` unpacked em `chrome://extensions` (modo desenvolvedor), configurar URL + token nas opções. Adicionar entrada no Changelog.
- `.dockerignore`: adicionar linha `extension/` para manter a pasta fora do contexto de build (o binário final já não a inclui; isto evita copiá-la para o estágio builder).

## Critical files & anchors
- `internal/handlers/auth.go` — `PINMiddleware` (linha 94) e comentário-doc (91-93); `sessionCookieName`/`tokenForPIN` (73-89) mostram o padrão de comparação; `hmac` já importado.
- `main.go` — linha 108 (`appPIN`), linha 182 (único callsite de `PINMiddleware`), logs ~250.
- `frontend/sw.js` — `handleShareTarget` (linha 125): formato de conteúdo a espelhar (`## título`, texto, URL, tag).
- `internal/db/notes.go` — `CreateNote` (linha 174): confirma que só `content` é necessário; hashtags/preview derivados.
- `.dockerignore` — adicionar `extension/`.

## Verification
Backend (executável neste ambiente):
1. `go build ./...` e `go test ./...` — devem passar (nenhum teste referencia `PINMiddleware`; só o callsite em `main.go` muda).
2. Rodar com PIN + token:
   ```
   DB_PATH=/tmp/n.db FILES_PATH=/tmp/nf APP_PIN=1234 EXTENSION_TOKEN=segredo123 go run .
   ```
   - Nova nota com token válido → **201 + JSON**:
     `curl -s -o /dev/null -w "%{http_code}" -X POST localhost:8080/api/notes -H "Content-Type: application/json" -H "Authorization: Bearer segredo123" -d "{\"content\":\"## Teste\nhttp://exemplo\n#chrome\"}"` → `201`.
   - Sem header → `401`: mesmo curl sem `-H "Authorization..."`.
   - Token errado → `401`: `-H "Authorization: Bearer errado"`.
   - Confirmar corpo: repetir o request 201 sem `-o /dev/null` e ver o JSON da nota com `hashtags` contendo `chrome`.
3. Sem PIN (`APP_PIN` vazio): o mesmo POST sem header → `201` (API aberta).

Extensão (manual no Chrome — passos exatos):
4. `chrome://extensions` → ativar "Modo do desenvolvedor" → "Carregar sem compactação" → selecionar `extension/`.
5. Abrir Opções da extensão → preencher URL do servidor + token → Salvar (conceder permissão no prompt) → clicar Testar → esperar "Conexão OK".
6. Numa página qualquer, clicar no ícone da extensão → popup mostra título/URL → digitar comentário → "Salvar no Notas" → badge `✓` verde e popup fecha. Verificar no Notas web que a nota apareceu com `## <título>`, o comentário, a URL e a tag `#chrome`.
7. Clique direito num link → "Enviar para Notas" → badge `✓`. Verificar nota criada com a URL **do link** e tag `#chrome`.
8. Selecionar texto numa página → clique direito → "Enviar para Notas" → nota inclui o texto selecionado.

## Assumptions & contingencies
- **Tag `#chrome`** escolhida para marcar/filtrar essas notas (espelha `#android` do Web Share Target). Se preferir outra, trocar a string em `buildContent`.
- **`chrome.storage.local`** (não `sync`) para não replicar o token na conta Google. Se quiser config em múltiplas máquinas, trocar por `chrome.storage.sync`.
- **Feedback por badge** (`chrome.action.setBadgeText`) em vez de `chrome.notifications` → evita a permissão `notifications`. Se quiser toasts do SO, adicionar `"notifications"` em `permissions` e usar `chrome.notifications.create`.
- **Ícones reusados** 192/512 declarados nesses tamanhos; Chrome reescala. Se a toolbar ficar borrada, gerar `icon-48.png`/`icon-128.png` e declará-los.
- **`optional_host_permissions` amplo** concedido só à origem configurada em runtime. Se a Chrome Web Store recusar o escopo amplo (só relevante para publicação, não para uso unpacked), trocar por `host_permissions` fixo com a origem específica — mas isso quebra a configurabilidade da URL; para uso pessoal unpacked, manter opcional.
- **Sem CORS no backend**: correto e intencional — fetch do service worker com host permission ignora CORS/preflight. Não adicionar headers CORS.
