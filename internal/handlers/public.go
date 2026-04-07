package handlers

import (
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/edalcin/notes/internal/db"
)

// ─── Rate limiter ─────────────────────────────────────────────────────────────

const rateLimit = 30 // requests per minute per IP

type rateLimiter struct {
	mu      sync.Mutex
	counter map[string]int
}

var publicRateLimiter = &rateLimiter{counter: make(map[string]int)}

func init() {
	// Reset all counters once per minute.
	go func() {
		ticker := time.NewTicker(time.Minute)
		for range ticker.C {
			publicRateLimiter.mu.Lock()
			publicRateLimiter.counter = make(map[string]int)
			publicRateLimiter.mu.Unlock()
		}
	}()
}

func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	rl.counter[ip]++
	return rl.counter[ip] <= rateLimit
}

// clientIP extracts the real client IP, respecting X-Forwarded-For when set.
func clientIP(r *http.Request) string {
	if fwd := r.Header.Get("X-Forwarded-For"); fwd != "" {
		parts := strings.SplitN(fwd, ",", 2)
		return strings.TrimSpace(parts[0])
	}
	// r.RemoteAddr is "host:port"; strip the port.
	host := r.RemoteAddr
	if i := strings.LastIndex(host, ":"); i >= 0 {
		host = host[:i]
	}
	return host
}

// ─── Public note handler ──────────────────────────────────────────────────────

type PublicHandler struct {
	db *db.DB
}

func NewPublicHandler(database *db.DB) *PublicHandler {
	return &PublicHandler{db: database}
}

var publicPageTmpl = template.Must(template.New("public").Parse(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Nota compartilhada</title>
  <style>
    :root {
      --bg: #f8f7f4;
      --surface: #fff;
      --text: #1c1917;
      --text-muted: #78716c;
      --border: #e7e5e4;
      --accent: #6366f1;
      --radius: 10px;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #1c1917;
        --surface: #292524;
        --text: #e7e5e4;
        --text-muted: #a8a29e;
        --border: #3d3835;
        --accent: #818cf8;
      }
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      font-size: 15px;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 24px 16px 48px;
    }
    .page {
      max-width: 720px;
      margin: 0 auto;
    }
    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .page-brand {
      font-size: 14px;
      color: var(--text-muted);
      text-decoration: none;
    }
    .page-brand:hover { color: var(--accent); }
    .note-date {
      font-size: 13px;
      color: var(--text-muted);
    }
    .note-body {
      background: var(--surface);
      border-radius: var(--radius);
      padding: 24px;
      border: 1px solid var(--border);
    }
    .note-body h1, .note-body h2, .note-body h3 { margin: 0.75em 0 0.25em; }
    .note-body p { margin: 0.5em 0; }
    .note-body pre {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
      overflow-x: auto;
      font-size: 13px;
    }
    .note-body code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.9em;
    }
    .note-body p code {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 1px 4px;
    }
    .note-body a { color: var(--accent); }
    .note-body ul, .note-body ol { padding-left: 1.5em; }
    .note-body blockquote {
      border-left: 3px solid var(--border);
      margin: 0.5em 0;
      padding: 0 0.75em;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="page-header">
      <a href="/" class="page-brand">📝 Notas</a>
      <span class="note-date">{{.Date}}</span>
    </header>
    <div class="note-body" id="note-content"></div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <script>
    const raw = {{.ContentJSON}};
    document.getElementById('note-content').innerHTML = marked.parse(raw, { breaks: true });
  </script>
</body>
</html>`))

func (h *PublicHandler) ServePublicNote(w http.ResponseWriter, r *http.Request) {
	ip := clientIP(r)
	if !publicRateLimiter.allow(ip) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusTooManyRequests)
		fmt.Fprint(w, "<html><body><h2>429 — Muitas requisições. Tente novamente em instantes.</h2></body></html>")
		return
	}

	token := chi.URLParam(r, "token")
	note, err := h.db.GetNoteByShareToken(token)
	if err != nil {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprint(w, "<html><body><h2>Erro interno. Tente novamente.</h2></body></html>")
		return
	}
	if note == nil {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusNotFound)
		fmt.Fprint(w, "<html><body><h2>404 — Nota não encontrada ou link revogado.</h2></body></html>")
		return
	}

	dateStr := note.CreatedAt.Format("02/01/2006 15:04")

	// json.Marshal produces a quoted, escaped JSON string (e.g. "Hello\nworld").
	// template.JS tells html/template to embed it verbatim in the <script> block.
	contentBytes, _ := json.Marshal(note.Content)
	contentJSON := template.JS(contentBytes)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	publicPageTmpl.Execute(w, map[string]interface{}{ //nolint:errcheck
		"Date":        dateStr,
		"ContentJSON": contentJSON,
	})
}
