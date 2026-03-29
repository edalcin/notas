# Tasks: Sistema de Anotações Web com Markdown

**Input**: Design documents from `/specs/001-web-notes-app/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/api.md ✓, quickstart.md ✓

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Exact file paths included in all task descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize project structure and CI/CD pipeline before any feature work begins

- [x] T001 Create directory structure: `backend/cmd/server/`, `backend/internal/{db/migrations,handlers,models,services}`, `frontend/assets/{css,js}`, `.github/workflows/`
- [x] T002 Initialize Go module in `backend/go.mod` with dependencies: `github.com/go-chi/chi/v5`, `modernc.org/sqlite`, `github.com/google/uuid`
- [x] T003 [P] Create `Dockerfile` (multi-stage: `golang:1.23-alpine` builder with `CGO_ENABLED=0` + `alpine:3.19` final with `ca-certificates tzdata`)
- [x] T004 [P] Create `.github/workflows/docker-publish.yml` (trigger on push to `main`: `go test ./...` → multi-arch Docker build → push `ghcr.io/edalcin/notes:latest` and `ghcr.io/edalcin/notes:<sha>` using `GITHUB_TOKEN`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure (DB, HTTP server, SPA shell) that MUST be complete before any user story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T005 Create `backend/internal/db/migrations/001_initial.sql` with: `notes` table (id, content TEXT, pinned INTEGER DEFAULT 0, created_at, updated_at), `schema_migrations` table
- [x] T006 Implement `backend/internal/db/db.go`: open SQLite with `DB_PATH` env var, enable WAL mode + foreign keys, run pending migrations from embedded `migrations/` directory on startup; fail fast if `DB_PATH` or `FILES_PATH` env vars are missing
- [x] T007 [P] Create `backend/internal/models/note.go`: `Note` struct with JSON tags (id, content, preview string, pinned bool, hashtags []string, attachments []Attachment, created_at, updated_at)
- [x] T008 Implement `backend/cmd/server/main.go`: read env vars (`DB_PATH`, `FILES_PATH`, `PORT` default 8080, `MAX_UPLOAD_BYTES` default 52428800), init DB, build chi router with all route groups, register `//go:embed all:../../frontend` assets, start HTTP server on configured port
- [x] T009 Create `frontend/index.html`: SPA shell with `<meta>` viewport + PWA tags, link to `assets/css/app.css`, EasyMDE CDN script, Marked.js CDN script, app scripts as ES modules, `<div id="app">` mount point
- [x] T010 [P] Create `frontend/assets/css/app.css`: CSS custom properties for light/dark themes (`--bg`, `--text`, `--border`, `--accent`), responsive two-column layout (sidebar + main), note card styles, mobile breakpoint at 768px

**Checkpoint**: Foundation ready — `go run ./cmd/server` starts without errors, serves `index.html` at `localhost:8080`

---

## Phase 3: User Story 1 — Criar e Visualizar Notas com Markdown (Priority: P1) 🎯 MVP

**Goal**: Create, edit, delete, and view Markdown notes in a chronological list

**Independent Test**: Create a note with `**bold** and #tag`, verify it appears in the list with rendered Markdown and the `#tag` is visible; edit the note; delete the note

### Implementation

