# Tasks: Trash and Restore Notes

**Input**: Design documents from `/specs/002-trash-restore-notes/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

**Tests**: Não solicitados — validação manual via quickstart.md.

**Organization**: Tarefas agrupadas por user story para permitir implementação e validação independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependências incompletas)
- **[Story]**: User story a que a tarefa pertence (US1–US4)
- Caminhos absolutos referem-se à raiz do repositório

---

## Phase 1: Setup (Infraestrutura de dados)

**Purpose**: Adicionar o campo de soft delete ao banco — pré-requisito para tudo mais.

- [x] T001 Criar `internal/db/migrations/006_trash.sql` com `ALTER TABLE notes ADD COLUMN deleted_at DATETIME` e índice `idx_notes_deleted_at`

---

## Phase 2: Foundational (Pré-requisitos bloqueantes)

**Purpose**: Atualizar o modelo Go e todas as queries existentes para respeitar `deleted_at` antes de qualquer nova funcionalidade.

**⚠️ CRITICAL**: Nenhuma user story pode ser implementada antes desta fase estar completa — as queries existentes passarão a filtrar notas na lixeira.

- [x] T002 Adicionar campo `DeletedAt *time.Time` com tag `json:"deleted_at,omitempty"` em `internal/models/note.go`
- [x] T003 Atualizar `internal/db/notes.go` — adicionar `WHERE n.deleted_at IS NULL` ao `baseNotesSQL`; adicionar `AND n.deleted_at IS NULL` ao `SearchNotes`; atualizar `scanNotes` e `GetNote` para fazer scan do campo `deleted_at` usando `sql.NullTime`

**Checkpoint**: Neste ponto o app sobe normalmente e notas ativas funcionam como antes — notas deletadas (ainda nenhuma) não aparecem no feed.

---

## Phase 3: User Story 1 — Deletar nota com confirmação (Priority: P1) 🎯 MVP

**Goal**: Usuário vê ícone de lixeira ao lado do pin em cada nota do feed; ao clicar, modal de confirmação é exibido; ao confirmar, nota move para a lixeira e desaparece do feed.

**Independent Test**: Criar uma nota → clicar no ícone 🗑️ → confirmar → nota desaparece do feed. Acessar `GET /api/trash` diretamente e verificar que a nota aparece lá. Cancelar a confirmação e verificar que nota permanece.

### Implementation for User Story 1

- [x] T004 Implementar `TrashNote(id int64) error` em `internal/db/notes.go` — `UPDATE notes SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`; retornar `sql.ErrNoRows` se nota não encontrada ou já deletada
- [x] T005 Implementar handler `Trash` em `internal/handlers/notes.go` (responde `PUT /api/notes/{id}/trash`) — chama `db.TrashNote(id)`; responde `{"id": id, "trashed": true}` ou 404; registrar rota `r.Put("/{id}/trash", noteHandler.Trash)` em `main.go`
- [x] T006 [P] Adicionar elemento `#modal-confirm` ao `frontend/index.html` — `<div id="modal-confirm" class="modal-overlay" hidden role="dialog" aria-modal="true">` com `#modal-confirm-message`, `#btn-confirm-ok` e `#btn-confirm-cancel`, seguindo o mesmo padrão do `#modal-hashtags` existente
- [x] T007 [P] Adicionar função `showConfirmModal(message, onConfirm)` em `frontend/assets/js/app.js` — exibe `#modal-confirm` com a mensagem, registra listeners nos botões OK/Cancelar, fecha o modal após qualquer ação; exportar a função
- [x] T008 Atualizar `frontend/assets/js/notes.js` — adicionar botão `<button class="tb-btn btn-trash" data-id="${note.id}" title="Mover para lixeira">🗑️</button>` ao lado do `btn-pin` em `noteCardHTML()`; registrar listener click de `.btn-trash` em `bindCardEvents()` chamando `trashNote(id)`; implementar `trashNote(id)` que usa `showConfirmModal()` e chama `PUT /api/notes/${id}/trash`, despachando `note:deleted` ao confirmar; remover a função `deleteNote` (substituída por `trashNote`)

**Checkpoint**: US1 completamente funcional — mover nota para lixeira via UI com confirmação modal.

---

## Phase 4: User Story 2 — Visualizar e restaurar notas na Lixeira (Priority: P2)

**Goal**: Seção "Lixeira" acessível no sidebar lista notas deletadas (mais recentes primeiro); cada nota tem botão "Restaurar"; ao restaurar, nota volta ao feed.

**Independent Test**: Deletar uma nota (US1 concluída) → clicar em "Lixeira" no sidebar → nota aparece na lista → clicar "Restaurar" → nota some da lixeira → verificar que aparece de volta no feed.

