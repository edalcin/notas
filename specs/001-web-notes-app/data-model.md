# Data Model: Sistema de Anotações Web com Markdown

**Phase**: 1 — Design
**Date**: 2026-03-29
**Feature**: 001-web-notes-app

## Entities Overview

```
┌─────────────┐       ┌──────────────────┐       ┌─────────────┐
│    notes    │──────<│  note_hashtags   │>──────│  hashtags   │
│─────────────│       │──────────────────│       │─────────────│
│ id          │       │ note_id (FK)     │       │ id          │
│ content     │       │ hashtag_id (FK)  │       │ name        │
│ pinned      │       └──────────────────┘       └─────────────┘
│ created_at  │
│ updated_at  │       ┌─────────────────────┐
└─────────────┘──────<│    attachments      │
                      │─────────────────────│
                      │ id                  │
                      │ note_id (FK)        │
                      │ stored_filename     │
                      │ original_name       │
                      │ mime_type           │
                      │ size_bytes          │
                      │ created_at          │
                      └─────────────────────┘
```

---

## Table: `notes`

Primary content entity. Stores Markdown text and metadata.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique note identifier |
| `content` | TEXT | NOT NULL, DEFAULT '' | Raw Markdown content |
| `pinned` | INTEGER | NOT NULL, DEFAULT 0 | Boolean flag: 1 = pinned, 0 = normal |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Creation timestamp (UTC) |
| `updated_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Last modification timestamp (UTC) |

**Indexes**:
- `idx_notes_pinned_created` ON `notes(pinned DESC, created_at DESC)` — supports default list ordering
- `idx_notes_content_fts` — full-text search index (SQLite FTS5) on `content` — supports substring search (FR-009)

**Notes**:
- No mandatory title field — the UI derives a preview from the first non-empty line of `content`
- `updated_at` is updated on every content change (trigger or application-level)
- Deletion cascades to `note_hashtags` and `attachments` via foreign keys

---

## Table: `hashtags`

Canonical registry of hashtag names extracted from note content.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique hashtag identifier |
| `name` | TEXT | UNIQUE NOT NULL | Hashtag text without `#` prefix (e.g., `trabalho`) |

**Notes**:
- Hashtags are extracted automatically from note content by regex (`#[a-zA-Z0-9_\u00C0-\u017E]+`)
- The `name` is stored in lowercase for case-insensitive matching
- A hashtag row is created on first reference and deleted when no notes reference it
- Renaming a hashtag updates both this table and all occurrences in `notes.content`

---

## Table: `note_hashtags`

Junction table linking notes to their hashtags (many-to-many).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `note_id` | INTEGER | NOT NULL, FK → notes(id) ON DELETE CASCADE | Reference to note |
| `hashtag_id` | INTEGER | NOT NULL, FK → hashtags(id) ON DELETE CASCADE | Reference to hashtag |

**Constraints**: PRIMARY KEY (`note_id`, `hashtag_id`)

**Notes**:
- Rebuilt on every note save: existing records for the note are deleted and re-inserted based on current content
- Cascade delete ensures cleanup when a note or hashtag is removed

---

## Table: `attachments`

Files (images, documents) attached to notes, stored on the external filesystem.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | Unique attachment identifier |
| `note_id` | INTEGER | NOT NULL, FK → notes(id) ON DELETE CASCADE | Reference to owning note |
| `stored_filename` | TEXT | NOT NULL | UUID-based filename on disk (e.g., `a1b2c3d4.jpg`) — prevents collisions |
| `original_name` | TEXT | NOT NULL | Original filename uploaded by user (e.g., `foto-ferias.jpg`) |
| `mime_type` | TEXT | NOT NULL | MIME type (e.g., `image/jpeg`, `application/pdf`) |
| `size_bytes` | INTEGER | NOT NULL | File size in bytes |
| `created_at` | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | Upload timestamp (UTC) |

**Notes**:
- `stored_filename` uses UUID v4 + original extension to prevent path traversal and collisions
- When a note is deleted (CASCADE), the DB records are removed; the application layer also deletes physical files from `FILES_PATH`
- Upload size limit: 50MB per file (enforced at HTTP handler level)
- Allowed MIME types: `image/*`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.*`

---

## State Transitions: Note Lifecycle

```
[Draft / Editing] ──save──► [Saved]
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
               [Pinned]    [Filtered]  [Searched]
                    │
                    ▼
               [Deleted] ──cascade──► [Attachments deleted from disk]
```

**Auto-save trigger**: Debounce fires 2 seconds after last keystroke; `updated_at` is refreshed on each save.

---

## FTS5 Full-Text Search

SQLite FTS5 virtual table mirrors `notes` content for substring search (FR-009).

```sql
CREATE VIRTUAL TABLE notes_fts USING fts5(
  content,
  content='notes',
  content_rowid='id',
  tokenize='unicode61'
);
```

- `unicode61` tokenizer supports accented characters (Portuguese content)
- FTS5 is kept in sync via SQLite triggers on INSERT, UPDATE, DELETE of `notes`
- Search query: `SELECT * FROM notes WHERE id IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?)`

---

## Schema Migration Strategy

- Version tracked in a `schema_migrations` table (single row with `version INTEGER`)
- Application applies pending migrations on startup in order
- Migrations are embedded Go files in `internal/db/migrations/`
- SQLite WAL mode enabled for concurrent reads during writes

---

## Environment Variables

| Variable | Example | Description |
|----------|---------|-------------|
| `DB_PATH` | `/data/notes.db` | Absolute path to SQLite database file |
| `FILES_PATH` | `/data/files` | Absolute path to directory for uploaded files |
| `PORT` | `8080` | HTTP port (default: 8080) |
| `MAX_UPLOAD_BYTES` | `52428800` | Max upload size in bytes (default: 50MB) |
