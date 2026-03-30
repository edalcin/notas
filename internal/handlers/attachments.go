package handlers

import (
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/edalcin/notes/internal/db"
	"github.com/edalcin/notes/internal/models"
	"github.com/edalcin/notes/internal/services"
)

type AttachmentHandler struct {
	db *db.DB
}

func NewAttachmentHandler(database *db.DB) *AttachmentHandler {
	return &AttachmentHandler{db: database}
}

func (h *AttachmentHandler) Upload(w http.ResponseWriter, r *http.Request) {
	noteID, err := parseID(r)
	if err != nil {
		jsonError(w, "invalid note id", http.StatusBadRequest)
		return
	}

	note, err := h.db.GetNote(noteID)
	if err != nil || note == nil {
		jsonError(w, "note not found", http.StatusNotFound)
		return
	}

	filesPath := getFilesPath(r)
	maxBytes := getMaxUpload(r)

	if err := r.ParseMultipartForm(maxBytes); err != nil {
		jsonError(w, "file too large", http.StatusRequestEntityTooLarge)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "missing file field", http.StatusBadRequest)
		return
	}
	file.Close()

	storedFilename, err := services.SaveFile(header, filesPath, maxBytes)
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "too large") {
			jsonResponse(w, http.StatusRequestEntityTooLarge, map[string]interface{}{
				"error":     "file too large",
				"max_bytes": maxBytes,
			})
			return
		}
		if strings.Contains(msg, "unsupported") {
			mimeType := header.Header.Get("Content-Type")
			jsonResponse(w, http.StatusUnsupportedMediaType, map[string]interface{}{
				"error":     "unsupported file type",
				"mime_type": mimeType,
			})
			return
		}
		jsonError(w, "upload failed", http.StatusInternalServerError)
		return
	}

	mimeType := header.Header.Get("Content-Type")
	if idx := strings.Index(mimeType, ";"); idx != -1 {
		mimeType = strings.TrimSpace(mimeType[:idx])
	}

	attachment, err := h.db.CreateAttachment(&models.Attachment{
		NoteID:         noteID,
		StoredFilename: storedFilename,
		OriginalName:   header.Filename,
		MimeType:       mimeType,
		SizeBytes:      header.Size,
	})
	if err != nil {
		services.DeleteFile(storedFilename, filesPath)
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusCreated, attachment)
}

func (h *AttachmentHandler) ListAll(w http.ResponseWriter, r *http.Request) {
	items, err := h.db.ListAllAttachments()
	if err != nil {
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	jsonResponse(w, http.StatusOK, map[string]interface{}{"attachments": items})
}

func (h *AttachmentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	attachmentID, err := strconv.ParseInt(chi.URLParam(r, "attachment_id"), 10, 64)
	if err != nil {
		jsonError(w, "invalid attachment id", http.StatusBadRequest)
		return
	}

	filesPath := getFilesPath(r)

	storedFilename, err := h.db.DeleteAttachment(attachmentID)
	if err != nil {
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if storedFilename == "" {
		jsonError(w, "attachment not found", http.StatusNotFound)
		return
	}

	deleteFileFromPath(storedFilename, filesPath)
	w.WriteHeader(http.StatusNoContent)
}

// ServeFile serves an uploaded file directly from the filesystem.
func ServeFile(filesPath string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		filename := chi.URLParam(r, "filename")

		// Prevent path traversal attacks
		if strings.Contains(filename, "..") || strings.Contains(filename, "/") || strings.Contains(filename, "\\") {
			jsonError(w, "invalid filename", http.StatusBadRequest)
			return
		}

		fullPath := filepath.Join(filesPath, filename)
		ext := strings.ToLower(filepath.Ext(filename))
		if ext == ".pdf" {
			w.Header().Set("Content-Disposition", "inline; filename=\""+filename+"\"")
		}

		http.ServeFile(w, r, fullPath)
	}
}
