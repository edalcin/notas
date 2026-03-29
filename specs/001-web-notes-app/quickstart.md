# Quickstart: Sistema de Anotações Web com Markdown

**Branch**: `001-web-notes-app`
**Stack**: Go 1.23 + chi + modernc.org/sqlite | Vanilla JS + EasyMDE | Docker (Alpine 3.19)

---

## Prerequisites

- Go 1.23+
- Node.js (optional — only needed if you add a frontend build step)
- Docker (for containerized runs)
- Git

---

## Local Development (without Docker)

### 1. Clone and configure

```bash
git clone https://github.com/edalcin/<repo>.git
cd <repo>
```

### 2. Set environment variables

```bash
export DB_PATH=/tmp/notes-dev.db
export FILES_PATH=/tmp/notes-files
export PORT=8080
mkdir -p $FILES_PATH
```

### 3. Run the backend

```bash
cd backend
go mod download
go run ./cmd/server
```

The app will be available at `http://localhost:8080`.

---

## Docker (local build)

```bash
# Build image
docker build -t notes-app .

# Run container
docker run -d \
  --name notes \
  -p 8080:8080 \
  -v /path/to/data/notes.db:/data/notes.db \
  -v /path/to/data/files:/data/files \
  -e DB_PATH=/data/notes.db \
  -e FILES_PATH=/data/files \
  notes-app
```

Open `http://localhost:8080` in your browser.

---

## Docker (from GHCR)

```bash
docker run -d \
  --name notes \
  -p 8080:8080 \
  -v /mnt/user/appdata/notes/db:/data/db \
  -v /mnt/user/appdata/notes/files:/data/files \
  -e DB_PATH=/data/db/notes.db \
  -e FILES_PATH=/data/files \
  --restart unless-stopped \
  ghcr.io/edalcin/notes:latest
```

---

## UNRAID Installation (via Docker → Add)

### Step-by-step via UNRAID GUI

1. In UNRAID, go to **Docker** tab → click **Add Container**
2. Fill in the fields:

| Field | Value |
|-------|-------|
| **Name** | `notes` |
| **Repository** | `ghcr.io/edalcin/notes:latest` |
| **Network Type** | `bridge` |
| **Port** (host → container) | `8080:8080` |

3. Add **Volume Path 1** (database):
   - Container Path: `/data/db`
   - Host Path: `/mnt/user/appdata/notes/db`
   - Access Mode: Read/Write

4. Add **Volume Path 2** (files):
   - Container Path: `/data/files`
   - Host Path: `/mnt/user/appdata/notes/files`
   - Access Mode: Read/Write

5. Add **Environment Variable 1**:
   - Name: `DB_PATH`
   - Value: `/data/db/notes.db`

6. Add **Environment Variable 2**:
   - Name: `FILES_PATH`
   - Value: `/data/files`

7. Click **Apply**

8. UNRAID will pull the image and start the container. Access at `http://<unraid-ip>:8080`.

### Notes for UNRAID
- The app data persists in `/mnt/user/appdata/notes/` — backup this directory to preserve your notes
- To update: Docker tab → container → click **Update** (or pull the new `latest` tag)
- Check container logs in UNRAID Docker tab if the app doesn't start

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PATH` | **required** | Absolute path to the SQLite database file (e.g., `/data/db/notes.db`) |
| `FILES_PATH` | **required** | Absolute path to file storage directory (e.g., `/data/files`) |
| `PORT` | `8080` | HTTP port to listen on |
| `MAX_UPLOAD_BYTES` | `52428800` | Maximum file upload size (default: 50MB) |

---

## GitHub Actions: Automatic Docker Build

The repository includes `.github/workflows/docker-publish.yml`. On every push to the `main` branch:

1. Go tests run
2. Docker image is built (multi-stage, Alpine)
3. Image is published to `ghcr.io/edalcin/notes:latest` and `ghcr.io/edalcin/notes:<git-sha>`

**Required GitHub secret** (set once in repo Settings → Secrets):
- `GITHUB_TOKEN` — automatically provided by GitHub Actions (no manual setup needed)
- The workflow uses `permissions: packages: write` to push to GHCR

No credentials are stored in the repository. The `GITHUB_TOKEN` is a short-lived token scoped to the workflow run.

---

## Project Structure

```
.
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go              # Entry point — reads env vars, starts HTTP server
│   ├── internal/
│   │   ├── db/
│   │   │   ├── db.go                # SQLite connection setup, WAL mode, migrations
│   │   │   ├── migrations/          # SQL migration files (embedded)
│   │   │   ├── notes.go             # CRUD + FTS5 search queries
│   │   │   ├── hashtags.go          # Hashtag CRUD + rename/delete logic
│   │   │   └── attachments.go       # Attachment CRUD queries
│   │   ├── handlers/
│   │   │   ├── notes.go             # HTTP handlers for /api/notes/*
│   │   │   ├── hashtags.go          # HTTP handlers for /api/hashtags/*
│   │   │   ├── attachments.go       # HTTP handlers for file upload/delete
│   │   │   └── static.go            # Serve embedded frontend + /files/*
│   │   ├── models/
│   │   │   ├── note.go              # Note struct + JSON tags
│   │   │   ├── hashtag.go           # Hashtag struct
│   │   │   └── attachment.go        # Attachment struct
│   │   └── services/
│   │       ├── notes.go             # Hashtag extraction, note save orchestration
│   │       ├── hashtags.go          # Rename/delete business logic (content rewrite)
│   │       └── files.go             # File save/delete on filesystem
│   ├── go.mod
│   └── go.sum
│
├── frontend/
│   ├── index.html                   # Single-page app shell
│   ├── manifest.json                # PWA manifest
│   ├── sw.js                        # Service worker (cache-first strategy)
│   └── assets/
│       ├── css/
│       │   └── app.css              # Styles + CSS variables for dark/light themes
│       └── js/
│           ├── app.js               # App bootstrap, routing between views
│           ├── notes.js             # Notes list, create, edit, delete, pin
│           ├── hashtags.js          # Hashtag sidebar + filter logic
│           ├── editor.js            # EasyMDE setup + auto-save debounce
│           ├── attachments.js       # File upload/display logic
│           └── theme.js             # Dark/light mode toggle + localStorage
│
├── Dockerfile
└── .github/
    └── workflows/
        └── docker-publish.yml
```
