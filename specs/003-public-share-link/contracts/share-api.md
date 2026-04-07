# API Contracts: Public Note Share Link

**Branch**: `003-public-share-link` | **Date**: 2026-04-07

---

## New Endpoints

### 1. Generate or Retrieve Share Link

**Route**: `POST /api/notes/{id}/share`  
**Auth**: Required (PIN session cookie)  
**Idempotent**: Yes — calling multiple times returns the same token

**Request**: No body required

**Response 200 OK**:
```json
{
  "token": "a3f8c2d1e9b047a56c3f8e2d1b047a56c3f8e2d1b047a56c3f8e2d1b047a56c",
  "url": "https://example.com/s/a3f8c2d1e9b047a56c3f8e2d1b047a56c3f8e2d1b047a56c3f8e2d1b047a56c",
  "shared": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `token` | string | 64-char hex token (256 bits of entropy) |
| `url` | string | Full public URL using the request's Host header |
| `shared` | bool | Always `true` in this response |

**Response 404 Not Found**: Note does not exist or is trashed  
**Response 401 Unauthorized**: No valid PIN session

---

### 2. Revoke Share Link

**Route**: `DELETE /api/notes/{id}/share`  
**Auth**: Required (PIN session cookie)

**Request**: No body required

**Response 204 No Content**: Token successfully revoked (or was already null — idempotent)  
**Response 404 Not Found**: Note does not exist  
**Response 401 Unauthorized**: No valid PIN session

---

### 3. List Shared Notes

**Route**: `GET /api/notes/shared`  
**Auth**: Required (PIN session cookie)  
**Query params**: `?limit=20&offset=0` (same pagination as existing note list)

**Response 200 OK**:
```json
{
  "notes": [
    {
      "id": 42,
      "content": "Full note content...",
      "preview": "First 100 chars...",
      "pinned": false,
      "shared": true,
      "hashtags": ["golang", "project"],
      "attachments": [],
      "created_at": "2026-04-07T10:00:00Z",
      "updated_at": "2026-04-07T10:00:00Z"
    }
  ],
  "total": 5
}
```

**Note**: `shared: true` is guaranteed for all items in this response. Token value is NOT included.

**Response 401 Unauthorized**: No valid PIN session

---

### 4. Public Note Page

**Route**: `GET /s/{token}`  
**Auth**: None — fully public  
**Rate limit**: 30 requests/minute per client IP (returns 429 when exceeded)

**Response 200 OK**: Standalone HTML page containing:
- Note content rendered as Markdown (using marked.js)
- Minimal branding ("Notas" text link back to `/` — requires PIN to access)
- Note creation date
- No edit controls, no sidebar, no authentication UI

**Response 404 Not Found**: HTML error page — "Nota não encontrada ou link inválido"  
**Response 429 Too Many Requests**: HTML error page — "Muitas requisições. Tente novamente em alguns instantes."  
**Response 410 Gone**: (Optional future use) If note is trashed while token exists

---

## Modified Endpoints

### Note List Response — added `shared` field

**Route**: `GET /api/notes` (and `/api/notes/shared`, `/api/trash`)  
**Change**: Add `"shared": bool` to every note object in the response

```json
{
  "notes": [
    {
      "id": 1,
      "content": "...",
      "preview": "...",
      "pinned": true,
      "shared": false,    ← NEW field
      "hashtags": [],
      "attachments": [],
      "created_at": "...",
      "updated_at": "..."
    }
  ]
}
```

This allows the frontend to render the share button with an "active" visual state when `shared: true`.

---

## Rate Limit Specification

| Parameter | Value |
|-----------|-------|
| Scope | Per client IP address |
| Window type | Fixed window |
| Window duration | 60 seconds |
| Max requests per window | 30 |
| Response on exceed | HTTP 429 with HTML error body |
| Reset | At the start of each new 60-second window (global ticker) |
| Storage | In-memory Go map (lost on restart — acceptable) |

**Client IP detection**: Use `X-Forwarded-For` header if present (for reverse proxy deployments), otherwise `r.RemoteAddr`. Take only the first IP in the `X-Forwarded-For` list.
