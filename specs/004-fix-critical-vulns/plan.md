# Implementation Plan: Correção de Vulnerabilidades Críticas de Segurança

**Branch**: `004-fix-critical-vulns` | **Date**: 2026-04-08 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/004-fix-critical-vulns/spec.md`

## Summary

Corrigir as três vulnerabilidades classificadas como Críticas no relatório de segurança de 2026-04-08:
- **C-01**: XSS via Markdown — adicionar DOMPurify antes de cada `innerHTML = marked.parse(...)` nos 4 arquivos JS e na página pública (script extraído de inline para arquivo estático)
- **C-02**: HTTP Security Headers ausentes — adicionar middleware Go em `main.go` com 5 headers de segurança; CSP deployada em modo `Report-Only` (Fase 1) e promovida a `Enforce` após validação (Fase 2)
- **C-03**: Validação de tipo de arquivo baseada no cliente — substituir leitura de `Content-Type` header por detecção via magic bytes (`http.DetectContentType`); remover SVG e Office docs da allowlist

## Technical Context

**Language/Version**: Go 1.23 (backend), ES2022 Vanilla JS (frontend)  
**Primary Dependencies**: `github.com/go-chi/chi/v5` (router), `modernc.org/sqlite`, `marked.js` + `dompurify@3` (CDN)  
**Storage**: SQLite via `modernc.org/sqlite` — sem mudanças de schema  
**Testing**: Testes manuais de aceitação (cenários GWT da spec) + `govulncheck ./...`  
**Target Platform**: Linux server (Docker), browsers modernos (Chrome, Firefox, Safari, Edge)  
**Project Type**: Web application (monolith: Go API + embedded SPA frontend)  
**Performance Goals**: sem impacto — DOMPurify é síncrono e rápido; magic bytes lê apenas 512 bytes por upload  
**Constraints**: CSP não deve bloquear Service Worker (`worker-src 'self'`); Office docs removidos da allowlist (limitação aceita)

## Constitution Check

Sem arquivo `constitution.md` encontrado em `.specify/memory/`. Verificação de gates aplicada manualmente:

- ✅ Escopo restrito a correções de segurança — sem novas features
- ✅ Sem mudanças de schema de banco de dados
- ✅ Sem novas dependências Go (usa apenas stdlib: `net/http`, `io`)
- ✅ Nova dependência JS (DOMPurify) via CDN já utilizado (jsdelivr.net)
- ✅ Compatibilidade com Service Worker mantida (`worker-src 'self'` na CSP)
- ⚠️ Regressão de UX: Office docs (DOCX/XLSX) removidos da allowlist — documentado e aceito (justificativa em `research.md`)

## Project Structure

### Documentation (this feature)

```text
specs/004-fix-critical-vulns/
├── plan.md              ← este arquivo
├── spec.md              ← especificação de feature
├── research.md          ← decisões e alternativas
├── data-model.md        ← mudanças em entidades e contratos
└── tasks.md             ← gerado por /speckit.tasks
```

### Source Code — Arquivos modificados

```text
main.go                                     ← C-02: adicionar middleware de security headers
internal/
  services/
    files.go                                ← C-03: substituir validação por magic bytes
  handlers/
    public.go                               ← C-01: extrair script inline, passar data via atributo HTML

frontend/
  index.html                                ← C-01: adicionar <script> DOMPurify do CDN
  assets/
    js/
      public.js                             ← C-01: NOVO — script extraído de public.go (DOMPurify + marked)
      notes.js                              ← C-01: envolver marked.parse com DOMPurify.sanitize
      shared.js                             ← C-01: envolver marked.parse com DOMPurify.sanitize
      trash.js                              ← C-01: envolver marked.parse com DOMPurify.sanitize
      attachments-view.js                   ← C-01: envolver marked.parse com DOMPurify.sanitize
```

**sw.js**: sem alterações necessárias. O Service Worker cacheia assets locais; DOMPurify é carregado do CDN e tratado pelo `cacheFirst` do SW normalmente (cacheado na primeira visita).

---

## Fase 1 — C-01: Sanitização XSS via DOMPurify

### 1.1 — `frontend/index.html`: Adicionar DOMPurify antes de Marked.js

**Linha atual** (194):
```html
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
```

**Mudança**: adicionar DOMPurify **antes** do Marked.js (DOMPurify deve estar disponível quando os módulos JS carregam):
```html
<script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
```

### 1.2 — `frontend/assets/js/notes.js`: Envolver marked.parse

**Linha atual** (~188):
```js
const rendered = typeof marked !== 'undefined' ? marked.parse(note.content || '', { breaks: true }) : `<p>${esc(note.content || '')}</p>`;
```

**Mudança**:
```js
const rendered = typeof marked !== 'undefined'
  ? DOMPurify.sanitize(marked.parse(note.content || '', { breaks: true }))
  : `<p>${esc(note.content || '')}</p>`;
