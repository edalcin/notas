package handlers

import (
	"io/fs"
	"net/http"
	"strings"
)

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
