package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
)

type filesPathKey struct{}
type maxUploadKey struct{}

// FilesPathMiddleware injects the files storage path into the request context.
func FilesPathMiddleware(filesPath string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), filesPathKey{}, filesPath)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// MaxUploadMiddleware injects the max upload size into the request context.
func MaxUploadMiddleware(max int64) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := context.WithValue(r.Context(), maxUploadKey{}, max)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func getFilesPath(r *http.Request) string {
	if v, ok := r.Context().Value(filesPathKey{}).(string); ok {
		return v
	}
	return ""
}

func getMaxUpload(r *http.Request) int64 {
	if v, ok := r.Context().Value(maxUploadKey{}).(int64); ok {
		return v
	}
	return 52428800
}

func jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, msg string, status int) {
	jsonResponse(w, status, map[string]string{"error": msg})
}

func deleteFileFromPath(storedFilename, filesPath string) {
	if storedFilename == "" || filesPath == "" {
		return
	}
	os.Remove(filepath.Join(filesPath, storedFilename))
}

// Health returns a simple health check handler.
func Health(database interface{ Ping() error }) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		dbStatus := "connected"
		if err := database.Ping(); err != nil {
			dbStatus = "error"
		}
		jsonResponse(w, http.StatusOK, map[string]string{
			"status":  "ok",
			"db":      dbStatus,
			"version": "1.0.0",
		})
	}
}