- [x] T011 [US1] Implement `backend/internal/db/notes.go`: `ListNotes(pinned-first + chronological)`, `GetNote(id)`, `CreateNote(content)` (sets created_at + updated_at), `UpdateNote(id, content)` (updates updated_at), `DeleteNote(id)`
- [x] T012 [US1] Implement `backend/internal/services/notes.go`: `ExtractHashtags(content string) []string` using regex `#[a-zA-Z0-9_\x{00C0}-\x{017E}]+` (supports accented Portuguese chars); `GeneratePreview(content string) string` (returns first non-empty line, max 100 chars)
- [x] T013 [US1] Implement `backend/internal/handlers/notes.go`: `GET /api/notes` (list, returns notes array with previews), `POST /api/notes` (create), `GET /api/notes/{id}` (get single), `PUT /api/notes/{id}` (update content), `DELETE /api/notes/{id}` (delete); JSON responses per `contracts/api.md`
- [x] T014 [US1] Implement `backend/internal/handlers/static.go`: serve embedded `frontend/` via `http.FileServer(http.FS(frontendAssets))`; register in chi router so `/api/*` routes take priority over SPA catch-all
- [x] T015 [US1] Implement `frontend/assets/js/editor.js`: initialize EasyMDE on `<textarea id="editor">` with toolbar (bold, italic, heading, list, preview), debounce auto-save after 2s of inactivity via `fetch PUT /api/notes/:id`, visible "Salvar" button that triggers immediate save, display last-saved timestamp
- [x] T016 [US1] Implement `frontend/assets/js/notes.js`: `loadNotes()` fetches `GET /api/notes` and renders note cards (preview + relative time + Marked.js rendered content on expand); `createNote()` calls `POST /api/notes`; `deleteNote(id)` with confirmation dialog calls `DELETE /api/notes/:id`; `openNote(id)` loads note into editor view
- [x] T017 [US1] Implement `frontend/assets/js/app.js`: app bootstrap on `DOMContentLoaded`; hash-based routing (`#list` → notes list view, `#note/:id` → editor view, `#new` → new note); initial load calls `loadNotes()`; navigation between views without full page reload

**Checkpoint**: US1 complete — full CRUD for notes works; Markdown renders correctly; note list is chronological

---

## Phase 4: User Story 2 — Classificar e Filtrar Notas por Hashtag (Priority: P2)

**Goal**: Hashtags extracted automatically from note content; sidebar lists all hashtags; click to filter; text search across notes

**Independent Test**: Create notes with `#trabalho` and `#pessoal`; click `#trabalho` in sidebar — only matching notes appear; type a search term — only matching notes appear; clear filter — all notes return

### Implementation

- [x] T018 [US2] Create `backend/internal/db/migrations/002_hashtags.sql`: `hashtags` table (id, name TEXT UNIQUE), `note_hashtags` junction table (note_id FK CASCADE, hashtag_id FK CASCADE, PRIMARY KEY composite); FTS5 virtual table `notes_fts` with `tokenize='unicode61'`; INSERT/UPDATE/DELETE triggers to keep `notes_fts` in sync with `notes`
- [x] T019 [US2] Create `backend/internal/models/hashtag.go`: `Hashtag` struct (name string, count int) with JSON tags
- [x] T020 [US2] Implement `backend/internal/db/hashtags.go`: `ListHashtags()` returns hashtags with note counts ordered alphabetically; `SyncNoteHashtags(tx, noteID, hashtags []string)` upserts hashtag names and rebuilds note_hashtags rows for the given note (delete existing, insert new)
- [x] T021 [US2] Update `backend/internal/db/notes.go`: add FTS5 search query `SearchNotes(q string)` using `notes_fts MATCH ?`; add `FilterByHashtag(hashtag string)` using JOIN on note_hashtags; update `CreateNote` and `UpdateNote` to call `SyncNoteHashtags` within a transaction
- [x] T022 [US2] Update `backend/internal/handlers/notes.go` `GET /api/notes`: parse `?q=` and `?hashtag=` query params; route to `SearchNotes`, `FilterByHashtag`, or `ListNotes` accordingly; populate `hashtags` array in each note response
- [x] T023 [US2] Implement `backend/internal/handlers/hashtags.go`: `GET /api/hashtags` returns hashtag list with counts
- [x] T024 [US2] Implement `frontend/assets/js/hashtags.js`: fetch `GET /api/hashtags` and render sidebar list; click handler adds `?hashtag=name` to `loadNotes()` call and highlights active hashtag; "Todos" button clears hashtag filter
- [x] T025 [US2] Add search input to notes list in `frontend/assets/js/notes.js`: `<input id="search">` with 300ms debounce that calls `loadNotes({q: searchTerm})`; clear button resets filter; combine with active hashtag filter

