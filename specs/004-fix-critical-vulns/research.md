# Research: Correção de Vulnerabilidades Críticas de Segurança

**Branch**: `004-fix-critical-vulns`  
**Date**: 2026-04-08

---

## C-01 — XSS via Markdown: DOMPurify

### Decision
Usar DOMPurify 3 via CDN (`https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js`) como camada de sanitização após `marked.parse()`.

### Rationale
- DOMPurify mantém uma allowlist de tags/atributos seguros por padrão que cobre todos os elementos gerados por Markdown: `<strong>`, `<em>`, `<a href>`, `<code>`, `<pre>`, `<h1>`-`<h6>`, `<ul>`, `<ol>`, `<li>`, `<blockquote>`, `<img src>`.
- Remove automaticamente event handlers (`onerror`, `onclick`, etc.) e protocolos `javascript:`.
- Já é carregado do mesmo CDN (`cdn.jsdelivr.net`) que Marked.js e pdfjs — sem nova origem a liberar na CSP.
- API mínima: `DOMPurify.sanitize(dirtyHTML)` → sem configuração adicional para o caso de uso padrão.

### Alternativas consideradas
- **marked + sanitize-html**: requer bundler ou importação como módulo; mais pesado.
- **Restringir Marked.js com `options.sanitize`**: removido nas versões modernas do Marked; não é uma solução válida.
- **Server-side sanitization (Go)**: maior latência, não é o ponto certo de defesa para conteúdo Markdown renderizado no browser.

### Impacto na public.go
O script inline em `public.go` deve ser extraído para `frontend/assets/js/public.js` (arquivo estático servido via SPA handler). O conteúdo da nota é passado para o script via atributo `data-content` no elemento DOM, usando o escaping automático de `html/template` no contexto de atributo. Isso elimina o script inline e viabiliza CSP sem `'unsafe-inline'` para `script-src`.

---

## C-02 — HTTP Security Headers: Estratégia e Valores

### Decision
Middleware Go em `main.go`, aplicado a todos os routes, com `Content-Security-Policy-Report-Only` em Fase 1 e `Content-Security-Policy` em Fase 2.

### Headers e valores decididos

| Header | Valor | Justificativa |
|--------|-------|---------------|
| `X-Content-Type-Options` | `nosniff` | Impede MIME sniffing pelo browser |
| `X-Frame-Options` | `DENY` | Bloqueia clickjacking; coberto também por CSP `frame-ancestors` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Impede vazamento de tokens de share via header Referer em cross-origin |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Bloqueia acesso a hardware sensível |
| `Content-Security-Policy` | ver abaixo | Controle granular de origens |

### CSP policy

```
default-src 'self';
script-src 'self' https://cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
connect-src 'self';
worker-src 'self';
frame-ancestors 'none'
```

**Notas por diretiva:**
- `script-src 'self' https://cdn.jsdelivr.net` — permite Marked.js, DOMPurify e pdfjs do CDN; bloqueia scripts de outras origens e inline scripts. Requer que o script inline de `public.go` seja extraído para arquivo externo.
- `style-src 'self' 'unsafe-inline'` — necessário porque `public.go` tem um bloco `<style>` inline e `index.html` usa atributos `style=""` em alguns elementos. Alternativa com nonces está fora do escopo desta entrega.
- `img-src 'self' data: blob: https:` — permite imagens externas incorporadas em notas via Markdown (`![](https://...)`), data URIs e blob URLs usados pelo pdfjs.
- `connect-src 'self'` — restringe fetch/XHR à mesma origem.
- `worker-src 'self'` — obrigatório para o Service Worker (`sw.js`) ser registrado pelo browser.
- `frame-ancestors 'none'` — redundante com X-Frame-Options DENY, mas fornece cobertura em browsers que suportam apenas CSP.

### Service Worker compatibility
O SW (`frontend/sw.js`) só executa código da mesma origem e não faz fetch para origens externas fora de suas regras. A CSP não afeta a execução interna do SW. O `worker-src 'self'` permite o registro. Nenhuma mudança necessária em `sw.js`.

### Fase 1 → Fase 2
Fase 1: header `Content-Security-Policy-Report-Only` com a política acima. Viola sem bloquear; permite verificar se há falsos positivos nos console logs do browser (painel Network/Console → CSP violations).
Fase 2: renomear para `Content-Security-Policy` após validação.

---

## C-03 — Validação de MIME com Magic Bytes

### Decision
Usar `http.DetectContentType` (stdlib Go) para detectar o tipo real do arquivo pelos primeiros 512 bytes. Allowlist restrita a tipos detectáveis com confiança.

### Tipos permitidos após a mudança

| MIME detectado por `DetectContentType` | Tipo de arquivo |
|----------------------------------------|-----------------|
| `image/jpeg` | JPEG |
| `image/png` | PNG |
| `image/gif` | GIF |
| `image/webp` | WebP |
| `application/pdf` | PDF |

**Tipos removidos:**
- `image/svg+xml` — removido por ser vetor XSS. Nota: `DetectContentType` retorna `text/xml` para SVGs, então seria rejeitado automaticamente pelo allowlist, mas a remoção explícita da lista é importante para clareza.
- `application/msword` e `application/vnd.*` (Office docs) — `DetectContentType` retorna `application/octet-stream` para DOCX/XLSX (que são arquivos ZIP), tornando impossível distingui-los de arquivos binários arbitrários. Removidos por impossibilidade de validação segura. **Impacto na UX**: usuários não poderão mais anexar arquivos `.docx`/`.xlsx`. Pode ser reintroduzido futuramente com validação baseada em ZIP + inspection de conteúdo do arquivo.

### Implementação

```go
// 1. Abrir o multipart.File (implementa io.ReadSeeker)
src, err := header.Open()
// ...

// 2. Ler primeiros 512 bytes para detecção
buf := make([]byte, 512)
n, _ := src.Read(buf)
detectedMime := http.DetectContentType(buf[:n])

// 3. Rebobinar para início antes de copiar para disco
src.Seek(0, io.SeekStart)

// 4. Validar contra allowlist (sem fallback por prefixo)
if !allowedMimeTypes[detectedMime] {
    return "", fmt.Errorf("unsupported file type")
}
```

**Bug secundário removido:** `files.go:37` contém `!strings.HasPrefix(mimeType, "image/")` como fallback que permite qualquer `image/*` bypass da allowlist — esta condição deve ser eliminada junto com a refatoração.

### Alternativas consideradas
- **filetype library** (github.com/h2non/filetype): suporte mais amplo a tipos, mas é dependência extra; stdlib é suficiente para o escopo atual.
- **Manter Office docs com validação ZIP**: verificar magic bytes `PK\x03\x04` e inspecionar `[Content_Types].xml` dentro do ZIP. Válido tecnicamente, mas complexidade fora do escopo de correção crítica.