### Implementation for User Story 2

- [x] T009 Implementar `RestoreNote(id int64) error` e `ListTrashedNotes(limit, offset int) ([]models.Note, int, error)` em `internal/db/notes.go` — `RestoreNote`: `UPDATE notes SET deleted_at = NULL WHERE id = ?`; `ListTrashedNotes`: query SELECT com `WHERE n.deleted_at IS NOT NULL ORDER BY n.deleted_at DESC`, incluindo scan de `deleted_at`
- [x] T010 Implementar handlers `Restore` (PUT /api/notes/{id}/restore) e `ListTrash` (GET /api/trash) em `internal/handlers/notes.go`; registrar rotas em `main.go` — `r.Put("/{id}/restore", noteHandler.Restore)` dentro do bloco `/notes`; `r.Get("/trash", noteHandler.ListTrash)` no bloco `/api`
- [x] T011 [P] Adicionar ao `frontend/index.html` — item de nav `<button class="nav-item" id="btn-trash"><span class="nav-icon">🗑️</span><span>Lixeira</span></button>` após `#btn-attachments`; section `<div id="trash-view" hidden>` com `#trash-list`, `#btn-empty-trash` (disabled) e `#trash-empty` (empty state), após `#attachments-view`
- [x] T012 [P] Criar `frontend/assets/js/trash.js` — `loadTrash()` que chama `GET /api/trash`, renderiza cards de nota na lixeira em `#trash-list` (ordenados por deleted_at, sem ícone de pin nem lixeira, com botão "Restaurar"); handler de restaurar que chama `PUT /api/notes/{id}/restore`, recarrega a view e despacha `note:restored`; habilitar/desabilitar `#btn-empty-trash` conforme há notas
- [x] T013 Atualizar `frontend/assets/js/app.js` — importar `loadTrash` de `./trash.js`; adicionar `showTrashView()` (oculta `#editor-box`, `#notes-feed`, `#attachments-view`; exibe `#trash-view`; chama `loadTrash()`); atualizar `showNotesView()` e `showAttachmentsView()` para ocultar `#trash-view`; registrar listener `#btn-trash` em `bindUI()`

**Checkpoint**: US2 completamente funcional — navegar para a Lixeira, ver notas deletadas e restaurar.

---

## Phase 5: User Story 3 — Esvaziar a Lixeira (Priority: P3)

**Goal**: Botão "Esvaziar lixeira" na view da Lixeira; ao clicar, modal de confirmação é exibido; ao confirmar, todas as notas são excluídas permanentemente (incluindo arquivos físicos de anexos).

**Independent Test**: Com notas na lixeira → clicar "Esvaziar lixeira" → confirmar → lixeira fica vazia (estado vazio visível) → verificar que arquivos físicos dos anexos foram removidos do disco.

### Implementation for User Story 3

- [x] T014 Implementar `EmptyTrash() ([]models.Attachment, error)` em `internal/db/notes.go` — buscar todos os attachments de notas com `deleted_at IS NOT NULL`; dentro de uma transaction: `DELETE FROM notes WHERE deleted_at IS NOT NULL` (CASCADE remove `note_hashtags` e `attachments`); limpar hashtags órfãs; retornar a lista de attachments para remoção dos arquivos físicos
- [x] T015 Implementar handler `EmptyTrash` (DELETE /api/trash) em `internal/handlers/notes.go` — chama `db.EmptyTrash()`, remove arquivos físicos via `deleteFileFromPath()` para cada attachment retornado, responde 204 No Content; registrar rota `r.Delete("/trash", noteHandler.EmptyTrash)` em `main.go`
- [x] T016 Atualizar `frontend/assets/js/trash.js` — adicionar `emptyTrash()` que usa `showConfirmModal()` com mensagem de aviso de irreversibilidade e chama `DELETE /api/trash`; após confirmar, chamar `loadTrash()` para atualizar a view; registrar listener em `#btn-empty-trash`

**Checkpoint**: US3 completamente funcional — esvaziar a lixeira com confirmação, limpeza de arquivos físicos e estado vazio exibido.

---

## Phase 6: User Story 4 — Remover opção de excluir na edição (Priority: P4)

**Goal**: A opção "Excluir" não existe mais na interface de edição de notas.

**Independent Test**: Abrir qualquer nota para edição (duplo clique no card) → verificar que a barra de edição não mostra mais o botão "Excluir" → salvar normalmente.

### Implementation for User Story 4

