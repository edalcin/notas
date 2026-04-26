package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/edalcin/notes/internal/db"
)

type BackupHandler struct {
	db     *db.DB
	dbPath string
}

func NewBackupHandler(database *db.DB, dbPath string) *BackupHandler {
	return &BackupHandler{db: database, dbPath: dbPath}
}

func (h *BackupHandler) Download(w http.ResponseWriter, r *http.Request) {
	tmp, err := os.CreateTemp("", "notas-backup-*.sqlite")
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer os.Remove(tmp.Name())
	tmp.Close()

	if err := h.db.Backup(tmp.Name()); err != nil {
		http.Error(w, "backup failed", http.StatusInternalServerError)
		return
	}

	f, err := os.Open(tmp.Name())
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	stat, _ := f.Stat()
	filename := fmt.Sprintf("notas-backup-%s.sqlite", time.Now().Format("2006-01-02"))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	if stat != nil {
		w.Header().Set("Content-Length", fmt.Sprintf("%d", stat.Size()))
	}
	io.Copy(w, f) //nolint:errcheck
}

func (h *BackupHandler) Restore(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(512 << 20); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if r.FormValue("confirm") != "REPLACE" {
		http.Error(w, "confirmation required: send confirm=REPLACE", http.StatusBadRequest)
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "missing file field", http.StatusBadRequest)
		return
	}
	defer file.Close()

	tmp, err := os.CreateTemp("", "notas-restore-*.sqlite")
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)

	if _, err := io.Copy(tmp, file); err != nil {
		tmp.Close()
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	tmp.Close()

	if err := h.db.Restore(tmpName, h.dbPath); err != nil {
		http.Error(w, "restore failed: "+err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
