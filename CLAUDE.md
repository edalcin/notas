# notas Development Guidelines

## Project Rules

- Este projeto deve ter apenas o `main` branch. Nunca criar um novo branch. Comitar sempre no `main` branch.
- Nunca fazer commit de credenciais. Usar sempre exemplos genéricos.

Auto-generated from all feature plans. Last updated: 2026-04-08

## Inspiration

This project is inspired by [usememos/memos](https://github.com/usememos/memos). The UI and UX should follow the same feed-style layout and aesthetic as memos.

## Active Technologies
- Go 1.23 (backend), ES2022 Vanilla JS (frontend) + chi (HTTP router), modernc.org/sqlite (pure-Go SQLite), Marked.js (Markdown renderer) (002-trash-restore-notes)
- SQLite — campo `deleted_at DATETIME` adicionado via migration `006_trash.sql` (002-trash-restore-notes)
- Go 1.23 (backend), ES2022 Vanilla JS (frontend) + `github.com/go-chi/chi/v5` (router), `modernc.org/sqlite` (pure-Go SQLite), `marked.js` (Markdown renderer, already embedded in frontend) (003-public-share-link)
- SQLite — new `share_token TEXT` column on existing `notes` table via migration `007_share_token.sql` (003-public-share-link)
- Go 1.23 (backend), ES2022 Vanilla JS (frontend) + `github.com/go-chi/chi/v5` (router), `modernc.org/sqlite`, `marked.js` + `dompurify@3` (CDN) (004-fix-critical-vulns)
- SQLite via `modernc.org/sqlite` — sem mudanças de schema (004-fix-critical-vulns)

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
- 004-fix-critical-vulns: Added Go 1.23 (backend), ES2022 Vanilla JS (frontend) + `github.com/go-chi/chi/v5` (router), `modernc.org/sqlite`, `marked.js` + `dompurify@3` (CDN)
- 003-public-share-link: Added Go 1.23 (backend), ES2022 Vanilla JS (frontend) + `github.com/go-chi/chi/v5` (router), `modernc.org/sqlite` (pure-Go SQLite), `marked.js` (Markdown renderer, already embedded in frontend)
- 002-trash-restore-notes: Added Go 1.23 (backend), ES2022 Vanilla JS (frontend) + chi (HTTP router), modernc.org/sqlite (pure-Go SQLite), Marked.js (Markdown renderer)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Agent skills

### Issue tracker

Issues live as GitHub issues, managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context layout (`CONTEXT.md` + `docs/adr/` at the repo root). See `docs/agents/domain.md`.
