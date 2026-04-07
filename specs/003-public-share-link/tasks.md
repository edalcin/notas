# Tasks: Public Note Share Link

**Input**: Design documents from `/specs/003-public-share-link/`  
**Prerequisites**: plan.md ✓ spec.md ✓ research.md ✓ data-model.md ✓ contracts/ ✓ quickstart.md ✓

**Tests**: Not requested — no test tasks generated.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup

**Purpose**: No new project initialization needed — project already exists. This phase creates the migration file that unlocks all other work.

- [x] T001 Create migration file `internal/db/migrations/007_share_token.sql` — add `share_token TEXT` column to `notes` table and create partial unique index `idx_notes_share_token ON notes(share_token) WHERE share_token IS NOT NULL`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core data layer changes required by ALL user stories. No user story work can begin until this phase is complete.

**⚠️ CRITICAL**: Phases 3–6 all depend on this phase being complete.

- [x] T002 Add `Shared bool` field to `Note` struct in `internal/models/note.go`; ensure it serialises as `"shared"` in JSON; map it from `(share_token IS NOT NULL)` in SQL scan
- [x] T003 Add share token DB functions to `internal/db/notes.go` (depends on T002): `generateShareToken() (string, error)` using `crypto/rand` 32 bytes hex-encoded; `SetShareToken(noteID int64) (string, error)` — inserts only if NULL, then returns current value; `ClearShareToken(noteID int64) error`; `GetNoteByShareToken(token string) (*models.Note, error)` — filters `deleted_at IS NULL`; `ListSharedNotes(limit, offset int) ([]models.Note, int, error)`
- [x] T004 Update existing `ListNotes`, `FilterByHashtag`, `SearchNotes`, and `GetNote` queries in `internal/db/notes.go` to SELECT `(share_token IS NOT NULL) AS shared` and scan into `Note.Shared`

**Checkpoint**: Run `go build ./...` — must compile cleanly before proceeding.

---

## Phase 3: User Story 1 — Gerar link público para uma nota (Priority: P1) 🎯 MVP

**Goal**: Authenticated user clicks a 🔗 icon on any note, a modal opens showing the public URL with a "Copiar link" button. Calling the endpoint a second time returns the same URL.

**Independent Test**: Click the share icon on a note → modal opens with URL → copy it → open in incognito → note content visible (requires Phase 4 complete for incognito test; modal + URL generation alone are testable with a direct API call).

- [x] T005 [P] [US1] Add share modal HTML to `frontend/index.html`: a `<dialog id="share-modal">` (or `<div>` overlay) containing a URL `<input readonly>`, a "Copiar link" `<button id="share-copy-btn">`, and a "Revogar link" `<button id="share-revoke-btn">` (hidden by default until a token exists); place it alongside the existing trash confirmation modal
- [x] T006 [P] [US1] Add share icon button (🔗) to each note card in `frontend/assets/js/notes.js`: insert `<button class="btn-share" data-id="${note.id}" data-shared="${note.shared}" title="Compartilhar">🔗</button>` alongside `.btn-pin` and `.btn-trash`; add click handler that calls `openShareModal(noteId)` from `shared.js`
- [x] T007 [P] [US1] Add CSS for share button and share modal to `frontend/assets/css/app.css`: `.btn-share` styled like `.btn-pin`; `.btn-share--active` with a distinct colour/opacity to indicate active share; `#share-modal` overlay/dialog styles matching existing modal aesthetics
- [x] T008 [US1] Implement `POST /api/notes/{id}/share` handler in `internal/handlers/notes.go` (depends on T003, T004): call `db.SetShareToken(id)`, build full URL from `r.Host`, return JSON `{"token": "...", "url": "http(s)://host/s/TOKEN", "shared": true}`; return 404 if note not found or trashed
- [x] T009 [US1] Register `POST /api/notes/{id}/share` route inside the `/api/notes/{id}` subrouter in `main.go` (depends on T008)
- [x] T010 [US1] Create `frontend/assets/js/shared.js` with `openShareModal(noteId)` function (depends on T005): calls `POST /api/notes/{noteId}/share`, populates the URL input in the modal, shows "Copiar link" and conditionally "Revogar link" buttons, binds the copy button to `navigator.clipboard.writeText(url)` with a brief "Copiado!" feedback

**Checkpoint**: Authenticated user can click 🔗 on a note, see the share modal with URL, and copy the URL to clipboard. API returns consistent URL on repeated calls.

---

