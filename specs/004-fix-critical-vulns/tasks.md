# Tasks: Correção de Vulnerabilidades Críticas de Segurança

**Input**: Design documents from `/specs/004-fix-critical-vulns/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, quickstart.md ✓

**Tests**: Não solicitados — validação via checklist manual de aceitação em `quickstart.md`.

**Organization**: Tasks agrupadas por user story (C-01 → C-03 em ordem de prioridade da spec).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências entre si)
- **[Story]**: User story correspondente (US1, US2, US3)

---

## Phase 1: Fundacional (Prerequisite Compartilhado)

**Purpose**: Adicionar DOMPurify ao frontend SPA — prerequisite para todas as tasks de US1 que modificam JS files.

**⚠️ CRITICAL**: Tasks de US1 (T002–T005) dependem desta phase.

- [x] T001 Adicionar tag `<script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"></script>` em `frontend/index.html` antes da linha existente do Marked.js (linha ~194)

**Checkpoint**: DOMPurify disponível globalmente nos módulos JS do SPA — tasks de US1 podem começar em paralelo.

---

## Phase 2: User Story 1 — XSS via Markdown (Priority: P1) 🎯 MVP

**Goal**: Sanitizar todo HTML resultante de `marked.parse()` antes de inserir no DOM, em todas as views — incluindo a página pública de compartilhamento.

**Independent Test**: Criar nota com `<img src=x onerror=alert(1)>`, abrir na lista principal → nenhum alert. Acessar link público em aba anônima → nenhum alert. Markdown normal (negrito, links, código) continua renderizando corretamente.

### Implementation for User Story 1

- [x] T002 [P] [US1] Envolver `marked.parse` com `DOMPurify.sanitize` em `frontend/assets/js/notes.js` (linha ~188): substituir `marked.parse(note.content || '', { breaks: true })` por `DOMPurify.sanitize(marked.parse(note.content || '', { breaks: true }))`
- [x] T003 [P] [US1] Envolver `marked.parse` com `DOMPurify.sanitize` em `frontend/assets/js/shared.js` (linha ~179): substituir `marked.parse(note.content || '', { breaks: true })` por `DOMPurify.sanitize(marked.parse(note.content || '', { breaks: true }))`
- [x] T004 [P] [US1] Envolver `marked.parse` com `DOMPurify.sanitize` em `frontend/assets/js/trash.js` (linha ~79): substituir `marked.parse(note.content || '', { breaks: true })` por `DOMPurify.sanitize(marked.parse(note.content || '', { breaks: true }))`
- [x] T005 [P] [US1] Envolver `marked.parse` com `DOMPurify.sanitize` em `frontend/assets/js/attachments-view.js` (linha ~160): substituir `marked.parse(noteContent, { breaks: true })` por `DOMPurify.sanitize(marked.parse(noteContent, { breaks: true }))`
- [x] T006 [US1] Criar `frontend/assets/js/public.js` — novo arquivo com lógica de rendering para a página pública: ler `document.getElementById('note-content').dataset.content`, fazer `JSON.parse`, aplicar `DOMPurify.sanitize(marked.parse(raw, { breaks: true }))` e atribuir ao `innerHTML` do elemento
- [x] T007 [US1] Modificar template em `internal/handlers/public.go` (3 mudanças no `publicPageTmpl`): (1) adicionar `<script src="https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js"></script>` antes do script Marked.js existente; (2) alterar `<div class="note-body" id="note-content"></div>` para `<div class="note-body" id="note-content" data-content="{{.ContentJSON}}"></div>`; (3) substituir o bloco `<script>` inline por `<script src="/assets/js/public.js"></script>`. No handler `ServePublicNote`: alterar `contentJSON` de `template.JS(contentBytes)` para `string(contentBytes)` e atualizar o map de template para `"ContentJSON": string(contentBytes)`

**Checkpoint**: US1 completa e testável de forma independente. Nenhum XSS funciona nas 5 views.

---

## Phase 3: User Story 2 — HTTP Security Headers (Priority: P2)

**Goal**: Servidor envia 5 headers de segurança em todas as respostas HTTP. CSP deployada em modo report-only (Fase 1).

**Independent Test**: `curl -I http://localhost:8080/` deve retornar `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` e `Content-Security-Policy-Report-Only`. Browser DevTools → Application → Service Workers → SW "activated and is running". Console sem violações CSP.

### Implementation for User Story 2

- [x] T008 [P] [US2] Adicionar middleware de security headers em `main.go` logo após `r.Use(middleware.Recoverer)`: middleware anônimo que seta os 5 headers — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, e `Content-Security-Policy-Report-Only` com policy `default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self'; worker-src 'self'; frame-ancestors 'none'`
- [x] T009 [US2] Validação manual: compilar e rodar a app (`go run .` ou `docker-compose up --build`), executar `curl -I http://localhost:8080/` e confirmar presença dos 5 headers; abrir browser, navegar por todas as views (criar nota, visualizar, compartilhar, upload), verificar que DevTools Console não mostra violações CSP e que SW permanece "activated" em Application → Service Workers

**Checkpoint**: US2 completa. Headers presentes em todas as respostas. SW compatível com CSP.

---

## Phase 4: User Story 3 — Validação de Tipo de Arquivo (Priority: P3)

**Goal**: Servidor valida tipo real do arquivo via magic bytes, rejeita SVG e tipos não reconhecidos, sem expor detalhes internos ao cliente.

**Independent Test**: Upload de arquivo `.svg` → rejeitado com status 415. Upload de `.html` com `Content-Type: image/jpeg` → rejeitado. Upload de JPEG legítimo → aceito.

### Implementation for User Story 3

