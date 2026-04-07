package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/edalcin/notes/internal/db"
	"github.com/edalcin/notes/internal/models"
)

type NoteHandler struct {
	db *db.DB
}

func NewNoteHandler(database *db.DB) *NoteHandler {
	return &NoteHandler{db: database}
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