## Phase 4: User Story 2 — Acessar nota pública sem autenticação (Priority: P2)

**Goal**: Anyone with the share URL can access and read the note in a minimal read-only page without any PIN prompt.

**Independent Test**: Open the share URL from Phase 3 in an incognito window — note content renders as Markdown, no PIN overlay shown.

- [x] T011 [US2] Exempt the `/s/` path prefix from PIN auth in `internal/handlers/auth.go`: in `PINMiddleware`, add `strings.HasPrefix(r.URL.Path, "/s/")` to the existing exemption condition alongside `/health` and `/api/auth/login`
- [x] T012 [US2] Create `internal/handlers/public.go` (depends on T003, T011): implement in-memory fixed-window rate limiter (30 req/min per client IP using `sync.Mutex`-protected `map[string]int` reset by `time.Ticker` goroutine); implement `PublicNote` handler that looks up note by token via `db.GetNoteByShareToken(token)`, returns 429 HTML on rate limit, 404 HTML on not found, and 200 with a standalone minimal HTML page on success — the HTML page must include marked.js (via CDN matching the version in `frontend/index.html`) and render `note.Content` as Markdown; the page must NOT include the app's sidebar, editor, or PIN overlay
- [x] T013 [US2] Register `GET /s/{token}` route in `main.go` (depends on T012): add BEFORE the SPA catch-all `/*` route; this route must not be inside any authenticated subrouter

**Checkpoint**: Open a valid share URL in incognito → note content is displayed as rendered Markdown, no PIN prompt. Open an invalid/revoked URL → displays error message.

---

## Phase 5: User Story 3 — Visualizar todas as notas compartilhadas (Priority: P3)

**Goal**: A "Compartilhadas" section in the left sidebar lists all notes with active share links, with access to the share modal for each.

**Independent Test**: Share 2–3 notes, click "Compartilhadas" in the sidebar → all shared notes appear. Revoke one → it disappears from the list immediately (requires Phase 6 for revoke).

- [x] T014 [P] [US3] Add "Compartilhadas" nav button to sidebar in `frontend/index.html`: `<button class="nav-item" id="btn-shared-notes"><span class="nav-icon">🔗</span><span>Compartilhadas</span></button>` — placed after "Arquivos anexados" and before "Lixeira"
- [x] T015 [US3] Implement `GET /api/notes/shared` handler in `internal/handlers/notes.go` (depends on T003, T004): calls `db.ListSharedNotes(limit, offset)`, returns JSON `{"notes": [...], "total": N}` with same note shape as existing list endpoint; supports `?limit` and `?offset` query params
- [x] T016 [US3] Register `GET /api/notes/shared` route inside the `/api/notes` subrouter in `main.go` (depends on T015): IMPORTANT — register before `/{id}` subroute to avoid chi treating `shared` as a note ID
- [x] T017 [US3] Add shared notes view and list rendering to `frontend/assets/js/shared.js` (depends on T014): implement `loadSharedNotes()` that fetches `GET /api/notes/shared`, renders note cards using the same pattern as `notes.js`, and shows an empty-state message ("Nenhuma nota compartilhada") when the list is empty
- [x] T018 [US3] Wire up "Compartilhadas" nav button in `frontend/assets/js/app.js` (depends on T017): add click handler on `#btn-shared-notes` that hides the editor/notes feed and shows the shared notes view, following the same pattern as the "Lixeira" button handler
- [x] T019 [P] [US3] Add shared notes empty-state and view layout CSS to `frontend/assets/css/app.css`

**Checkpoint**: Clicking "Compartilhadas" shows the list of shared notes. Empty state message shown when none exist.

---

## Phase 6: User Story 4 — Revogar link público de uma nota (Priority: P4)

**Goal**: From the share modal, user can revoke the active link. The URL immediately becomes inaccessible and the note disappears from "Compartilhadas".

**Independent Test**: Open share modal of a shared note → click "Revogar link" → modal resets to "Gerar link" state → visit the old URL in incognito → 404/error page shown.

- [x] T020 [US4] Implement `DELETE /api/notes/{id}/share` handler in `internal/handlers/notes.go` (depends on T003): calls `db.ClearShareToken(id)`, returns 204 No Content; idempotent (also 204 if already null); returns 404 if note not found
- [x] T021 [US4] Register `DELETE /api/notes/{id}/share` route in `main.go` (depends on T020)
- [x] T022 [US4] Add revoke logic to share modal in `frontend/assets/js/shared.js` (depends on T010): bind `#share-revoke-btn` click to call `DELETE /api/notes/{noteId}/share`; on success, hide the revoke button, clear the URL input, update button text to "Gerar link", add CSS class `btn-share--active` removal from the note card; if "Compartilhadas" view is active, remove the revoked note from the rendered list

