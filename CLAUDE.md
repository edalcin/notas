# notas Development Guidelines

## Project Rules

- Este projeto deve ter apenas o `main` branch. Nunca criar um novo branch. Comitar sempre no `main` branch.
- Nunca fazer commit de credenciais. Usar sempre exemplos genéricos.

Auto-generated from all feature plans. Last updated: 2026-03-29

## Inspiration

This project is inspired by [usememos/memos](https://github.com/usememos/memos). The UI and UX should follow the same feed-style layout and aesthetic as memos.

## Active Technologies

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

- 001-web-notes-app: Added Go 1.23 (backend), ES2022 Vanilla JS (frontend) + `chi` (HTTP router), `modernc.org/sqlite` (pure-Go SQLite driver), EasyMDE v2 (Markdown editor), Marked.js (Markdown renderer)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