```

### 1.3 — `frontend/assets/js/shared.js`: Envolver marked.parse

**Linha atual** (~179):
```js
? marked.parse(note.content || '', { breaks: true })
```

**Mudança**:
```js
? DOMPurify.sanitize(marked.parse(note.content || '', { breaks: true }))
```

### 1.4 — `frontend/assets/js/trash.js`: Envolver marked.parse

**Linha atual** (~79):
```js
const rendered = typeof marked !== 'undefined' ? marked.parse(note.content || '', { breaks: true }) : `<p>${esc(note.content || '')}</p>`;
```

**Mudança**: mesmo padrão de 1.2.

### 1.5 — `frontend/assets/js/attachments-view.js`: Envolver marked.parse

**Linha atual** (~160):
```js
? marked.parse(noteContent, { breaks: true })
```

**Mudança**:
```js
? DOMPurify.sanitize(marked.parse(noteContent, { breaks: true }))
```

### 1.6 — `frontend/assets/js/public.js` (NOVO): Script extraído de public.go

Criar arquivo `frontend/assets/js/public.js`:
```js
// Renderiza o conteúdo da nota pública com sanitização XSS
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('note-content');
  if (!el) return;
  const raw = JSON.parse(el.dataset.content);
  el.innerHTML = DOMPurify.sanitize(marked.parse(raw, { breaks: true }));
});
```

### 1.7 — `internal/handlers/public.go`: Extrair script inline, passar dados via data attribute

**Mudanças no template** (`publicPageTmpl`):

1. Adicionar DOMPurify no `<head>` (antes de Marked.js):
```html
<script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
```

2. Alterar o elemento `note-content` para carregar dados via atributo (o `html/template` faz HTML-escape automático de strings em contexto de atributo):
```html
<div class="note-body" id="note-content" data-content="{{.ContentJSON}}"></div>
```

3. Substituir o bloco `<script>` inline por referência ao script externo:
```html
<script src="/assets/js/public.js"></script>
```

**Mudança no handler** (`ServePublicNote`):

Alterar `contentJSON` de `template.JS` para `string` (html/template aplica escaping correto no contexto de atributo):
```go
// Antes:
contentJSON := template.JS(contentBytes)
// ...
"ContentJSON": contentJSON,

// Depois:
// Remover import de "html/template" se não mais usado (manter se template.Must ainda usado)
"ContentJSON": string(contentBytes),
```

Nota: `template.Must` e `template.New` ainda são usados para definir `publicPageTmpl`, então o import de `html/template` permanece. Apenas o uso de `template.JS` é removido.

---

## Fase 2 — C-02: HTTP Security Headers

### 2.1 — `main.go`: Adicionar middleware de security headers

Adicionar middleware **antes** dos outros `r.Use(...)`, logo após `r.Use(middleware.Logger)` e `r.Use(middleware.Recoverer)`:

```go
// Security headers middleware (Fase 1: Report-Only; Fase 2: mudar para Content-Security-Policy)
r.Use(func(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-Frame-Options", "DENY")
        w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
        w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        w.Header().Set("Content-Security-Policy-Report-Only",
            "default-src 'self'; "+
                "script-src 'self' https://cdn.jsdelivr.net; "+
                "style-src 'self' 'unsafe-inline'; "+
                "img-src 'self' data: blob: https:; "+
                "connect-src 'self'; "+
                "worker-src 'self'; "+
                "frame-ancestors 'none'")
        next.ServeHTTP(w, r)
    })
})
```

**Fase 2** (após validação manual no browser): renomear `Content-Security-Policy-Report-Only` para `Content-Security-Policy` na mesma linha. Commit separado.

### 2.2 — Verificação de compatibilidade com Service Worker

Após aplicar os headers em Fase 1 (report-only), verificar no browser:
1. Abrir DevTools → Console
2. Navegar pela app (criar nota, visualizar, compartilhar, fazer upload)
3. Verificar que nenhuma violação CSP é reportada
4. Registrar o SW normalmente: DevTools → Application → Service Workers → Status deve ser "activated and is running"
5. Se violações aparecerem: ajustar a CSP antes de promover para Fase 2

---

## Fase 3 — C-03: Validação de Arquivo por Magic Bytes

### 3.1 — `internal/services/files.go`: Substituir validação

**Substituir completamente** a função `SaveFile` com a seguinte lógica:

```go
var allowedMimeTypes = map[string]bool{
    "image/jpeg":      true,
    "image/png":       true,
    "image/gif":       true,
    "image/webp":      true,
    "application/pdf": true,
    // image/svg+xml removido (vetor XSS)
    // Office docs removidos (http.DetectContentType retorna application/octet-stream para ZIP-based formats)
}

