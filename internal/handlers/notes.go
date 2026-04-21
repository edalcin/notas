package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/yuin/goldmark"

	"github.com/edalcin/notes/internal/db"
	"github.com/edalcin/notes/internal/models"
)

type NoteHandler struct {
	db       *db.DB
	pkdURL   string
	pkdToken string
}

func NewNoteHandler(database *db.DB, pkdURL, pkdToken string) *NoteHandler {
	return &NoteHandler{
		db:       database,
		pkdURL:   strings.TrimSpace(pkdURL),
		pkdToken: strings.TrimSpace(pkdToken),
	}
}

func (h *NoteHandler) List(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	q := r.URL.Query().Get("q")
	hashtag := r.URL.Query().Get("hashtag")

	var notes []models.Note
	var total int
	var err error

	switch {
	case q != "":
		notes, total, err = h.db.SearchNotes(q, limit, offset)
	case hashtag != "":
		notes, total, err = h.db.FilterByHashtag(hashtag, limit, offset)
	default:
		notes, total, err = h.db.ListNotes(limit, offset)
	}

	if err != nil {
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	for i := range notes {
		attachments, _ := h.db.GetAttachmentsByNote(notes[i].ID)
		notes[i].Attachments = attachments
	}

	jsonResponse(w, http.StatusOK, models.NotesResponse{
		Notes:  notes,
		Total:  total,
		Offset: offset,
		Limit:  limit,
	})
}

func (h *NoteHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	note, err := h.db.GetNote(id)
	if err != nil {
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if note == nil {
		jsonError(w, "note not found", http.StatusNotFound)
		return
	}

	attachments, _ := h.db.GetAttachmentsByNote(id)
	note.Attachments = attachments

	jsonResponse(w, http.StatusOK, note)
}

func (h *NoteHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	note, err := h.db.CreateNote(body.Content)
	if err != nil {
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusCreated, note)
}

func (h *NoteHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	var body struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	note, err := h.db.UpdateNote(id, body.Content)
	if err != nil {
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if note == nil {
		jsonError(w, "note not found", http.StatusNotFound)
		return
	}

	attachments, _ := h.db.GetAttachmentsByNote(id)
	note.Attachments = attachments

	jsonResponse(w, http.StatusOK, note)
}

func (h *NoteHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	filesPath := getFilesPath(r)
	attachments, _ := h.db.GetAttachmentsByNote(id)

	if err := h.db.DeleteNote(id); err != nil {
		if err == sql.ErrNoRows {
			jsonError(w, "note not found", http.StatusNotFound)
			return
		}
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	for _, a := range attachments {
		deleteFileFromPath(a.StoredFilename, filesPath)
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *NoteHandler) Trash(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	if err := h.db.TrashNote(id); err != nil {
		if err == sql.ErrNoRows {
			jsonError(w, "note not found", http.StatusNotFound)
			return
		}
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{"id": id, "trashed": true})
}

func (h *NoteHandler) Restore(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	if err := h.db.RestoreNote(id); err != nil {
		if err == sql.ErrNoRows {
			jsonError(w, "note not found", http.StatusNotFound)
			return
		}
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{"id": id, "trashed": false})
}

func (h *NoteHandler) ListTrash(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	notes, total, err := h.db.ListTrashedNotes(limit, offset)
	if err != nil {
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	for i := range notes {
		attachments, _ := h.db.GetAttachmentsByNote(notes[i].ID)
		notes[i].Attachments = attachments
	}

	jsonResponse(w, http.StatusOK, models.NotesResponse{
		Notes:  notes,
		Total:  total,
		Offset: offset,
		Limit:  limit,
	})
}

func (h *NoteHandler) EmptyTrash(w http.ResponseWriter, r *http.Request) {
	filesPath := getFilesPath(r)

	attachments, err := h.db.EmptyTrash()
	if err != nil {
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	for _, a := range attachments {
		deleteFileFromPath(a.StoredFilename, filesPath)
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *NoteHandler) TogglePin(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	var body struct {
		Pinned bool `json:"pinned"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if err := h.db.TogglePin(id, body.Pinned); err != nil {
		if err == sql.ErrNoRows {
			jsonError(w, "note not found", http.StatusNotFound)
			return
		}
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{"id": id, "pinned": body.Pinned})
}

func parseID(r *http.Request) (int64, error) {
	return strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
}

// Share generates (or returns the existing) share token for a note and returns
// the full public URL.
func (h *NoteHandler) Share(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	note, err := h.db.GetNote(id)
	if err != nil {
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if note == nil {
		jsonError(w, "note not found", http.StatusNotFound)
		return
	}

	token, err := h.db.SetShareToken(id)
	if err != nil {
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	scheme := "http"
	if fwd := r.Header.Get("X-Forwarded-Proto"); fwd != "" {
		scheme = fwd
	}
	url := fmt.Sprintf("%s://%s/s/%s", scheme, r.Host, token)

	jsonResponse(w, http.StatusOK, map[string]interface{}{
		"token":  token,
		"url":    url,
		"shared": true,
	})
}

// Unshare removes the share token from a note, making it private again.
func (h *NoteHandler) Unshare(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	note, err := h.db.GetNote(id)
	if err != nil {
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if note == nil {
		jsonError(w, "note not found", http.StatusNotFound)
		return
	}

	if err := h.db.ClearShareToken(id); err != nil {
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ExportToPKD sends a note to the configured PKD instance via /api/import.
func (h *NoteHandler) ExportToPKD(w http.ResponseWriter, r *http.Request) {
	if h.pkdURL == "" {
		jsonError(w, "PKD integration not configured (PKD_URL not set)", http.StatusServiceUnavailable)
		return
	}

	id, err := parseID(r)
	if err != nil {
		jsonError(w, "invalid id", http.StatusBadRequest)
		return
	}

	note, err := h.db.GetNote(id)
	if err != nil {
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}
	if note == nil {
		jsonError(w, "note not found", http.StatusNotFound)
		return
	}

	// Convert markdown to HTML for PKD's rich-text body
	var htmlBuf bytes.Buffer
	if err := goldmark.Convert([]byte(note.Content), &htmlBuf); err != nil {
		jsonError(w, "markdown conversion error", http.StatusInternalServerError)
		return
	}

	// Use the first non-empty line as the document title, stripping markdown headings
	title := "Nota de Notas"
	for _, line := range strings.SplitN(note.Content, "\n", 5) {
		line = strings.TrimLeft(line, "#")
		line = strings.TrimSpace(line)
		if line != "" {
			title = line
			break
		}
	}

	payload := map[string]interface{}{
		"title":   title,
		"content": htmlBuf.String(),
		"tags":    note.Hashtags,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(r.Context(), http.MethodPost, strings.TrimRight(h.pkdURL, "/")+"/api/import", bytes.NewReader(body))
	if err != nil {
		jsonError(w, "failed to build request", http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+h.pkdToken)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		jsonError(w, "could not reach PKD: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		jsonError(w, fmt.Sprintf("PKD returned %d", resp.StatusCode), http.StatusBadGateway)
		return
	}

	jsonResponse(w, http.StatusOK, map[string]interface{}{"exported": true})
}

// ListShared returns all notes that have an active public share link.
func (h *NoteHandler) ListShared(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	notes, total, err := h.db.ListSharedNotes(limit, offset)
	if err != nil {
		jsonError(w, "database error", http.StatusInternalServerError)
		return
	}

	for i := range notes {
		attachments, _ := h.db.GetAttachmentsByNote(notes[i].ID)
		notes[i].Attachments = attachments
	}

	jsonResponse(w, http.StatusOK, models.NotesResponse{
		Notes:  notes,
		Total:  total,
		Offset: offset,
		Limit:  limit,
	})
}
