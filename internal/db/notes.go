package db

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/edalcin/notes/internal/models"
	"github.com/edalcin/notes/internal/services"
)

const baseNotesSQL = `
SELECT n.id, n.content, n.pinned, n.created_at, n.updated_at,
       GROUP_CONCAT(h.name, ',') as hashtag_names,
       (n.share_token IS NOT NULL) AS shared
FROM notes n
LEFT JOIN note_hashtags nh ON n.id = nh.note_id
LEFT JOIN hashtags h ON nh.hashtag_id = h.id
WHERE n.deleted_at IS NULL%s
GROUP BY n.id
ORDER BY n.pinned DESC, n.created_at DESC
LIMIT ? OFFSET ?`

func (d *DB) ListNotes(limit, offset int) ([]models.Note, int, error) {
	q := fmt.Sprintf(baseNotesSQL, "")
	return d.queryNotes(q, nil, limit, offset)
}

func (d *DB) FilterByHashtag(hashtag string, limit, offset int) ([]models.Note, int, error) {
	where := " AND n.id IN (SELECT nh2.note_id FROM note_hashtags nh2 JOIN hashtags h2 ON nh2.hashtag_id = h2.id WHERE LOWER(h2.name) = LOWER(?))"
	q := fmt.Sprintf(baseNotesSQL, where)
	return d.queryNotes(q, hashtag, limit, offset)
}

func (d *DB) SearchNotes(query string, limit, offset int) ([]models.Note, int, error) {
	q := `
SELECT n.id, n.content, n.pinned, n.created_at, n.updated_at,
       GROUP_CONCAT(h.name, ',') as hashtag_names,
       (n.share_token IS NOT NULL) AS shared
FROM notes n
LEFT JOIN note_hashtags nh ON n.id = nh.note_id
LEFT JOIN hashtags h ON nh.hashtag_id = h.id
WHERE n.id IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?)
AND n.deleted_at IS NULL
GROUP BY n.id
ORDER BY n.pinned DESC, n.created_at DESC
LIMIT ? OFFSET ?`
	return d.queryNotes(q, query+"*", limit, offset)
}

func (d *DB) queryNotes(q string, arg interface{}, limit, offset int) ([]models.Note, int, error) {
	var rows *sql.Rows
	var err error
	if arg != nil {
		rows, err = d.Query(q, arg, limit, offset)
	} else {
		rows, err = d.Query(q, limit, offset)
	}
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	return scanNotes(rows)
}

func scanNotes(rows *sql.Rows) ([]models.Note, int, error) {
	var notes []models.Note
	for rows.Next() {
		var n models.Note
		var pinnedInt int
		var sharedInt int
		var hashtagNames sql.NullString
		if err := rows.Scan(&n.ID, &n.Content, &pinnedInt, &n.CreatedAt, &n.UpdatedAt, &hashtagNames, &sharedInt); err != nil {
			return nil, 0, err
		}
		n.Pinned = pinnedInt == 1
		n.Shared = sharedInt == 1
		n.Preview = services.GeneratePreview(n.Content, 100)
		n.Hashtags = parseHashtags(hashtagNames)
		n.Attachments = []models.Attachment{}
		notes = append(notes, n)
	}
	if notes == nil {
		notes = []models.Note{}
	}
	return notes, len(notes), nil
}

func parseHashtags(s sql.NullString) []string {
	if !s.Valid || s.String == "" {
		return []string{}
	}
	seen := make(map[string]bool)
	var result []string
	for _, p := range strings.Split(s.String, ",") {
		p = strings.TrimSpace(p)
		if p != "" && !seen[p] {
			seen[p] = true
			result = append(result, p)
		}
	}
	if result == nil {
		return []string{}
	}
	return result
}

