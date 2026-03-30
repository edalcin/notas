package main

import (
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/edalcin/notes/internal/db"
	"github.com/edalcin/notes/internal/handlers"
)

func main() {
	dbPath := os.Getenv("DB_PATH")
	filesPath := os.Getenv("FILES_PATH")

	if dbPath == "" {
		log.Fatal("DB_PATH environment variable is required")
	}
	if filesPath == "" {
		log.Fatal("FILES_PATH environment variable is required")
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
	sessionSecret := handlers.NewSessionSecret()

	database, err := db.Open(dbPath)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer database.Close()

	noteHandler := handlers.NewNoteHandler(database)
	hashtagHandler := handlers.NewHashtagHandler(database)
	attachmentHandler := handlers.NewAttachmentHandler(database)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(handlers.FilesPathMiddleware(filesPath))
	r.Use(handlers.MaxUploadMiddleware(maxUploadBytes))
	r.Use(handlers.PINMiddleware(appPIN, sessionSecret))

	r.Get("/health", handlers.Health(database))
	r.Post("/api/auth/login", handlers.PINLogin(appPIN, sessionSecret))
	r.Get("/api/auth/logout", handlers.PINLogout())

	r.Route("/api", func(r chi.Router) {
		r.Route("/notes", func(r chi.Router) {
			r.Get("/", noteHandler.List)
			r.Post("/", noteHandler.Create)
			r.Get("/{id}", noteHandler.Get)
			r.Put("/{id}", noteHandler.Update)
			r.Delete("/{id}", noteHandler.Delete)
			r.Put("/{id}/pin", noteHandler.TogglePin)
			r.Post("/{id}/attachments", attachmentHandler.Upload)
			r.Delete("/{id}/attachments/{attachment_id}", attachmentHandler.Delete)
		})
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
	r.Get("/*", handlers.SPAHandler(sub))

	addr := fmt.Sprintf(":%s", port)
	log.Printf("Starting server on %s", addr)
	log.Printf("DB_PATH=%s, FILES_PATH=%s", dbPath, filesPath)
	if appPIN != "" {
		log.Printf("PIN protection: enabled")
	}

	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
