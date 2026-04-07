# Data Model: Public Note Share Link

**Branch**: `003-public-share-link` | **Date**: 2026-04-07

## Schema Change

### Migration: `007_share_token.sql`

```sql
ALTER TABLE notes ADD COLUMN share_token TEXT;

CREATE UNIQUE INDEX idx_notes_share_token
  ON notes(share_token)
  WHERE share_token IS NOT NULL;
```

**Notes**:
- `share_token TEXT` — nullable; NULL means no active public link for this note
- The partial unique index (`WHERE share_token IS NOT NULL`) guarantees token uniqueness while allowing multiple NULL values (SQLite NULL semantics: NULLs are not considered equal in unique indexes, but the partial index is cleaner and explicit)
- The unique index also provides O(log n) lookup by token for the public endpoint

---

## Updated Note Model

### `internal/models/note.go`

Add one field to the existing `Note` struct:

```go
type Note struct {
    ID          int64
    Content     string
    Preview     string
    Pinned      bool
    Shared      bool       // ← NEW: true when share_token IS NOT NULL
    Hashtags    []string
    Attachments []Attachment
    CreatedAt   time.Time
    UpdatedAt   time.Time
    DeletedAt   *time.Time
}
```

**Why `Shared bool` instead of exposing `ShareToken string`**: The token is sensitive — it grants public access to the note. List responses (note feed, shared notes list) only need to know whether a token exists, not its value. The token value is only returned by the `POST /api/notes/{id}/share` endpoint to the authenticated user.

---

## New DB Queries

### `internal/db/notes.go` additions

```go
// GetShareToken returns the active share token for a note, or empty string if none.
func (q *Queries) GetShareToken(noteID int64) (string, error)

// SetShareToken generates a new 64-char hex token, stores it, and returns it.
// If the note already has a token, returns the existing token without regenerating.
func (q *Queries) SetShareToken(noteID int64) (string, error)

// ClearShareToken removes the share token for a note (revoke).
func (q *Queries) ClearShareToken(noteID int64) error

// GetNoteByShareToken returns the note matching the token.
// Returns sql.ErrNoRows if not found, token invalid, or note is trashed.
func (q *Queries) GetNoteByShareToken(token string) (*models.Note, error)

// ListSharedNotes returns active (not trashed) notes that have a share token.
func (q *Queries) ListSharedNotes(limit, offset int) ([]models.Note, int, error)
```

### SQL for `GetNoteByShareToken`

```sql
SELECT id, content, created_at, updated_at
FROM notes
WHERE share_token = ?
  AND deleted_at IS NULL
```

### SQL for `ListSharedNotes`

```sql
SELECT id, content, pinned, created_at, updated_at,
       (share_token IS NOT NULL) AS shared
FROM notes
WHERE share_token IS NOT NULL
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT ? OFFSET ?
```

### SQL for `SetShareToken`

```sql
-- Only set if currently NULL (don't overwrite existing token)
UPDATE notes
SET share_token = ?
WHERE id = ? AND share_token IS NULL
```

Then: `SELECT share_token FROM notes WHERE id = ?` to return current value (whether just set or pre-existing).

### SQL for `ClearShareToken`

```sql
UPDATE notes SET share_token = NULL WHERE id = ?
```

---

## Token Generation

```go
// In internal/db/notes.go or a shared util
func generateShareToken() (string, error) {
    b := make([]byte, 32) // 256 bits
    if _, err := rand.Read(b); err != nil {
        return "", err
    }
    return hex.EncodeToString(b), nil // 64 hex chars
}
```

Uses `crypto/rand` — no new imports beyond what Go's standard library provides.

---

## State Transitions

```
Note (no token)
    │
    │ POST /api/notes/{id}/share
    ▼
Note (share_token = "abc123...")
    │
    │ DELETE /api/notes/{id}/share
    ▼
Note (share_token = NULL)
    │
    │ POST /api/notes/{id}/share  ← generates NEW token
    ▼
Note (share_token = "def456...")
```

**Invariant**: A note in the trash (`deleted_at IS NOT NULL`) is never accessible via its share token, even if `share_token IS NOT NULL`. The `GetNoteByShareToken` query enforces this with `AND deleted_at IS NULL`.