**Checkpoint**: Revoking a link via the modal invalidates the URL immediately. The share modal resets to "Gerar link". The note is removed from "Compartilhadas".

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Visual refinements and final validation.

- [x] T023 [P] Apply `btn-share--active` CSS class on note cards where `note.shared === true` in `frontend/assets/js/notes.js`: update the share button render to add/remove the class based on `data-shared` attribute — visual cue that the note is currently shared
- [x] T024 [P] Verify Service Worker cache busting works: the `swVersion` hash in `main.go` is computed from frontend file contents — confirm that changes to `shared.js`, `app.js`, `notes.js`, `app.css`, and `index.html` cause a new SW version on next build
- [x] T025 Manually validate all 5 test flows in `specs/003-public-share-link/quickstart.md` end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    └── Phase 2 (Foundational) ← BLOCKS ALL stories
            ├── Phase 3 (US1 - P1) → MVP
            │       └── Phase 4 (US2 - P2) ← needs T009 route for valid URL
            ├── Phase 5 (US3 - P3) ← independent from US2
            └── Phase 6 (US4 - P4) ← independent, but shares modal with US1/US3
                    └── Phase 7 (Polish)
```

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2 complete. No story dependencies.
- **US2 (P2)**: Requires Phase 2 + US1 (needs valid share URLs to test the public page).
- **US3 (P3)**: Requires Phase 2 complete. Independent from US1/US2 (backend side); frontend share modal (`shared.js`) from US1 is extended, not replaced.
- **US4 (P4)**: Requires US1 (share modal exists) and Phase 2 (DB clear query). Extends `shared.js`.

### Within Each User Story

- Backend handler → route registration (sequential — route depends on handler)
- Frontend HTML → JS → CSS can be parallel (different files)
- `internal/handlers/notes.go` tasks across stories are sequential (same file)
- `main.go` route registrations across stories are sequential (same file)

### Parallel Opportunities

Within **Phase 2**: T002 and T001 can run in parallel (different files). T003 and T004 depend on T002.

Within **Phase 3 (US1)**: T005, T006, T007 can all run in parallel (different files). T008 depends on T003/T004. T009 depends on T008. T010 depends on T005 and T008.

Within **Phase 5 (US3)**: T014 and T019 can run in parallel (different files). T015 depends on T003. T016 depends on T015. T017 depends on T014.

---

## Parallel Example: Phase 3 (US1)

```text
# Parallel group A — frontend scaffold (no backend dependency):
Task T005: Add share modal HTML to frontend/index.html
Task T006: Add share icon button to note cards in frontend/assets/js/notes.js
Task T007: Add share button + modal CSS to frontend/assets/css/app.css

# Sequential — backend:
Task T008: Implement POST /api/notes/{id}/share handler in internal/handlers/notes.go
Task T009: Register route in main.go (depends on T008)

# Sequential — frontend logic:
Task T010: Create shared.js with modal open logic (depends on T005, T008 deployed)
```

---

## Implementation Strategy

### MVP First (US1 + US2 only — minimum usable share feature)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002 → T003 → T004)
3. Complete Phase 3: US1 — generate link + copy modal
4. Complete Phase 4: US2 — public page accessible without PIN
5. **STOP and VALIDATE**: Share a note → open URL in incognito → content visible
6. Ship MVP

### Incremental Delivery

1. Setup + Foundational → Database ready
2. US1 + US2 → Share link works end-to-end (MVP)
3. US3 → "Compartilhadas" sidebar section
4. US4 → Revoke link
5. Polish → Visual active state, SW cache validation

---

## Notes

- `main.go` route registration tasks (T009, T013, T016, T021) all touch the same file — execute sequentially
- `internal/handlers/notes.go` handler tasks (T008, T015, T020) all touch the same file — execute sequentially
- `frontend/assets/js/shared.js` is created in T010 and extended in T017 and T022 — execute sequentially
- Route `GET /api/notes/shared` (T016) MUST be registered before `/{id}` subroute in chi to avoid routing ambiguity
- Route `GET /s/{token}` (T013) MUST be registered before the SPA catch-all `/*`
- The public page HTML template in `public.go` (T012) should read the marked.js version from `frontend/index.html` at implementation time for consistency