- [x] T010 [P] [US3] Refatorar `internal/services/files.go`: (1) substituir `allowedMimeTypes` pelo novo map com apenas `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf` — remover `image/svg+xml` e todos os tipos Office; (2) em `SaveFile`, abrir o arquivo com `header.Open()`, ler 512 bytes com `http.DetectContentType`, fazer `src.Seek(0, io.SeekStart)`, validar contra o novo allowlist; (3) remover a linha com `!strings.HasPrefix(mimeType, "image/")` e remover a leitura de `header.Header.Get("Content-Type")`; (4) alterar a assinatura para retornar `(string, string, error)` onde o segundo `string` é o `detectedMime`; (5) adicionar import `"net/http"` e remover import `"strings"` se não mais utilizado
- [x] T011 [US3] Atualizar `internal/handlers/attachments.go`: (1) ajustar chamada a `services.SaveFile` para receber o terceiro retorno `detectedMime`; (2) no bloco de erro de tipo não suportado (linha ~62), remover o campo `"mime_type": mimeType` da resposta JSON — retornar apenas `{"error": "unsupported file type"}`; (3) na linha ~74, substituir `header.Header.Get("Content-Type")` por `detectedMime` ao criar o registro de attachment no banco de dados

**Checkpoint**: US3 completa. SVG e tipos não reconhecidos rejeitados. MIME no banco de dados reflete tipo real detectado.

---

## Phase 5: Polish & Validação Final

**Purpose**: Consistência de UX, teste de aceitação completo e promoção da CSP para modo enforce.

- [x] T012 [P] Atualizar atributo `accept` no file input em `frontend/index.html` (linha ~88): remover `.doc,.docx,.xls,.xlsx` do valor — deixar apenas `accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"` para refletir os tipos realmente aceitos pelo backend
- [x] T013 Executar checklist completo de validação manual em `specs/004-fix-critical-vulns/quickstart.md`: testar todos os cenários de C-01 (XSS), C-02 (headers + SW) e C-03 (upload) — registrar resultados
- [x] T014 Promover CSP de report-only para enforce em `main.go`: renomear `Content-Security-Policy-Report-Only` para `Content-Security-Policy` (somente após T013 confirmar zero violações CSP durante uso normal)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 1)**: Sem dependências — iniciar imediatamente
- **US1 (Phase 2)**: T002–T005 dependem de T001 (DOMPurify no index.html); T006–T007 são independentes de T001 (página pública tem seu próprio script tag)
- **US2 (Phase 3)**: Independente de US1 e US3 — pode iniciar após Phase 1 em paralelo
- **US3 (Phase 4)**: Independente de US1 e US2 — pode iniciar em paralelo
- **Polish (Phase 5)**: T012 pode rodar em paralelo com US2/US3; T013 depende de todas as phases anteriores; T014 depende de T013

### User Story Dependencies

- **US1 (P1)**: T001 → [T002, T003, T004, T005 em paralelo] → T006 → T007
- **US2 (P2)**: T008 (independente) → T009 (validação manual)
- **US3 (P3)**: T010 (independente) → T011

### Parallel Opportunities

- Após T001: T002, T003, T004, T005 podem rodar simultaneamente (4 arquivos diferentes)
- T006 e T007 devem ser sequenciais (T007 referencia o arquivo criado por T006)
- T008 (main.go) e T010 (files.go) podem rodar em paralelo (arquivos independentes)
- T012 pode rodar em qualquer momento após T010 estar completo

---

## Parallel Example: User Story 1

```
# Após T001 concluído — lançar T002-T005 simultaneamente:
Task T002: Wrap DOMPurify em frontend/assets/js/notes.js
Task T003: Wrap DOMPurify em frontend/assets/js/shared.js
Task T004: Wrap DOMPurify em frontend/assets/js/trash.js
Task T005: Wrap DOMPurify em frontend/assets/js/attachments-view.js

# Após T002-T005 concluídos:
Task T006: Criar frontend/assets/js/public.js
Task T007: Modificar internal/handlers/public.go
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1 (T001)
2. Completar Phase 2 US1 (T002–T007)
3. **PARAR e VALIDAR**: criar nota com XSS, testar link público e views autenticadas
4. Fazer commit e deploy — C-01 resolvido

### Entrega Incremental

1. T001 → T002–T005 (paralelo) → T006 → T007 → **C-01 resolvido**
2. T008 → T009 → **C-02 Fase 1 ativa (report-only)**
3. T010 → T011 → T012 → **C-03 resolvido**
4. T013 (acceptance test completo) → T014 → **C-02 Fase 2 (CSP enforce)**

### Estratégia Single Developer

```
1. T001  (index.html — DOMPurify)
2. T002–T005 em sequência (4 arquivos JS — cada um é 1 linha)
3. T006  (criar public.js — ~10 linhas)
4. T007  (modificar public.go — template + handler)
5. T008  (main.go — middleware ~12 linhas)
6. T010  (files.go — refatoração principal)
7. T011  (attachments.go — ajuste de assinatura + erro)
8. T012  (index.html — accept attribute)
9. T009 + T013  (validação manual)
10. T014  (CSP enforce — 1 palavra muda no header)
```

---

## Notes

- **[P]**: arquivos diferentes, sem dependências entre si na mesma phase
- T006 e T007 são sequenciais: T007 referencia o arquivo criado por T006
- T011 depende de T010 (mudança de assinatura de SaveFile)
- T014 é o **único commit que requer validação prévia** (T013) — não avançar sem confirmar zero CSP violations
- Office docs (.docx, .xlsx) são removidos como limitação técnica aceita — documentado em research.md
- sw.js: **não requer alteração** — compatível com a CSP resultante (worker-src 'self')