func (d *DB) GetNote(id int64) (*models.Note, error) {
	row := d.QueryRow(`
		SELECT n.id, n.content, n.pinned, n.created_at, n.updated_at,
		       GROUP_CONCAT(h.name, ',') as hashtag_names,
		       (n.share_token IS NOT NULL) AS shared
		FROM notes n
		LEFT JOIN note_hashtags nh ON n.id = nh.note_id
		LEFT JOIN hashtags h ON nh.hashtag_id = h.id
		WHERE n.id = ? AND n.deleted_at IS NULL
		GROUP BY n.id`, id)

	var n models.Note
	var pinnedInt int
	var sharedInt int
	var hashtagNames sql.NullString
	if err := row.Scan(&n.ID, &n.Content, &pinnedInt, &n.CreatedAt, &n.UpdatedAt, &hashtagNames, &sharedInt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	n.Pinned = pinnedInt == 1
	n.Shared = sharedInt == 1
	n.Preview = services.GeneratePreview(n.Content, 100)
	n.Hashtags = parseHashtags(hashtagNames)
	n.Attachments = []models.Attachment{}
	return &n, nil
}

func (d *DB) CreateNote(content string) (*models.Note, error) {
	tx, err := d.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	result, err := tx.Exec(
		"INSERT INTO notes (content, created_at, updated_at) VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
		content,
	)
	if err != nil {
		return nil, fmt.Errorf("insert note: %w", err)
	}
	id, _ := result.LastInsertId()

	hashtags := services.ExtractHashtags(content)
	if err := syncNoteHashtags(tx, id, hashtags); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return d.GetNote(id)
}

func (d *DB) UpdateNote(id int64, content string) (*models.Note, error) {
	tx, err := d.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	result, err := tx.Exec(
		"UPDATE notes SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		content, id,
	)
	if err != nil {
		return nil, err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return nil, nil
	}

	hashtags := services.ExtractHashtags(content)
	if err := syncNoteHashtags(tx, id, hashtags); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return d.GetNote(id)
}

func (d *DB) DeleteNote(id int64) error {
	tx, err := d.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Explicitly delete related records before the note, so cleanup is guaranteed
	// regardless of whether SQLite FK cascade is active on this connection.
	if _, err := tx.Exec("DELETE FROM note_hashtags WHERE note_id = ?", id); err != nil {
		return fmt.Errorf("delete note hashtags: %w", err)
	}
	if _, err := tx.Exec("DELETE FROM attachments WHERE note_id = ?", id); err != nil {
		return fmt.Errorf("delete note attachments: %w", err)
	}
	if _, err := tx.Exec("DELETE FROM hashtags WHERE id NOT IN (SELECT hashtag_id FROM note_hashtags)"); err != nil {
		return fmt.Errorf("cleanup orphan hashtags: %w", err)
	}

	result, err := tx.Exec("DELETE FROM notes WHERE id = ?", id)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return tx.Commit()
}

func (d *DB) TrashNote(id int64) error {
	result, err := d.Exec(
		"UPDATE notes SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL",
		id,
	)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (d *DB) RestoreNote(id int64) error {
	result, err := d.Exec(
		"UPDATE notes SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL",
		id,
	)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (d *DB) ListTrashedNotes(limit, offset int) ([]models.Note, int, error) {
	q := `
SELECT n.id, n.content, n.pinned, n.created_at, n.updated_at,
       GROUP_CONCAT(h.name, ',') as hashtag_names,
       n.deleted_at
FROM notes n
LEFT JOIN note_hashtags nh ON n.id = nh.note_id
LEFT JOIN hashtags h ON nh.hashtag_id = h.id
WHERE n.deleted_at IS NOT NULL
GROUP BY n.id
ORDER BY n.deleted_at DESC
LIMIT ? OFFSET ?`
	rows, err := d.Query(q, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	return scanTrashedNotes(rows)
}

func scanTrashedNotes(rows *sql.Rows) ([]models.Note, int, error) {
	var notes []models.Note
	for rows.Next() {
		var n models.Note
		var pinnedInt int
		var hashtagNames sql.NullString
		var deletedAt sql.NullTime
		if err := rows.Scan(&n.ID, &n.Content, &pinnedInt, &n.CreatedAt, &n.UpdatedAt, &hashtagNames, &deletedAt); err != nil {
			return nil, 0, err
		}
		n.Pinned = pinnedInt == 1
		n.Preview = services.GeneratePreview(n.Content, 100)
		n.Hashtags = parseHashtags(hashtagNames)
		n.Attachments = []models.Attachment{}
		if deletedAt.Valid {
			t := deletedAt.Time
			n.DeletedAt = &t
		}
		notes = append(notes, n)
	}
	if notes == nil {
		notes = []models.Note{}
	}
	return notes, len(notes), nil
}

// EmptyTrash permanently deletes all trashed notes and returns their attachments
// so the caller can remove the physical files.
func (d *DB) EmptyTrash() ([]models.Attachment, error) {
	rows, err := d.Query(`
		SELECT a.id, a.note_id, a.stored_filename, a.original_name, a.mime_type, a.size_bytes, a.created_at
		FROM attachments a
		JOIN notes n ON a.note_id = n.id
		WHERE n.deleted_at IS NOT NULL`)
	if err != nil {
		return nil, fmt.Errorf("empty trash: list attachments: %w", err)
	}
	var attachments []models.Attachment
	for rows.Next() {
		var a models.Attachment
		if err := rows.Scan(&a.ID, &a.NoteID, &a.StoredFilename, &a.OriginalName, &a.MimeType, &a.SizeBytes, &a.CreatedAt); err != nil {
			rows.Close()
			return nil, fmt.Errorf("empty trash: scan attachment: %w", err)
		}
		attachments = append(attachments, a)
	}
	rows.Close()

	tx, err := d.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Explicitly delete related records before the notes — same pattern as
	// DeleteNote — so cleanup is guaranteed regardless of whether SQLite FK
	// cascade is active on this connection.
	if _, err := tx.Exec("DELETE FROM note_hashtags WHERE note_id IN (SELECT id FROM notes WHERE deleted_at IS NOT NULL)"); err != nil {
		return nil, fmt.Errorf("empty trash: delete note_hashtags: %w", err)
	}
	if _, err := tx.Exec("DELETE FROM attachments WHERE note_id IN (SELECT id FROM notes WHERE deleted_at IS NOT NULL)"); err != nil {
		return nil, fmt.Errorf("empty trash: delete attachments: %w", err)
	}
	if _, err := tx.Exec("DELETE FROM notes WHERE deleted_at IS NOT NULL"); err != nil {
		return nil, fmt.Errorf("empty trash: delete notes: %w", err)
	}
	if _, err := tx.Exec("DELETE FROM hashtags WHERE id NOT IN (SELECT hashtag_id FROM note_hashtags)"); err != nil {
		return nil, fmt.Errorf("empty trash: cleanup hashtags: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return attachments, nil
}

func (d *DB) TogglePin(id int64, pinned bool) error {
	pinnedInt := 0
	if pinned {
		pinnedInt = 1
	}
	result, err := d.Exec("UPDATE notes SET pinned = ? WHERE id = ?", pinnedInt, id)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func syncNoteHashtags(tx *sql.Tx, noteID int64, hashtags []string) error {
	if _, err := tx.Exec("DELETE FROM note_hashtags WHERE note_id = ?", noteID); err != nil {
		return fmt.Errorf("clear note hashtags: %w", err)
	}

	for _, tag := range hashtags {
		if _, err := tx.Exec("INSERT OR IGNORE INTO hashtags (name) VALUES (?)", tag); err != nil {
			return fmt.Errorf("upsert hashtag: %w", err)
		}
		var hashtagID int64
		if err := tx.QueryRow("SELECT id FROM hashtags WHERE LOWER(name) = ?", tag).Scan(&hashtagID); err != nil {
			return fmt.Errorf("get hashtag id: %w", err)
		}
		if _, err := tx.Exec("INSERT OR IGNORE INTO note_hashtags (note_id, hashtag_id) VALUES (?, ?)", noteID, hashtagID); err != nil {
			return fmt.Errorf("insert note_hashtag: %w", err)
		}
	}

	if _, err := tx.Exec(`DELETE FROM hashtags WHERE id NOT IN (SELECT hashtag_id FROM note_hashtags)`); err != nil {
		return fmt.Errorf("cleanup orphan hashtags: %w", err)
	}

	return nil
}

// RepairHashtagsFromNotes rebuilds the note_hashtags table by re-extracting
// hashtags from every note's content. Idempotent — safe to run at every startup.
// Preserves existing hashtag records (including colors); only rebuilds links.
func (d *DB) RepairHashtagsFromNotes() error {
	rows, err := d.Query("SELECT id, content FROM notes")
	if err != nil {
		return fmt.Errorf("repair hashtags: list notes: %w", err)
	}
	type noteRow struct {
		id      int64
		content string
	}
	var notes []noteRow
	for rows.Next() {
		var n noteRow
		rows.Scan(&n.id, &n.content)
		notes = append(notes, n)
	}
	rows.Close()

	tx, err := d.Begin()
	if err != nil {
		return fmt.Errorf("repair hashtags: begin tx: %w", err)
	}
	defer tx.Rollback()

	// Rebuild note_hashtags from scratch.
	if _, err := tx.Exec("DELETE FROM note_hashtags"); err != nil {
		return fmt.Errorf("repair hashtags: clear note_hashtags: %w", err)
	}

	for _, n := range notes {
		tags := services.ExtractHashtags(n.content)
		for _, tag := range tags {
			if _, err := tx.Exec("INSERT OR IGNORE INTO hashtags (name) VALUES (?)", tag); err != nil {
				return fmt.Errorf("repair hashtags: insert hashtag: %w", err)
			}
			var hid int64
			if err := tx.QueryRow("SELECT id FROM hashtags WHERE LOWER(name) = ?", tag).Scan(&hid); err != nil {
				return fmt.Errorf("repair hashtags: get hashtag id: %w", err)
			}
			if _, err := tx.Exec("INSERT OR IGNORE INTO note_hashtags (note_id, hashtag_id) VALUES (?, ?)", n.id, hid); err != nil {
				return fmt.Errorf("repair hashtags: insert note_hashtag: %w", err)
			}
		}
	}

	// Remove hashtags that no longer appear in any note.
	if _, err := tx.Exec("DELETE FROM hashtags WHERE id NOT IN (SELECT DISTINCT hashtag_id FROM note_hashtags)"); err != nil {
		return fmt.Errorf("repair hashtags: cleanup orphans: %w", err)
	}

	return tx.Commit()
}

// GetNoteUpdatedAt returns a note's updated_at timestamp.
func (d *DB) GetNoteUpdatedAt(id int64) (time.Time, error) {
	var t time.Time
	err := d.QueryRow("SELECT updated_at FROM notes WHERE id = ?", id).Scan(&t)
	return t, err
}

// generateShareToken creates a random 64-character hex string (32 bytes).
func generateShareToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate share token: %w", err)
	}
	return hex.EncodeToString(b), nil
}

// SetShareToken assigns a share token to a note if it doesn't already have one,
// then returns the current token. Idempotent — safe to call multiple times.
func (d *DB) SetShareToken(noteID int64) (string, error) {
	token, err := generateShareToken()
	if err != nil {
		return "", err
	}
	// Only set if currently NULL; if already set, the UPDATE is a no-op.
	if _, err := d.Exec(
		"UPDATE notes SET share_token = ? WHERE id = ? AND share_token IS NULL AND deleted_at IS NULL",
		token, noteID,
	); err != nil {
		return "", fmt.Errorf("set share token: %w", err)
	}
	// Return whatever token is stored (the newly set one, or the pre-existing one).
	var current string
	err = d.QueryRow("SELECT share_token FROM notes WHERE id = ? AND deleted_at IS NULL", noteID).Scan(&current)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return current, err
}

// ClearShareToken removes the share token from a note. Idempotent.
func (d *DB) ClearShareToken(noteID int64) error {
	_, err := d.Exec("UPDATE notes SET share_token = NULL WHERE id = ?", noteID)
	return err
}

// GetNoteByShareToken looks up a non-trashed note by its public share token.
func (d *DB) GetNoteByShareToken(token string) (*models.Note, error) {
	row := d.QueryRow(`
		SELECT n.id, n.content, n.pinned, n.created_at, n.updated_at,
		       GROUP_CONCAT(h.name, ',') AS hashtag_names,
		       (n.share_token IS NOT NULL) AS shared
		FROM notes n
		LEFT JOIN note_hashtags nh ON n.id = nh.note_id
		LEFT JOIN hashtags h ON nh.hashtag_id = h.id
		WHERE n.share_token = ? AND n.deleted_at IS NULL
		GROUP BY n.id`, token)

	var n models.Note
	var pinnedInt int
	var sharedInt int
	var hashtagNames sql.NullString
	if err := row.Scan(&n.ID, &n.Content, &pinnedInt, &n.CreatedAt, &n.UpdatedAt, &hashtagNames, &sharedInt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	n.Pinned = pinnedInt == 1
	n.Shared = sharedInt == 1
	n.Preview = services.GeneratePreview(n.Content, 100)
	n.Hashtags = parseHashtags(hashtagNames)
	n.Attachments = []models.Attachment{}
	return &n, nil
}

// ListSharedNotes returns all non-trashed notes that have an active share token.
func (d *DB) ListSharedNotes(limit, offset int) ([]models.Note, int, error) {
	q := `
SELECT n.id, n.content, n.pinned, n.created_at, n.updated_at,
       GROUP_CONCAT(h.name, ',') AS hashtag_names,
       (n.share_token IS NOT NULL) AS shared
FROM notes n
LEFT JOIN note_hashtags nh ON n.id = nh.note_id
LEFT JOIN hashtags h ON nh.hashtag_id = h.id
WHERE n.share_token IS NOT NULL AND n.deleted_at IS NULL
GROUP BY n.id
ORDER BY n.created_at DESC
LIMIT ? OFFSET ?`
	rows, err := d.Query(q, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	return scanSharedNotes(rows)
}

func scanSharedNotes(rows *sql.Rows) ([]models.Note, int, error) {
	var notes []models.Note
	for rows.Next() {
		var n models.Note
		var pinnedInt int
		var sharedInt int
		var hashtagNames sql.NullString
		if err := rows.Scan(&n.ID, &n.Content, &pinnedInt, &n.CreatedAt, &n.UpdatedAt, &hashtagNames, &sharedInt); err != nil {
			return nil, 0, err
		}
		n.Pinned = pinnedInt == 1
		n.Shared = sharedInt == 1
		n.Preview = services.GeneratePreview(n.Content, 100)
		n.Hashtags = parseHashtags(hashtagNames)
		n.Attachments = []models.Attachment{}
		notes = append(notes, n)
	}
	if notes == nil {
		notes = []models.Note{}
	}
	return notes, len(notes), nil
}
