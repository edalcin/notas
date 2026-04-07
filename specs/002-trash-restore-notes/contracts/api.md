# API Contracts: Trash and Restore Notes

**Feature**: `002-trash-restore-notes`
**Date**: 2026-04-07

## Novos Endpoints

### PUT /api/notes/{id}/trash

Move uma nota para a lixeira (soft delete).

**Request**
```
PUT /api/notes/42/trash
(sem body)
```

**Response 200 OK**
```json
{ "id": 42, "trashed": true }
```

**Response 404 Not Found**
```json
{ "error": "note not found" }
```

**Comportamento**: Define `deleted_at = CURRENT_TIMESTAMP`. A nota desaparece do feed e buscas imediatamente.

---

### PUT /api/notes/{id}/restore

Restaura uma nota da lixeira para o feed ativo.

**Request**
```
PUT /api/notes/42/restore
(sem body)
```

**Response 200 OK**
```json
{ "id": 42, "trashed": false }
```

**Response 404 Not Found**
```json
{ "error": "note not found" }
```

**Comportamento**: Define `deleted_at = NULL`. O campo `pinned` é preservado. A nota reaparece no feed.

---

### GET /api/trash

Lista todas as notas na lixeira, ordenadas por `deleted_at DESC` (mais recentemente deletadas primeiro).

**Request**
```
GET /api/trash?limit=20&offset=0
```

**Query Params**

| Param | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `limit` | int | 50 | Máx 200 |
| `offset` | int | 0 | Paginação |

**Response 200 OK**
```json
{
  "notes": [
    {
      "id": 42,
      "content": "...",
      "preview": "...",
      "pinned": false,
      "hashtags": [],
      "attachments": [],
      "created_at": "2026-04-01T10:00:00Z",
      "updated_at": "2026-04-05T14:30:00Z",
      "deleted_at": "2026-04-07T09:15:00Z"
    }
  ],
  "total": 1,
  "offset": 0,
  "limit": 20
}
```

**Comportamento**: Retorna apenas notas onde `deleted_at IS NOT NULL`. Inclui attachments por nota (mesmo comportamento do `GET /api/notes`).

---

### DELETE /api/trash

Esvazia a lixeira — exclui permanentemente todas as notas deletadas e seus arquivos físicos.

**Request**
```
DELETE /api/trash
(sem body)
```

**Response 204 No Content** (sucesso, inclusive se a lixeira já estava vazia)

**Comportamento**:
1. Busca todos os attachments das notas deletadas
2. Deleta as linhas `WHERE deleted_at IS NOT NULL` em `notes` (CASCADE remove `attachments` e `note_hashtags`)
3. Remove os arquivos físicos do disco para cada attachment
4. Limpa hashtags órfãs

---

## Endpoints Existentes — Impacto

| Endpoint | Mudança |
|----------|---------|
| `GET /api/notes` | Passa a excluir notas com `deleted_at IS NOT NULL` |
| `GET /api/notes/{id}` | Retorna 404 para notas na lixeira |
| `PUT /api/notes/{id}` | Sem alteração (notas na lixeira não são editáveis via UI) |
| `DELETE /api/notes/{id}` | **Mantido** — continua como hard delete direto (não usado pela UI após a feature, mas não removido para compatibilidade) |
| `PUT /api/notes/{id}/pin` | Sem alteração |
