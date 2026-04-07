# notas Development Guidelines

## Project Rules

- Este projeto deve ter apenas o `main` branch. Nunca criar um novo branch. Comitar sempre no `main` branch.
- Nunca fazer commit de credenciais. Usar sempre exemplos genéricos.

Auto-generated from all feature plans. Last updated: 2026-04-07

## Inspiration

This project is inspired by [usememos/memos](https://github.com/usememos/memos). The UI and UX should follow the same feed-style layout and aesthetic as memos.

## Active Technologies
- Go 1.23 (backend), ES2022 Vanilla JS (frontend) + chi (HTTP router), modernc.org/sqlite (pure-Go SQLite), Marked.js (Markdown renderer) (002-trash-restore-notes)
- SQLite — campo `deleted_at DATETIME` adicionado via migration `006_trash.sql` (002-trash-restore-notes)
- Go 1.23 (backend), ES2022 Vanilla JS (frontend) + `github.com/go-chi/chi/v5` (router), `modernc.org/sqlite` (pure-Go SQLite), `marked.js` (Markdown renderer, already embedded in frontend) (003-public-share-link)
- SQLite — new `share_token TEXT` column on existing `notes` table via migration `007_share_token.sql` (003-public-share-link)

- Go 1.23 (backend), ES2022 Vanilla JS (frontend) + `chi` (HTTP router), `modernc.org/sqlite` (pure-Go SQLite driver), Marked.js (Markdown renderer) (001-web-notes-app)
- Frontend: plain auto-resizing textarea editor (no EasyMDE), feed-first layout (editor at top, notes as markdown cards below), memos-inspired cream/dark color palette

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

# Add commands for Go 1.23 (backend), ES2022 Vanilla JS (frontend)

## Code Style

Go 1.23 (backend), ES2022 Vanilla JS (frontend): Follow standard conventions

## Recent Changes
- 003-public-share-link: Added Go 1.23 (backend), ES2022 Vanilla JS (frontend) + `github.com/go-chi/chi/v5` (router), `modernc.org/sqlite` (pure-Go SQLite), `marked.js` (Markdown renderer, already embedded in frontend)
- 002-trash-restore-notes: Added Go 1.23 (backend), ES2022 Vanilla JS (frontend) + chi (HTTP router), modernc.org/sqlite (pure-Go SQLite), Marked.js (Markdown renderer)

- 001-web-notes-app: Added Go 1.23 (backend), ES2022 Vanilla JS (frontend) + `chi` (HTTP router), `modernc.org/sqlite` (pure-Go SQLite driver), EasyMDE v2 (Markdown editor), Marked.js (Markdown renderer)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
