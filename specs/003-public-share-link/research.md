# Research: Public Note Share Link

**Branch**: `003-public-share-link` | **Date**: 2026-04-07

## Decision Log

---

### D-001: Share Token Storage Location

**Decision**: Add `share_token TEXT` column directly to the existing `notes` table.

**Rationale**: A separate `share_tokens` table would add join complexity for no benefit in a single-user app. The token is a 1:1 attribute of a note (at most one active token per note). NULL = no active link, non-NULL = active link. This maps cleanly to a nullable column with a partial unique index.

**Alternatives considered**:
- Separate `share_tokens` table with FK to notes → unnecessary complexity, no gain at this scale
- Store tokens in a Go in-memory map → lost on restart, tokens would die with the server process

---

### D-002: Token Generation Strategy

**Decision**: 32 bytes from `crypto/rand`, hex-encoded = 64-character lowercase string.

**Rationale**: 256 bits of entropy makes brute-force or enumeration computationally infeasible (2^256 possibilities). `crypto/rand` is cryptographically secure. Hex encoding is URL-safe without padding concerns. The partial unique index in SQLite guarantees no collisions at insert time.

**Alternatives considered**:
- UUID v4 (122 bits) → sufficient, but 64-char hex is marginally harder to enumerate
- JWT signed with app secret → unnecessary complexity; tokens don't need to be self-describing or expirable
- Short codes (6-8 chars) → insufficient entropy for security without rate limiting alone

---

### D-003: Public Route Auth Exemption

**Decision**: Modify `PINMiddleware` in `internal/handlers/auth.go` to exempt paths with prefix `/s/`.

**Rationale**: The middleware currently has an explicit exemption list (`/health`, `/api/auth/login`). Adding `/s/` to this list is the minimal, localised change. The public handler lives at `/s/{token}` and returns a self-contained HTML page — it never needs session context.

**Alternatives considered**:
- Register `/s/{token}` on a separate chi router before middleware is applied → works but splits router registration across two places in main.go; harder to audit
- Apply middleware only to sub-routes via chi groups → requires restructuring existing router; higher blast radius

---

### D-004: Public Page Rendering Strategy

**Decision**: Server-side rendered standalone HTML page returned directly by the Go handler. Embeds a CDN copy of marked.js (same version used by the SPA) via a `<script>` tag for Markdown rendering.

**Rationale**: Avoids coupling the public page to the SPA's JS bundle. The public page has no auth state, no editor, no sidebar — embedding the full SPA would be wasteful and would require bypassing the PIN overlay logic. A minimal HTML template in the Go handler keeps the public page completely independent.

**Alternatives considered**:
- Serve index.html at `/s/{token}` and add a special JS mode → complicates app.js with conditional PIN bypass logic; fragile
- Pre-render Markdown server-side in Go (`goldmark` library) → would add a new dependency; Marked.js is already the app's canonical renderer so consistency matters

**Marked.js version**: Must match `frontend/index.html` import. Read the version from the existing SPA page at implementation time.

---

### D-005: Rate Limiting Implementation

**Decision**: In-memory fixed-window rate limiter, 30 requests/minute per client IP, implemented in the public note handler using a `sync.Mutex`-protected `map[string]int` reset by a `time.Ticker` goroutine.

**Rationale**: A personal single-user app has no need for distributed rate limiting. In-memory is sufficient and adds zero dependencies. 30 req/min allows a human to refresh the page repeatedly but makes automated token enumeration impractical (at 30/min, iterating 2^64 tokens takes millions of years).

**Alternatives considered**:
- Redis-backed rate limiter → overkill; no Redis in this stack
- `golang.org/x/time/rate` token bucket → good library but adds an import; fixed window map is simpler and sufficient
- Rate limit at reverse-proxy level (nginx) → not applicable for a self-hosted binary

---

### D-006: "Compartilhadas" Sidebar Section

**Decision**: New `GET /api/notes/shared` endpoint returns the list of notes with active share tokens. A new `frontend/assets/js/shared.js` file handles the view (list rendering) and the share modal (generate link, copy, revoke).

**Rationale**: Follows the same pattern as the existing "Lixeira" section: a sidebar button triggers a view switch, the view fetches from a dedicated API endpoint, and cards are rendered. Keeping shared.js separate avoids bloating notes.js and makes the feature independently testable.

**Share modal state machine**:
- Note has no token → shows "Gerar link" button only
- Note has active token → shows URL + "Copiar" button + "Revogar link" button
- After revoke → modal transitions back to "Gerar link" state without closing

---

### D-007: Note Card Share Icon

**Decision**: Add a link icon button (🔗) to each note card, positioned alongside the pin (📌/📍) and trash (🗑️) buttons.

**Rationale**: Matches the user's explicit request ("ícone de link, junto com os ícones de Ficar/Desafixar e Mover para a Lixeira"). The icon doubles as a visual indicator: if the note already has an active share link, the icon could have a distinct style (e.g., active/filled appearance), but a basic icon is sufficient for MVP.

**Active state indicator**: If `share_token` is non-null in the note data from the API, the share button gets a CSS class `btn-share--active` to visually indicate the note is currently shared. This requires the API to include `share_token` (or a boolean `shared: true`) in the note list response.

**API change**: Add `"shared": bool` to the note JSON response (no token value leaked to frontend list responses — only the share endpoint returns the token URL).