**Checkpoint**: US2 complete — hashtag sidebar shows live counts; click-to-filter works; full-text search returns matching notes

---

## Phase 5: User Story 3 — Fixar Notas no Topo da Lista (Priority: P3)

**Goal**: Notes can be pinned; pinned notes always appear first in the list (chronological among themselves), followed by unpinned notes

**Independent Test**: Create 3 notes; pin the oldest one; verify it appears first in the list above newer unpinned notes; unpin it; verify it returns to chronological position

### Implementation

- [x] T026 [US3] Update `backend/internal/db/notes.go` `ListNotes` (and `FilterByHashtag`/`SearchNotes`): ensure `ORDER BY pinned DESC, created_at DESC` is applied consistently in all note list queries
- [x] T027 [US3] Add `PUT /api/notes/{id}/pin` handler to `backend/internal/handlers/notes.go`: accepts `{"pinned": true/false}`, updates `notes.pinned` column, returns `{"id": N, "pinned": bool}`
- [x] T028 [US3] Add pin toggle UI to note cards in `frontend/assets/js/notes.js`: render pin icon (📌 or SVG) on each note card; click calls `PUT /api/notes/:id/pin` with toggled state; re-render list after toggle to reflect new ordering

**Checkpoint**: US3 complete — pinned notes consistently appear at top across all filter/search modes

---

## Phase 6: User Story 4 — Associar Arquivos e Imagens às Notas (Priority: P4)

**Goal**: Upload images and documents to a note; images display inline; documents appear as download links; files stored on external volume; deleted when note is deleted

**Independent Test**: Open a note; upload a JPEG — image appears inline in rendered note; upload a PDF — PDF link appears; delete the note; verify both files are removed from `FILES_PATH`

### Implementation

