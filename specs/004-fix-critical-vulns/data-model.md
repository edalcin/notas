# Data Model: Correção de Vulnerabilidades Críticas de Segurança

**Branch**: `004-fix-critical-vulns`  
**Date**: 2026-04-08

---

## Entidades Afetadas

Esta feature não cria novas entidades nem modifica o schema do banco de dados. As mudanças são restritas à camada de validação e de rendering.

---

## Mudanças em Entidades Existentes

### Arquivo Anexo (attachment)

**Campo afetado**: validação no momento do upload (runtime, não persisted)

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Fonte da validação de tipo | `header.Header.Get("Content-Type")` (cliente) | `http.DetectContentType(buf[:512])` (servidor) |
| Tipos aceitos | JPEG, PNG, GIF, WebP, SVG, PDF, DOC, DOCX, XLS, XLSX | JPEG, PNG, GIF, WebP, PDF |
| Fallback wildcard | `strings.HasPrefix(mimeType, "image/")` → aceita qualquer image/* | removido |
| SVG | aceito | rejeitado |
| Office docs | aceitos (DOCX, XLSX, DOC, XLS) | rejeitados (não detectáveis via magic bytes) |

---

## Regras de Validação Atualizadas

### Upload de arquivo (`internal/services/files.go`)

```
allowedMimeTypes = {
  "image/jpeg":      true,
  "image/png":       true,
  "image/gif":       true,
  "image/webp":      true,
  "application/pdf": true,
}

Algoritmo de validação:
1. Verificar tamanho máximo (existente, inalterado)
2. Abrir arquivo (multipart.File — implementa io.ReadSeeker)
3. Ler primeiros 512 bytes
4. Detectar MIME real via http.DetectContentType
5. Seek(0, io.SeekStart) para rebobinar
6. Se MIME detectado NÃO está em allowedMimeTypes → retornar erro genérico
7. Gerar UUID + extensão original → salvar no disco
```

---

## Contrato de Rendering de Nota (frontend)

| Contexto | Antes | Depois |
|----------|-------|--------|
| Página pública `/s/{token}` | `innerHTML = marked.parse(raw)` | `innerHTML = DOMPurify.sanitize(marked.parse(raw))` |
| Lista de notas (`notes.js`) | `innerHTML = marked.parse(content)` | `innerHTML = DOMPurify.sanitize(marked.parse(content))` |
| Notas compartilhadas (`shared.js`) | `innerHTML = marked.parse(content)` | `innerHTML = DOMPurify.sanitize(marked.parse(content))` |
| Lixeira (`trash.js`) | `innerHTML = marked.parse(content)` | `innerHTML = DOMPurify.sanitize(marked.parse(content))` |
| View de anexos (`attachments-view.js`) | `innerHTML = marked.parse(content)` | `innerHTML = DOMPurify.sanitize(marked.parse(content))` |

---

## Contrato de Passagem de Dados na Página Pública

**Antes** (script inline em `public.go`):
```html
<script>
  const raw = {{.ContentJSON}}; // template.JS — injeta JSON diretamente no script
  document.getElementById('note-content').innerHTML = marked.parse(raw, { breaks: true });
</script>
```

**Depois** (data attribute + script externo):
```html
<!-- No template Go (public.go): -->
<div id="note-content" data-content="{{.ContentJSON}}"></div>
<!-- {{.ContentJSON}} é string plain — html/template faz HTML-escape automático no contexto de atributo -->

<!-- Script externo (frontend/assets/js/public.js): -->
<!-- Lê dataset.content, faz JSON.parse, sanitiza e renderiza -->
```

**Mudança no tipo Go:** `contentJSON` muda de `template.JS` para `string` no template data map. O escaping correto para contexto de atributo é feito automaticamente pelo `html/template`.