- [x] T017 [P] Remover `<button id="btn-delete-note" class="btn-danger-sm">Excluir</button>` do `#editor-mode-bar` em `frontend/index.html`
- [x] T018 [P] Remover todas as referências a `btn-delete-note` em `frontend/assets/js/editor.js` — remover listener do `btn-delete-note` (linhas 48-52); remover `btnDel.hidden = false/true` de `loadNoteForEdit`, `resetEditor` e `ensureNote`; remover import de `deleteNote` de `notes.js` se não mais utilizado

**Checkpoint**: US4 completa — interface de edição sem opção de excluir; fluxo de exclusão exclusivamente pelo ícone 🗑️ no feed.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validação end-to-end e verificação de casos de borda identificados na spec.

- [x] T019 Executar validação manual completa seguindo `specs/002-trash-restore-notes/quickstart.md` — verificar: (1) busca por texto não retorna notas na lixeira; (2) filtro por hashtag não retorna notas na lixeira; (3) nota com pinned=true restaurada volta com pinned=true; (4) cancelar qualquer modal de confirmação preserva estado; (5) "Esvaziar lixeira" desabilitado quando lixeira vazia

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Sem dependências — iniciar imediatamente
- **Phase 2 (Foundational)**: Depende da Phase 1 — **BLOQUEIA** todas as user stories
- **Phase 3 (US1)**: Depende da Phase 2
- **Phase 4 (US2)**: Depende da Phase 2; consome o endpoint `/api/trash` criado em US1 apenas para leitura — pode ser desenvolvida em paralelo com US1 se os endpoints forem testados via curl
- **Phase 5 (US3)**: Depende da Phase 4 (view da lixeira já deve existir)
- **Phase 6 (US4)**: Depende da Phase 3 (ícone de lixeira já deve estar no feed)
- **Phase 7 (Polish)**: Depende de todas as fases anteriores

### User Story Dependencies

- **US1 (P1)**: Inicia após Phase 2 — sem dependências de outras stories
- **US2 (P2)**: Inicia após Phase 2 — integra-se ao endpoint de trash de US1 (operação de leitura apenas)
- **US3 (P3)**: Depende da US2 (view da lixeira + btn-empty-trash já existem)
- **US4 (P4)**: Depende da US1 (ícone de lixeira deve existir no feed antes de remover o botão do editor)

### Within Each User Story

- Implementação backend antes de frontend
- DB method antes do handler
- HTML estrutural antes do JS que o manipula
- Dentro de uma fase, tarefas sem [P] devem ser executadas em sequência

### Parallel Opportunities

- **T006 + T007**: Modal HTML e modal JS — arquivos diferentes (`index.html` vs `app.js`)
- **T011 + T012**: View HTML e trash.js — arquivos diferentes (`index.html` vs `trash.js`)
- **T017 + T018**: Remoção no HTML e no JS — arquivos diferentes (`index.html` vs `editor.js`)

---

## Parallel Example: User Story 1

```
# Após T003 completado:
# Backend (sequencial, mesmo arquivo):
T004 → TrashNote DB method
T005 → Trash handler + rota

# Frontend (paralelo após T005):
T006: modal HTML (index.html)    ←── paralelo
T007: showConfirmModal (app.js)  ←── paralelo
# Depois:
T008: notes.js (depende de T007 estar disponível)
```

## Parallel Example: User Story 2

```
# Após T003 completado:
# Backend (sequencial, mesmo arquivo):
T009 → RestoreNote + ListTrashedNotes DB methods
T010 → Restore + ListTrash handlers + rotas

# Frontend (paralelo após T010):
T011: trash-view HTML (index.html)  ←── paralelo
T012: trash.js módulo               ←── paralelo
# Depois:
T013: app.js wiring (depende de T011 + T012)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Phase 1: Setup (T001)
2. Completar Phase 2: Foundational (T002-T003) — **crítico, bloqueia tudo**
3. Completar Phase 3: US1 (T004-T008)
4. **PARAR e VALIDAR**: mover nota para lixeira funciona, nota some do feed
5. Entregar MVP: soft delete com confirmação modal

### Incremental Delivery

1. Setup + Foundational (T001-T003) → Base pronta
2. US1 (T004-T008) → MVP: deletar para lixeira ✅
3. US2 (T009-T013) → View da lixeira + restaurar ✅
4. US3 (T014-T016) → Esvaziar lixeira ✅
5. US4 (T017-T018) → Interface limpa ✅
6. Polish (T019) → Validação final ✅

---

## Notes

- `[P]` = arquivos diferentes, sem dependências incompletas naquele momento
- `[Story]` mapeia a tarefa para rastreabilidade com a spec
- Cada user story é testável de forma independente ao final da sua fase
- Commitar após cada fase ou tarefa lógica
- Parar em qualquer checkpoint para validar antes de avançar
- Evitar: modificar o mesmo arquivo em tarefas paralelas
