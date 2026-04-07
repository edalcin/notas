# Implementation Plan: Public Note Share Link

**Branch**: `003-public-share-link` | **Date**: 2026-04-07 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/003-public-share-link/spec.md`

## Summary

Adds per-note public sharing: a share icon on each note card generates a random token stored in the `notes` table. A new public route `/s/{token}` serves a minimal read-only HTML page with the note's Markdown rendered, bypassing PIN auth. A sidebar section "Compartilhadas" lists all notes with active share links. The share modal (triggered by the icon) hosts copy-link and revoke-link actions. A simple in-memory rate limiter protects the public endpoint against token enumeration.

## Technical Context

**Language/Version**: Go 1.23 (backend), ES2022 Vanilla JS (frontend)  
**Primary Dependencies**: `github.com/go-chi/chi/v5` (router), `modernc.org/sqlite` (pure-Go SQLite), `marked.js` (Markdown renderer, already embedded in frontend)  
**Storage**: SQLite — new `share_token TEXT` column on existing `notes` table via migration `007_share_token.sql`  
**Testing**: No automated test infrastructure exists in the project  
**Target Platform**: Linux/Windows server (self-hosted), served via Go's `net/http`  
**Project Type**: Web application (Go backend + Vanilla JS SPA frontend)  
**Performance Goals**: Public page load < 1s; rate limit 30 req/min per IP on public endpoint  
**Constraints**: No external services; in-memory rate limiter (no Redis); token entropy ≥ 256 bits  
**Scale/Scope**: Personal single-user app; in-memory structures safe for scale

## Constitution Check

No constitution.md found — no gate violations applicable.

## Project Structure

### Documentation (this feature)

```text
specs/003-public-share-link/
├── plan.md              ← This file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/           ← Phase 1 output
│   └── share-api.md
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code Changes

```text
# Backend (Go)
internal/db/migrations/
└── 007_share_token.sql          ← NEW: adds share_token column + unique index

internal/models/
└── note.go                      ← MODIFY: add ShareToken field

internal/db/
└── notes.go                     ← MODIFY: add share token CRUD queries

internal/handlers/
├── notes.go                     ← MODIFY: add Share, Unshare, ListShared handlers
└── public.go                    ← NEW: public note page handler + in-memory rate limiter

internal/handlers/
└── auth.go                      ← MODIFY: exempt /s/ prefix in PINMiddleware

main.go                          ← MODIFY: register new routes (share API + public page)

# Frontend
frontend/index.html              ← MODIFY: add sidebar nav "Compartilhadas" + share modal HTML
frontend/assets/js/
├── notes.js                     ← MODIFY: add share icon button to note card rendering
├── shared.js                    ← NEW: shared notes view + share modal logic
└── app.js                       ← MODIFY: wire up "Compartilhadas" nav button
frontend/assets/css/
└── app.css                      ← MODIFY: share button, share modal, shared view styles
```

**Structure Decision**: Web application layout (backend/ + frontend/ separation) per existing project structure. No new top-level directories needed.

## Complexity Tracking

No constitution violations. No extra complexity table needed.
