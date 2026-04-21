package main

import (
	"crypto/md5"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/edalcin/notes/internal/db"
	"github.com/edalcin/notes/internal/handlers"
)

// frontendHash walks all embedded frontend files and returns the first 8 hex
// characters of their combined MD5. Any change to a frontend file produces a
// new hash, which changes the Service Worker CACHE_NAME and forces browsers to
// fetch fresh assets on the next page load.
func frontendHash(sub fs.FS) string {
	h := md5.New()
	fs.WalkDir(sub, ".", func(path string, d fs.DirEntry, err error) error { //nolint:errcheck
		if err != nil || d.IsDir() {
			return nil
		}
		f, err := sub.Open(path)
		if err != nil {
			return nil
		}
		defer f.Close()
		io.Copy(h, f) //nolint:errcheck
		return nil
	})
	return fmt.Sprintf("%x", h.Sum(nil))[:8]
}

// cleanOrphanFiles removes any file in filesPath that has no corresponding
// record in the attachments table. Files belonging to trashed notes are kept
// because the note (and its file) can still be restored.
func cleanOrphanFiles(database *db.DB, filesPath string) {
	known, err := database.AllStoredFilenames()
	if err != nil {
		log.Printf("warn: cleanOrphanFiles: query attachments: %v", err)
		return
	}

	entries, err := os.ReadDir(filesPath)
	if err != nil {
		log.Printf("warn: cleanOrphanFiles: read dir: %v", err)
		return
	}

	var removed int
	for _, entry := range entries {
		if entry.IsDir() || known[entry.Name()] {
			continue
		}
		path := filepath.Join(filesPath, entry.Name())
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			log.Printf("warn: cleanOrphanFiles: remove %s: %v", entry.Name(), err)
		} else {
			removed++
		}
	}
	if removed > 0 {
		log.Printf("startup: removed %d orphan file(s) from %s", removed, filesPath)
	}
}

