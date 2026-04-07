# Quickstart: Trash and Restore Notes

**Feature**: `002-trash-restore-notes`
**Date**: 2026-04-07

## Para o implementador

Este documento resume o que precisa ser feito, na ordem recomendada de implementação.

---

## 1. Migration de banco de dados

Criar `internal/db/migrations/006_trash.sql`:

```sql
ALTER TABLE notes ADD COLUMN deleted_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at);
```

A migration é automática no startup via `runMigrations()`.

---

## 2. Model Go

Em `internal/models/note.go`, adicionar campo:

```go
DeletedAt *time.Time `json:"deleted_at,omitempty"`
```

---

## 3. Camada de banco (db/notes.go)

### 3a. Filtrar notas deletadas de todas as queries ativas

No `baseNotesSQL`, adicionar `WHERE n.deleted_at IS NULL`:

```sql
WHERE n.deleted_at IS NULL
```

(Inserir no `%s` que já existe para filtros opcionais — combinar com WHERE existente de hashtag/search.)

Em `SearchNotes`, adicionar `AND n.deleted_at IS NULL` após o WHERE da FTS.

### 3b. Scan — adicionar deleted_at

Atualizar `scanNotes` e `GetNote` para fazer `Scan` do campo `deleted_at` (`*time.Time` / `sql.NullTime`).

### 3c. Novos métodos

```go
func (d *DB) TrashNote(id int64) error
func (d *DB) RestoreNote(id int64) error
func (d *DB) ListTrashedNotes(limit, offset int) ([]models.Note, int, error)
func (d *DB) EmptyTrash() ([]models.Attachment, error)
// EmptyTrash retorna os attachments para que o handler possa deletar os arquivos físicos
```

---

## 4. Handlers (handlers/notes.go)

Adicionar três handlers ao `NoteHandler`:

```go
func (h *NoteHandler) Trash(w http.ResponseWriter, r *http.Request)    // PUT /api/notes/{id}/trash
func (h *NoteHandler) Restore(w http.ResponseWriter, r *http.Request)  // PUT /api/notes/{id}/restore
func (h *NoteHandler) ListTrash(w http.ResponseWriter, r *http.Request) // GET /api/trash
func (h *NoteHandler) EmptyTrash(w http.ResponseWriter, r *http.Request) // DELETE /api/trash
```

Registrar rotas em `main.go`.

---

## 5. Frontend — index.html

### 5a. Nav item Lixeira

Adicionar após `btn-attachments` em `#sidebar-nav`:

```html
<button class="nav-item" id="btn-trash">
  <span class="nav-icon">🗑️</span><span>Lixeira</span>
</button>
```

### 5b. Section trash-view

Adicionar após `#attachments-view`:

```html
<div id="trash-view" hidden>
  <div class="trash-view-header-row">
    <h2 class="trash-view-title">Lixeira</h2>
    <button id="btn-empty-trash" class="btn-danger-sm" disabled>Esvaziar lixeira</button>
  </div>
  <div id="trash-list" role="list"></div>
  <div id="trash-empty" class="empty-state" hidden>
    <p>A lixeira está vazia.</p>
  </div>
</div>
```

### 5c. Modal de confirmação

Adicionar antes de `</body>`:

```html
<div id="modal-confirm" class="modal-overlay" hidden role="dialog" aria-modal="true">
  <div class="modal-box modal-confirm-box">
    <p id="modal-confirm-message"></p>
    <div class="modal-confirm-actions">
      <button id="btn-confirm-ok" class="btn-danger-sm">Confirmar</button>
      <button id="btn-confirm-cancel" class="btn-text-sm">Cancelar</button>
    </div>
  </div>
</div>
```

---

## 6. Frontend — notes.js

- Adicionar botão de lixeira no `noteCardHTML()`, ao lado do `btn-pin`:
  ```html
  <button class="tb-btn btn-trash" data-id="${note.id}" title="Mover para lixeira">🗑️</button>
  ```
- Em `bindCardEvents()`, registrar click do `btn-trash` chamando `trashNote(id)`
- Substituir `deleteNote()` por `trashNote(id)` que usa `showConfirmModal()` e chama `PUT /api/notes/{id}/trash`
- Exportar `trashNote` e importar `showConfirmModal` de novo módulo utilitário ou de `app.js`

---

## 7. Frontend — trash.js (novo módulo)

Responsabilidades:
- `loadTrash()` — chama `GET /api/trash`, renderiza cards na `#trash-list`
- Card de nota na lixeira com botão "Restaurar" (sem ícone de lixeira nem pin)
- Botão "Restaurar" chama `PUT /api/notes/{id}/restore` e recarrega a view
- Habilitar/desabilitar `#btn-empty-trash` conforme há notas na lixeira
- `emptyTrash()` — usa `showConfirmModal()` e chama `DELETE /api/trash`

---

## 8. Frontend — editor.js

Remover todas as referências a `btn-delete-note`:
- Remover listener do `btn-delete-note`
- Remover `btnDel.hidden = false/true` em `loadNoteForEdit`, `resetEditor`, `ensureNote`
- Remover import de `deleteNote` de `notes.js` se não usado em outro lugar

---

## 9. Frontend — app.js

- Importar `loadTrash` de `./trash.js`
- Adicionar listener para `btn-trash` em `bindUI()`:
  ```js
  document.getElementById('btn-trash')?.addEventListener('click', () => {
    setActiveNav(document.getElementById('btn-trash'));
    showTrashView();
  });
  ```
- Adicionar `showTrashView()` (esconde editor-box, notes-feed, attachments-view; exibe trash-view; chama `loadTrash()`)
- Atualizar `showNotesView()` e `showAttachmentsView()` para também ocultar `trash-view`
- Ouvir `note:trashed` event (disparado após mover para lixeira) para recarregar feed

---

## Ordem de implementação recomendada

1. Migration + model Go
2. DB methods (TrashNote, RestoreNote, ListTrashedNotes, EmptyTrash)
3. Handlers + rotas
4. Testar API com curl/browser devtools
5. Modal de confirmação (HTML + utilitário JS)
6. notes.js — ícone lixeira + trashNote()
7. trash.js — view completa
8. app.js — wiring da navegação
9. editor.js — remoção do botão excluir
10. Teste end-to-end manual
