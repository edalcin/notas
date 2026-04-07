package handlers

import (
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"regexp"
	"strings"
)

var swCacheNameRE = regexp.MustCompile(`(const CACHE_NAME\s*=\s*)'[^']*'`)

// ServeSW serves the Service Worker with a dynamic cache version injected at
// startup. This ensures every new binary deployment (with changed frontend
// assets) produces a unique CACHE_NAME, invalidating stale browser caches
// without any manual version bumping.
func ServeSW(frontendFS fs.FS, cacheVersion string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		f, err := frontendFS.Open("sw.js")
		if err != nil {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		defer f.Close()
		raw, err := io.ReadAll(f)
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		patched := swCacheNameRE.ReplaceAllString(string(raw), "${1}'notas-"+cacheVersion+"'")
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
		fmt.Fprint(w, patched)
	}
}

// SPAHandler serves the embedded frontend SPA. Any path not matching a real file
// falls back to index.html so client-side routing works correctly.
func SPAHandler(frontendFS fs.FS) http.HandlerFunc {
	fileServer := http.FileServer(http.FS(frontendFS))

	return func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(r.URL.Path, "/")
		if p == "" {
			p = "."
		}

		// Set cache headers before serving:
		// - sw.js and index.html must never be cached (CDN or browser) so
		//   service worker updates and HTML changes reach users immediately.
		// - JS/CSS: no-cache forces revalidation; the service worker then
		//   takes over caching on the client side.
		ext := strings.ToLower(p)
		switch {
		case p == "sw.js" || p == "." || strings.HasSuffix(ext, ".html"):
			w.Header().Set("Cache-Control", "no-store, no-cache, must-revalidate")
		case strings.HasSuffix(ext, ".js") || strings.HasSuffix(ext, ".css"):
			w.Header().Set("Cache-Control", "no-cache")
		}

		f, err := frontendFS.Open(p)
		if err == nil {
			f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// Fall back to index.html for SPA routing
		r2 := *r
		r2.URL.Path = "/"
		fileServer.ServeHTTP(w, &r2)
	}
}
