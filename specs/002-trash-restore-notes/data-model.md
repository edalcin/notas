# Data Model: Trash and Restore Notes

**Feature**: `002-trash-restore-notes`
**Date**: 2026-04-07

## Entidades Afetadas

### Nota (notes) — modificada

Campo adicionado via migration `006_trash.sql`:

| Campo | Tipo | Nulo | Padrão | Descrição |
|-------|------|------|--------|-----------|
| `deleted_at` | `DATETIME` | SIM | `NULL` | Data/hora de mover para lixeira; NULL = nota ativa |

**Regras:**
- `deleted_at IS NULL` → nota ativa (aparece no feed, buscas, filtros por tag)
- `deleted_at IS NOT NULL` → nota na lixeira (visível apenas na view Lixeira)
- Ao mover para lixeira: `SET deleted_at = CURRENT_TIMESTAMP`
- Ao restaurar: `SET deleted_at = NULL`
- Ao esvaziar lixeira: `DELETE FROM notes WHERE deleted_at IS NOT NULL` (CASCADE para `attachments` e `note_hashtags`)

**Schema completo pós-migration:**

```sql
notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  content     TEXT NOT NULL DEFAULT '',
  pinned      INTEGER NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at  DATETIME                                     -- NOVO
)
```

### Índice adicionado

```sql
CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at);
```

Usado pelo filtro `WHERE deleted_at IS NULL` em todas as queries do feed e por `WHERE deleted_at IS NOT NULL` na listagem da lixeira.

## Estado de ciclo de vida da Nota

```
[ATIVA]
  deleted_at = NULL
  pinned = 0|1
       |
       | TrashNote (PUT /api/notes/{id}/trash)
       ↓
[LIXEIRA]
  deleted_at = <timestamp>
  pinned = 0|1 (preservado)
       |              |
       | RestoreNote  | EmptyTrash
       | (PUT /api/   | (DELETE /api/trash)
       | notes/{id}/  |
       | restore)     ↓
       ↑         [EXCLUÍDA PERMANENTEMENTE]
      [ATIVA]         arquivos físicos removidos
```

## Entidades Não Afetadas

- **attachments**: sem alteração — CASCADE DELETE cuida da remoção ao esvaziar lixeira
- **note_hashtags**: sem alteração — CASCADE DELETE cuida da remoção
- **hashtags**: sem alteração — o cleanup de orphans existente é chamado dentro de `EmptyTrash`
- **notes_fts**: sem alteração estrutural — queries de busca adicionam filtro `AND n.deleted_at IS NULL` no JOIN

## Model Go — Note (modificado)

```go
type Note struct {
    ID          int64        `json:"id"`
    Content     string       `json:"content"`
    Preview     string       `json:"preview"`
    Pinned      bool         `json:"pinned"`
    Hashtags    []string     `json:"hashtags"`
    Attachments []Attachment `json:"attachments"`
    CreatedAt   time.Time    `json:"created_at"`
    UpdatedAt   time.Time    `json:"updated_at"`
    DeletedAt   *time.Time   `json:"deleted_at,omitempty"` // NOVO — ponteiro para omitempty
}
```

O campo `DeletedAt` é um ponteiro (`*time.Time`) para representar NULL corretamente. A tag `omitempty` garante que notas ativas não emitam o campo no JSON.
