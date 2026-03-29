package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/edalcin/notes/internal/db"
	"github.com/edalcin/notes/internal/models"
)

type HashtagHandler struct {
	db *db.DB
}

func NewHashtagHandler(database *db.DB) *HashtagHandler {
	return &HashtagHandler{db: database}
}

func (h *HashtagHandler) List(w http.ResponseWriter, r *http.Request) {
	hashtags, err := h.db.ListHashtags()
	if err != nil {
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	jsonResponse(w, http.StatusOK, models.HashtagsResponse{Hashtags: hashtags})
}

func (h *HashtagHandler) Rename(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")

	var body struct {
		NewName string `json:"new_name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	newName := strings.TrimSpace(body.NewName)
	if newName == "" {
		jsonError(w, "new_name is required", http.StatusBadRequest)
		return
	}

	if err := h.db.RenameHashtag(name, newName); err != nil {
		msg := err.Error()
		if strings.Contains(msg, "not found") {
			jsonError(w, "hashtag not found", http.StatusNotFound)
			return
		}
		if strings.Contains(msg, "UNIQUE") {
			jsonError(w, "hashtag already exists", http.StatusConflict)
			return
		}
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	hashtags, _ := h.db.ListHashtags()
	for _, ht := range hashtags {
		if ht.Name == newName {
			jsonResponse(w, http.StatusOK, ht)
			return
		}
	}
	jsonResponse(w, http.StatusOK, models.Hashtag{Name: newName})
}

func (h *HashtagHandler) Delete(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")

	if err := h.db.DeleteHashtag(name); err != nil {
		msg := err.Error()
		if strings.Contains(msg, "not found") {
			jsonError(w, "hashtag not found", http.StatusNotFound)
			return
		}
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
