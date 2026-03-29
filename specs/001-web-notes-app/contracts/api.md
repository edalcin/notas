# API Contract: Sistema de Anotações Web

**Base URL**: `http://<host>:8080/api`
**Format**: JSON (application/json) — except file uploads (multipart/form-data)
**Auth**: None (single-user, local network)

---

## Notes

### GET /api/notes
List notes. Supports filtering by hashtag and full-text search.

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Substring search across note content |
| `hashtag` | string | Filter by hashtag name (without `#`) |
| `limit` | integer | Max results (default: 50, max: 200) |
| `offset` | integer | Pagination offset (default: 0) |

**Response 200**:
```json
{
  "notes": [
    {
      "id": 1,
      "preview": "Primeira linha do conteúdo...",
      "content": "# Minha Nota\n\nConteúdo completo...",
      "pinned": false,
      "hashtags": ["trabalho", "projeto"],
      "attachments": [
        {
          "id": 1,
          "original_name": "foto.jpg",
          "stored_filename": "a1b2c3d4.jpg",
          "mime_type": "image/jpeg",
          "size_bytes": 204800,
          "url": "/files/a1b2c3d4.jpg"
        }
      ],
      "created_at": "2026-03-29T10:00:00Z",
      "updated_at": "2026-03-29T10:05:00Z"
    }
  ],
  "total": 42,
  "offset": 0,
  "limit": 50
}
```

**Ordering**: pinned notes first (by `created_at DESC`), then unpinned (by `created_at DESC`).

---

### POST /api/notes
Create a new note.

**Request Body**:
```json
{
  "content": "# Nova Nota\n\nConteúdo em **markdown**. #trabalho"
}
```

**Response 201**:
```json
{
  "id": 42,
  "preview": "Nova Nota",
  "content": "# Nova Nota\n\nConteúdo em **markdown**. #trabalho",
  "pinned": false,
  "hashtags": ["trabalho"],
  "attachments": [],
  "created_at": "2026-03-29T10:00:00Z",
  "updated_at": "2026-03-29T10:00:00Z"
}
```

---

### GET /api/notes/:id
Get a single note by ID.

**Response 200**: Same structure as single note object above.
**Response 404**: `{"error": "note not found"}`

---

### PUT /api/notes/:id
Update note content. Hashtags are re-extracted automatically from new content.

**Request Body**:
```json
{
  "content": "# Nota Editada\n\nNovo conteúdo. #pessoal"
}
```

**Response 200**: Updated note object.
**Response 404**: `{"error": "note not found"}`

---

### DELETE /api/notes/:id
Delete note and all its attachments (files removed from disk).

**Response 204**: No content.
**Response 404**: `{"error": "note not found"}`

---

### PUT /api/notes/:id/pin
Toggle pin state of a note.

**Request Body**:
```json
{
  "pinned": true
}
```

**Response 200**:
```json
{
  "id": 42,
  "pinned": true
}
```

---

## Hashtags

### GET /api/hashtags
List all hashtags with note counts, sorted alphabetically.

**Response 200**:
```json
{
  "hashtags": [
    { "name": "pessoal", "count": 5 },
    { "name": "projeto", "count": 12 },
    { "name": "trabalho", "count": 8 }
  ]
}
```

---

### PUT /api/hashtags/:name
Rename a hashtag. Updates all notes containing the old hashtag in their content.

**Request Body**:
```json
{
  "new_name": "profissional"
}
```

**Response 200**:
```json
{
  "name": "profissional",
  "count": 8
}
```

**Response 404**: `{"error": "hashtag not found"}`
**Response 409**: `{"error": "hashtag already exists"}` (if `new_name` already exists)

---

### DELETE /api/hashtags/:name
Delete a hashtag and remove it from all notes' content.

**Response 204**: No content.
**Response 404**: `{"error": "hashtag not found"}`

---

## Attachments

### POST /api/notes/:id/attachments
Upload a file attachment to a note.

**Request**: `multipart/form-data` with field `file`

**Constraints**:
- Max file size: 50MB (configurable via `MAX_UPLOAD_BYTES`)
- Allowed types: `image/*`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.*`

**Response 201**:
```json
{
  "id": 7,
  "original_name": "relatorio.pdf",
  "stored_filename": "f9e8d7c6.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 1048576,
  "url": "/files/f9e8d7c6.pdf",
  "created_at": "2026-03-29T11:00:00Z"
}
```

**Response 404**: `{"error": "note not found"}`
**Response 413**: `{"error": "file too large", "max_bytes": 52428800}`
**Response 415**: `{"error": "unsupported file type", "mime_type": "application/exe"}`

---

### DELETE /api/notes/:id/attachments/:attachment_id
Delete an attachment from a note. Removes the file from disk.

**Response 204**: No content.
**Response 404**: `{"error": "attachment not found"}`

---

## Static Files

### GET /files/:stored_filename
Serve an uploaded file directly. Used for inline image display and document download.

**Response 200**: Binary file content with appropriate `Content-Type` header.
**Response 404**: `{"error": "file not found"}`

---

## Health

### GET /health
Health check endpoint for Docker and UNRAID monitoring.

**Response 200**:
```json
{
  "status": "ok",
  "db": "connected",
  "version": "1.0.0"
}
```

---

## Error Response Format

All error responses follow this structure:
```json
{
  "error": "human-readable error message"
}
```

**HTTP Status Codes**:
| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (successful delete) |
| 400 | Bad Request (validation error) |
| 404 | Not Found |
| 409 | Conflict (duplicate name) |
| 413 | Payload Too Large |
| 415 | Unsupported Media Type |
| 500 | Internal Server Error |