- [x] T029 [US4] Create `backend/internal/db/migrations/003_attachments.sql`: `attachments` table (id, note_id FK ON DELETE CASCADE, stored_filename TEXT, original_name TEXT, mime_type TEXT, size_bytes INTEGER, created_at)
- [x] T030 [US4] Create `backend/internal/models/attachment.go`: `Attachment` struct (id, note_id, stored_filename, original_name, mime_type, size_bytes, url, created_at) with JSON tags
- [x] T031 [US4] Implement `backend/internal/services/files.go`: `SaveFile(noteID int, header *multipart.FileHeader, filesPath string) (*Attachment, error)` — validates MIME type (allowlist: `image/*`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.*`), validates size ≤ `MAX_UPLOAD_BYTES`, generates UUID v4 filename preserving extension, writes to `FILES_PATH/<uuid>.<ext>`; `DeleteFile(storedFilename, filesPath string) error`
- [x] T032 [US4] Implement `backend/internal/db/attachments.go`: `CreateAttachment(attachment)`, `GetAttachmentsByNote(noteID)`, `GetAttachment(id)`, `DeleteAttachment(id)` (returns stored_filename for physical deletion)
- [x] T033 [US4] Implement `backend/internal/handlers/attachments.go`: `POST /api/notes/{id}/attachments` (multipart upload, calls `files.SaveFile` + `db.CreateAttachment`, returns attachment JSON per `contracts/api.md`); `DELETE /api/notes/{id}/attachments/{attachmentID}` (calls `db.DeleteAttachment` + `files.DeleteFile`); `GET /files/{filename}` (serve file from `FILES_PATH` with correct `Content-Type` header and `Content-Disposition` for PDFs)
- [x] T034 [US4] Update `backend/internal/handlers/notes.go` `DELETE /api/notes/{id}`: before deleting note from DB, fetch all attachments and call `files.DeleteFile` for each; use a transaction so DB and filesystem stay consistent
- [x] T035 [US4] Implement `frontend/assets/js/attachments.js`: render attach button on note editor view; file input accepting `image/*,application/pdf,.doc,.docx`; upload via `fetch POST` multipart; on success, inject image as `<img>` in rendered note or PDF as `<a href="/files/...">` link; delete button per attachment with confirmation

**Checkpoint**: US4 complete — file upload, inline display, download links, and cascade delete all working; `/files/` endpoint serves correct MIME types

---

## Phase 7: User Story 5 — Gerenciar Hashtags (Priority: P5)

**Goal**: View all hashtags with counts; rename a hashtag (updates all notes); delete a hashtag (removes from all notes)

**Independent Test**: Create notes with `#old`; open hashtag manager; rename `#old` to `#new` — verify all notes now contain `#new`; delete `#new` — verify notes no longer contain it and it disappears from sidebar

### Implementation

- [x] T036 [US5] Implement `backend/internal/services/hashtags.go`: `RenameHashtag(tx, oldName, newName string)` — replaces all occurrences of `#oldName` with `#newName` in `notes.content` using SQL `REPLACE()`, updates `hashtags.name`, rebuilds `note_hashtags` for all affected notes; `DeleteHashtag(tx, name string)` — removes all occurrences of `#name` from `notes.content`, deletes hashtag row (CASCADE removes `note_hashtags`)
- [x] T037 [US5] Update `backend/internal/handlers/hashtags.go`: add `PUT /api/hashtags/{name}` (calls `services.RenameHashtag`, returns updated hashtag); add `DELETE /api/hashtags/{name}` (calls `services.DeleteHashtag`, returns 204); validate `new_name` not already taken (409 Conflict)
- [x] T038 [US5] Add hashtag manager modal to `frontend/assets/js/hashtags.js`: "Gerenciar" button opens modal; lists all hashtags with rename (inline edit) and delete (with confirmation) actions; calls `PUT /api/hashtags/:name` and `DELETE /api/hashtags/:name`; refreshes sidebar and notes list after changes

**Checkpoint**: US5 complete — hashtag rename/delete propagates correctly across all notes; sidebar reflects updates immediately

---

## Phase 8: User Story 6 — Interface Clara/Escura e PWA (Priority: P6)

**Goal**: Dark/light theme toggle persisted in localStorage; app installable as PWA on iOS and Android; offline read-only (view notes without network)

**Independent Test**: Toggle to dark theme; close and reopen — dark theme persists; on mobile, "Add to Home Screen" installs app as standalone; disconnect network — existing notes list is visible; attempt to create note — error shown

### Implementation

- [x] T039 [US6] Implement `frontend/assets/js/theme.js`: on load, read `localStorage.getItem('theme')` (default: `'light'`); apply theme by toggling class `data-theme="dark"` on `<html>`; expose `toggleTheme()` function; add toggle button to app header that calls `toggleTheme()` and persists to `localStorage`
- [x] T040 [P] [US6] Update `frontend/assets/css/app.css`: add `[data-theme="dark"]` selector block overriding all CSS custom properties with dark palette values; ensure all UI elements (modals, cards, editor, sidebar) use the CSS variables for automatic theme switching
- [x] T041 [P] [US6] Create `frontend/manifest.json`: `name: "Notas"`, `short_name: "Notas"`, `display: "standalone"`, `start_url: "/"`, `theme_color: "#4a90e2"`, `background_color: "#ffffff"`, `icons` array with 192px and 512px PNG placeholders, `categories: ["productivity"]`
- [x] T042 [US6] Create `frontend/sw.js`: service worker implementing cache-first strategy for app shell (cache `index.html`, CSS, JS on `install`); stale-while-revalidate for `GET /api/notes` and `GET /api/notes/*` (serve cached, update in background); network-only for `POST`, `PUT`, `DELETE` requests (return `503 Offline` response if no network); register in `frontend/assets/js/app.js` with `navigator.serviceWorker.register('/sw.js')`

**Checkpoint**: US6 complete — theme toggle works and persists; Lighthouse PWA score ≥ 90; offline note list visible with network disconnected

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final packaging, error hardening, Docker validation

- [x] T043 Implement `GET /health` endpoint in `backend/internal/handlers/` (or inline in main.go): returns `{"status":"ok","db":"connected","version":"1.0.0"}`; register in chi router at `/health`
- [x] T044 [P] Add startup validation in `backend/cmd/server/main.go`: if `DB_PATH` or `FILES_PATH` are empty or parent directories don't exist, print clear error message and exit with code 1 (prevents silent failures in UNRAID)
- [x] T045 [P] Build Docker image locally and verify final compressed size is < 30MB using `docker image inspect` + `docker save | gzip | wc -c`; optimize with `-ldflags="-s -w"` if needed
- [x] T046 Run Lighthouse audit (`lighthouse http://localhost:8080 --only-categories=pwa,performance,accessibility`) and resolve any PWA or critical accessibility issues in `frontend/` files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — T001–T004 can start immediately; T003 and T004 can run in parallel
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — no dependencies on other user stories
- **US2 (Phase 4)**: Depends on Phase 2 + US1 (reuses `db/notes.go`, `handlers/notes.go`, `notes.js`)
- **US3 (Phase 5)**: Depends on Phase 2 + US1 (`pinned` field in notes table); independent of US2
- **US4 (Phase 6)**: Depends on Phase 2 + US1; independent of US2, US3
- **US5 (Phase 7)**: Depends on US2 (hashtag infrastructure must exist)
- **US6 (Phase 8)**: Depends on Phase 2 + US1; T039/T040 parallel with T041/T042
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

```
Phase 1 (Setup) → Phase 2 (Foundation) → US1 (P1) → US2 (P2) → US5 (P5)
                                       → US3 (P3)
                                       → US4 (P4)
                                       → US6 (P6) ← can overlap with US3/US4
```

### Within Each User Story

- DB layer (migrations + queries) before service layer
- Service layer before HTTP handlers
- HTTP handlers before frontend JS
- Frontend JS files can be worked in parallel if they don't share state

### Parallel Opportunities

- T003 (Dockerfile) and T004 (GitHub Actions) can run in parallel in Phase 1
- T007 (models/note.go) can be written in parallel with T006 (db.go)
- T039 (theme.js) and T040 (dark mode CSS) and T041 (manifest.json) can run in parallel in Phase 8
- T044 (startup validation) and T045 (Docker size check) can run in parallel in Phase 9

---

## Parallel Execution Examples

### Phase 3 (US1) — parallelizable tasks

```text
# Run in parallel after T011 (models) is complete:
Task T013: Implement handlers/notes.go (backend API)
Task T015: Implement editor.js (frontend)
Task T016: Implement notes.js (frontend)
```

### Phase 8 (US6) — parallelizable tasks

```text
# Run all in parallel:
Task T039: theme.js (light/dark toggle)
Task T040: dark mode CSS variables
Task T041: manifest.json (PWA manifest)
# Then:
Task T042: sw.js (service worker — registers in app.js)
```

---

## Implementation Strategy

### MVP (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T004)
2. Complete Phase 2: Foundation (T005–T010)
3. Complete Phase 3: US1 (T011–T017)
4. **STOP and VALIDATE**: Create/edit/delete notes with Markdown rendering works
5. Build Docker image and verify it starts on UNRAID with `DB_PATH` env var

### Incremental Delivery

1. **Setup + Foundation** → App skeleton starts and serves index.html
2. **+ US1** → Full note CRUD with Markdown → MVP ready
3. **+ US2** → Hashtag sidebar + full-text search → Organisable
4. **+ US3** → Pin notes → Quick access to important notes
5. **+ US4** → File attachments → Rich notes with images/docs
6. **+ US5** → Hashtag manager → Taxonomy maintenance
7. **+ US6** → PWA + dark mode → Mobile-first experience
8. **Polish** → Production-ready Docker image for UNRAID

---

## Notes

- **No branch creation** — all commits go to `main` branch directly per project rules
- **No credentials in commits** — GitHub Actions uses `GITHUB_TOKEN` (auto-provided, never stored)
- All file paths are relative to repository root
- [P] tasks = safe to run in parallel (different files, no unresolved dependencies)
- [Story] label maps every task to its user story for traceability
- Each user story phase is independently completable and testable
- Commit after completing each phase checkpoint
- Total tasks: **46** across 9 phases
