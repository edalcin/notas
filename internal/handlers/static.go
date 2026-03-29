package handlers

import (
	"io/fs"
	"net/http"
)

// SPAHandler serves the embedded frontend SPA. Any path not matching a real file
// falls back to index.html so client-side routing works correctly.
func SPAHandler(frontendFS fs.FS) http.HandlerFunc {
	fileServer := http.FileServer(http.FS(frontendFS))

	return func(w http.ResponseWriter, r *http.Request) {
		// Try to serve the exact file requested
		f, err := frontendFS.Open(r.URL.Path)
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