func main() {
	dbPath := os.Getenv("DB_PATH")
	filesPath := os.Getenv("FILES_PATH")

	if dbPath == "" {
		log.Fatal("DB_PATH environment variable is required")
	}
	if filesPath == "" {
		log.Fatal("FILES_PATH environment variable is required")
	}

	// Ensure the directory containing the DB file exists
	if err := os.MkdirAll(filepath.Dir(dbPath), 0755); err != nil {
		log.Fatalf("cannot create DB directory %s: %v", filepath.Dir(dbPath), err)
	}

	if err := os.MkdirAll(filesPath, 0755); err != nil {
		log.Fatalf("cannot create FILES_PATH directory %s: %v", filesPath, err)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	maxUploadBytes := int64(52428800)
	if v := os.Getenv("MAX_UPLOAD_BYTES"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			maxUploadBytes = n
		}
	}

	appPIN := os.Getenv("APP_PIN")

	// Session secret: use env var for persistence across restarts, or generate a random one
	sessionSecret := os.Getenv("SESSION_SECRET")
	if sessionSecret == "" {
		sessionSecret = handlers.NewSessionSecret()
		log.Printf("SESSION_SECRET not set — generated ephemeral secret (sessions will not survive restarts)")
	}

	// Detect HTTPS from BASE_URL to set Secure flag on cookies
	baseURL := os.Getenv("BASE_URL")
	secureCookie := strings.HasPrefix(baseURL, "https://")

	database, err := db.Open(dbPath)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer database.Close()

	if err := database.RepairHashtagsFromNotes(); err != nil {
		log.Fatalf("repair hashtags: %v", err)
	}

	// Remove any attachment DB records whose note no longer exists (safety net
	// for state left by a crash or a missing cascade delete).
	if orphanFiles, err := database.DeleteOrphanAttachments(); err != nil {
		log.Printf("warn: delete orphan attachments: %v", err)
	} else if len(orphanFiles) > 0 {
		log.Printf("startup: removed %d orphan attachment record(s) from database", len(orphanFiles))
		// Also clean up the physical files for those orphan records.
		for _, name := range orphanFiles {
			path := filepath.Join(filesPath, name)
			if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
				log.Printf("warn: remove orphan file %s: %v", name, err)
			}
		}
	}

	cleanOrphanFiles(database, filesPath)

	pkdURL := os.Getenv("PKD_URL")
	pkdToken := os.Getenv("PKD_TOKEN")

	noteHandler := handlers.NewNoteHandler(database, pkdURL, pkdToken)
	hashtagHandler := handlers.NewHashtagHandler(database)
	attachmentHandler := handlers.NewAttachmentHandler(database)
	publicHandler := handlers.NewPublicHandler(database)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
			w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
			w.Header().Set("Content-Security-Policy",
				"default-src 'self'; "+
					"script-src 'self' https://cdn.jsdelivr.net; "+
					"style-src 'self' 'unsafe-inline'; "+
					"img-src 'self' data: blob: https:; "+
					"connect-src 'self' https://cdn.jsdelivr.net; "+
					"worker-src 'self'; "+
					"frame-ancestors 'none'")
			next.ServeHTTP(w, r)
		})
	})
	r.Use(handlers.FilesPathMiddleware(filesPath))
	r.Use(handlers.MaxUploadMiddleware(maxUploadBytes))
	r.Use(handlers.PINMiddleware(appPIN, sessionSecret, secureCookie))

	r.Get("/health", handlers.Health(database))
	r.Post("/api/auth/login", handlers.PINLogin(appPIN, sessionSecret, secureCookie))
	r.Get("/api/auth/logout", handlers.PINLogout())

	r.Route("/api", func(r chi.Router) {
		r.Route("/notes", func(r chi.Router) {
			r.Get("/", noteHandler.List)
			r.Post("/", noteHandler.Create)
			// GET /api/notes/shared must come before /{id} to avoid chi treating "shared" as an ID
			r.Get("/shared", noteHandler.ListShared)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", noteHandler.Get)
				r.Put("/", noteHandler.Update)
				r.Delete("/", noteHandler.Delete)
				r.Put("/pin", noteHandler.TogglePin)
				r.Put("/trash", noteHandler.Trash)
				r.Put("/restore", noteHandler.Restore)
				r.Post("/share", noteHandler.Share)
				r.Delete("/share", noteHandler.Unshare)
				r.Post("/export-to-pkd", noteHandler.ExportToPKD)
				r.Post("/attachments", attachmentHandler.Upload)
				r.Delete("/attachments/{attachment_id}", attachmentHandler.Delete)
			})
		})
		r.Get("/attachments", attachmentHandler.ListAll)
		r.Get("/trash", noteHandler.ListTrash)
		r.Delete("/trash", noteHandler.EmptyTrash)
		r.Route("/hashtags", func(r chi.Router) {
			r.Get("/", hashtagHandler.List)
			r.Put("/{name}", hashtagHandler.Rename)
			r.Delete("/{name}", hashtagHandler.Delete)
			r.Patch("/{name}/color", hashtagHandler.UpdateColor)
		})
	})

	r.Get("/files/{filename}", handlers.ServeFile(filesPath))

	// Public share page — no auth required; must come before the SPA catch-all
	r.Get("/s/{token}", publicHandler.ServePublicNote)

	// Serve embedded frontend SPA — must come after API routes
	sub, err := fs.Sub(frontendFS, "frontend")
	if err != nil {
		log.Fatalf("create frontend sub-filesystem: %v", err)
	}

	// Compute a hash of all embedded frontend files at startup so the Service
	// Worker CACHE_NAME changes automatically on every new deployment.
	swVersion := frontendHash(sub)
	log.Printf("Frontend cache version: %s", swVersion)

	// sw.js is served dynamically so the CACHE_NAME version is injected.
	r.Get("/sw.js", handlers.ServeSW(sub, swVersion))
	r.Get("/*", handlers.SPAHandler(sub))

	addr := fmt.Sprintf(":%s", port)
	log.Printf("Starting server on %s", addr)
	log.Printf("DB_PATH=%s, FILES_PATH=%s", dbPath, filesPath)
	if baseURL != "" {
		log.Printf("BASE_URL=%s (secure cookies: %v)", baseURL, secureCookie)
	}
	if appPIN != "" {
		log.Printf("PIN protection: enabled")
	}
	if pkdURL != "" {
		log.Printf("PKD integration: enabled (url=%s)", pkdURL)
	}

	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