func SaveFile(header *multipart.FileHeader, filesPath string, maxBytes int64) (string, error) {
    if header.Size > maxBytes {
        return "", fmt.Errorf("file too large: %d bytes (max %d)", header.Size, maxBytes)
    }

    src, err := header.Open()
    if err != nil {
        return "", fmt.Errorf("open upload: %w", err)
    }
    defer src.Close()

    // Detect real MIME type from file content (ignores client-declared Content-Type)
    buf := make([]byte, 512)
    n, _ := src.Read(buf)
    detectedMime := http.DetectContentType(buf[:n])
    if _, err := src.Seek(0, io.SeekStart); err != nil {
        return "", fmt.Errorf("seek upload: %w", err)
    }

    if !allowedMimeTypes[detectedMime] {
        return "", fmt.Errorf("unsupported file type")
    }

    ext := filepath.Ext(header.Filename)
    storedFilename := uuid.New().String() + ext

    destPath := filepath.Join(filesPath, storedFilename)
    dst, err := os.Create(destPath)
    if err != nil {
        return "", fmt.Errorf("create file: %w", err)
    }
    defer dst.Close()

    if _, err := io.Copy(dst, src); err != nil {
        os.Remove(destPath)
        return "", fmt.Errorf("write file: %w", err)
    }

    return storedFilename, nil
}
```

**Import adicionado**: `"net/http"` (para `http.DetectContentType`)  
**Import removido**: `"strings"` (não mais necessário se não há outros usos)

### 3.2 — Atualizar mensagem de erro no handler de upload

O handler `attachments.go` que chama `SaveFile` deve retornar a mensagem genérica ao cliente sem expor detalhes:

Verificar `internal/handlers/attachments.go` — se o erro de `SaveFile` é repassado diretamente ao cliente, trocar por:
```go
http.Error(w, `{"error":"Tipo de arquivo não suportado"}`, http.StatusUnprocessableEntity)
```

---

## Checklist de Validação Pós-Implementação

Baseado no relatório de segurança e nos critérios de aceite da spec:

### C-01 (XSS)
- [ ] Criar nota com `<img src=x onerror=alert(1)>` → gerar link público → abrir no browser → nenhum alert
- [ ] Mesma nota visualizada na lista principal → nenhum alert
- [ ] Nota com Markdown normal (negrito, links, código) → renderiza corretamente

### C-02 (Headers)
- [ ] `curl -I http://localhost:8080/` → deve incluir `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Content-Security-Policy-Report-Only`
- [ ] Browser DevTools → Application → Service Workers → SW registrado e ativo
- [ ] Browser DevTools → Console → zero violações CSP durante uso normal
- [ ] Fase 2: após renomear para `Content-Security-Policy`, repetir todos os checks

### C-03 (Upload)
- [ ] Upload de arquivo `.svg` → rejeitado com "Tipo de arquivo não suportado"
- [ ] Upload de `.html` com `Content-Type: image/jpeg` → rejeitado
- [ ] Upload de JPEG legítimo → aceito
- [ ] Upload de PNG com `Content-Type: image/jpeg` → aceito (tipo real PNG é válido)
- [ ] Upload de `.docx` → rejeitado (aceitar esta regressão como limitação documentada)

## Complexity Tracking

| Item | Por que necessário | Alternativa rejeitada |
|------|-------------------|-----------------------|
| Arquivo `public.js` novo | Eliminar script inline para viabilizar CSP sem `unsafe-inline` em `script-src` | Nonce por request: requer mudança mais invasiva no middleware de templates |
| `html/template` string vs `template.JS` | Contexto de atributo requer escaping HTML, não JS | Manter `template.JS` em atributo seria incorreto e potencialmente inseguro |
| Office docs removidos | `http.DetectContentType` retorna `application/octet-stream` para ZIP — não é possível distinguir DOCX de arquivo binário arbitrário | Validação por ZIP + content inspection: fora do escopo de correção crítica |
