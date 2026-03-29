# Research: Sistema de Anotações Web com Markdown

**Phase**: 0 — Technology Research
**Date**: 2026-03-29
**Feature**: 001-web-notes-app

## Decision 1: Backend Language & Runtime

**Decision**: Go (1.23+) with `chi` router

**Rationale**: Go multi-stage Docker build produces a statically-linked binary of ~8-12MB. Combined with Alpine 3.19 base (~5-8MB), the final image lands at ~15-25MB — well under the 100MB constraint. Python/FastAPI on Alpine would require ~70-90MB before adding any dependencies, leaving almost no headroom. Go also compiles to a single self-contained binary, simplifying the Docker setup.

**Alternatives considered**:
- Python + FastAPI (Alpine): ~70-90MB, tight margin; Alpine+Python known incompatibilities (musl vs glibc)
- Node.js (Fastify + Alpine): ~70-150MB depending on node_modules; harder to keep under 100MB
- Rust (Axum): smallest possible binary but significantly longer dev time for a CRUD app

---

## Decision 2: SQLite Driver

**Decision**: `modernc.org/sqlite` (pure Go, no CGO)

**Rationale**: Eliminates the C compiler toolchain from the Docker builder stage. With `CGO_ENABLED=0`, Go produces a fully static binary, enabling a clean multi-stage build — the final Alpine image needs no C runtime libraries. Performance penalty (~2x slower on writes) is irrelevant for a single-user notes app. Simpler Dockerfile, simpler cross-compilation.

**Alternatives considered**:
- `mattn/go-sqlite3`: Requires CGO + gcc in builder, C runtime in final image, cannot cross-compile easily. Adds ~5-10MB to builder complexity. Faster but unnecessary for this use case.

---

## Decision 3: HTTP Router

**Decision**: `chi` (lightweight, stdlib-compatible)

**Rationale**: Chi is idiomatic Go — it uses `net/http` interfaces throughout, making the code portable and easy to test. Adds only ~1.5MB to binary. Provides clean URL parameter routing (`:id`), composable middleware, and native multipart file upload handling. Simpler than Echo/Fiber for a CRUD REST API.

**Alternatives considered**:
- `net/http` (stdlib): Would work but requires more boilerplate for routing; acceptable for 3-5 routes, unwieldy for 15+ endpoints
- `fiber`: Uses fasthttp (different interface from net/http), faster but more opinionated; unnecessary performance for single-user app
- `echo`: Good alternative, slightly more batteries-included than needed

---

## Decision 4: Frontend Markdown Editor

**Decision**: EasyMDE (v2) for editing + Marked.js for rendering

**Rationale**: EasyMDE is a well-maintained SimpleMDE fork (~85KB gzipped) built on CodeMirror 5. It provides a toolbar, live preview, and full mobile keyboard support out of the box. Marked.js (~22KB) handles read-only Markdown rendering efficiently. Both are pure JS with no build step required — they can be loaded as ES modules or scripts directly.

**Alternatives considered**:
- CodeMirror 6: More powerful and tree-shakeable, but requires a build step (Rollup/Webpack); adds frontend build complexity
- Toast UI Editor: ~150-200KB, WYSIWYG mode is unnecessary overhead
- SimpleMDE: Older, unmaintained, no longer receiving security updates

---

## Decision 5: Frontend Architecture

**Decision**: Vanilla JavaScript (ES2022 modules) — no frontend framework

**Rationale**: For a single-user CRUD app with ~6 screens/views, a framework (React, Vue, Svelte) adds build tooling complexity and bundle size without meaningful benefit. Modern vanilla JS with ES modules, `fetch`, `localStorage`, and the DOM API is sufficient. Keeps the frontend buildable without Node.js/npm in the Docker build process (HTML/JS/CSS copied directly). Total frontend bundle: ~200-300KB uncompressed.

**Alternatives considered**:
- Svelte: Would compile to ~10KB runtime + minimal JS; good choice but adds build step
- Alpine.js: 3KB reactivity library; viable but an extra dependency
- React/Vue: Adds 40-100KB runtime + build toolchain; overkill for this app

---

## Decision 6: Frontend Asset Delivery

**Decision**: `//go:embed` to bundle frontend into Go binary

**Rationale**: Embedding frontend assets into the Go binary (using Go's native `embed` package) produces a single self-contained executable. No separate static file server (nginx/caddy) needed, no file path configuration, no missing assets in Docker. The frontend adds only ~3-5MB to the binary. Docker image becomes: `COPY --from=builder /app /app` — one line.

**Tradeoffs accepted**:
- Must recompile Go binary when frontend changes (acceptable: GitHub Actions handles this)
- Cannot serve assets via CDN (N/A: single-user, local network)

---

## Decision 7: PWA Caching Strategy

**Decision**: Cache-first for static assets + stale-while-revalidate for notes list; writes always require network

**Rationale**: The spec requires "read-only offline" — users can view existing notes offline but cannot create/edit without connection. Strategy:
- **App shell** (HTML, JS, CSS): Cache-first, cached on install; ensures app loads instantly
- **GET /api/notes**: Stale-while-revalidate — serve cached list immediately, update in background
- **GET /api/notes/:id**: Cache-first — individual note content served from cache
- **Write operations** (POST, PUT, DELETE): Network-only — return offline error if no connection

Service worker implemented as a vanilla JS file (no Workbox dependency to keep bundle small).

---

## Decision 8: Docker Final Image

**Decision**: Multi-stage build → `FROM alpine:3.19` final stage

**Rationale**: Alpine provides CA certificates (`ca-certificates`) and timezone data (`tzdata`) needed for production deployments (~5-8MB overhead vs scratch). The Go binary is statically linked (CGO_ENABLED=0), so no C runtime dependencies. Expected final image: **18-25MB**.

Build stages:
1. `golang:1.23-alpine` — compile Go binary with embedded frontend
2. `alpine:3.19` — copy binary, add ca-certificates + tzdata, run as non-root

**Alternatives considered**:
- `FROM scratch`: ~6MB smaller but no CA certs, no timezone data, no shell for debugging
- `FROM distroless/static`: Good alternative (~2MB), but Alpine is more familiar for UNRAID users

---

## Expected Docker Image Size Breakdown

| Component | Size |
|-----------|------|
| Alpine 3.19 base | ~5MB |
| ca-certificates + tzdata | ~3MB |
| Go binary (API + embedded frontend) | ~12-15MB |
| **Total** | **~20-23MB** |
