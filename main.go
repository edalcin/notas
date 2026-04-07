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

	noteHandler := handlers.NewNoteHandler(database)
	hashtagHandler := handlers.NewHashtagHandler(database)
	attachmentHandler := handlers.NewAttachmentHandler(database)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
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
			r.Get("/{id}", noteHandler.Get)
			r.Put("/{id}", noteHandler.Update)
			r.Delete("/{id}", noteHandler.Delete)
			r.Put("/{id}/pin", noteHandler.TogglePin)
			r.Put("/{id}/trash", noteHandler.Trash)
			r.Put("/{id}/restore", noteHandler.Restore)
			r.Post("/{id}/attachments", attachmentHandler.Upload)
			r.Delete("/{id}/attachments/{attachment_id}", attachmentHandler.Delete)
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

	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
