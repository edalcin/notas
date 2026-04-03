package db

import (
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/edalcin/notes/internal/models"
	"github.com/edalcin/notes/internal/services"
)

const baseNotesSQL = `
SELECT n.id, n.content, n.pinned, n.created_at, n.updated_at,
       GROUP_CONCAT(h.name, ',') as hashtag_names
FROM notes n
LEFT JOIN note_hashtags nh ON n.id = nh.note_id
LEFT JOIN hashtags h ON nh.hashtag_id = h.id
%s
GROUP BY n.id
ORDER BY n.pinned DESC, n.created_at DESC
LIMIT ? OFFSET ?`

func (d *DB) ListNotes(limit, offset int) ([]models.Note, int, error) {
	q := fmt.Sprintf(baseNotesSQL, "")
	return d.queryNotes(q, nil, limit, offset)
}

func (d *DB) FilterByHashtag(hashtag string, limit, offset int) ([]models.Note, int, error) {
	where := "WHERE n.id IN (SELECT nh2.note_id FROM note_hashtags nh2 JOIN hashtags h2 ON nh2.hashtag_id = h2.id WHERE LOWER(h2.name) = LOWER(?))"
	q := fmt.Sprintf(baseNotesSQL, where)
	return d.queryNotes(q, hashtag, limit, offset)
}

func (d *DB) SearchNotes(query string, limit, offset int) ([]models.Note, int, error) {
	q := `
SELECT n.id, n.content, n.pinned, n.created_at, n.updated_at,
       GROUP_CONCAT(h.name, ',') as hashtag_names
FROM notes n
LEFT JOIN note_hashtags nh ON n.id = nh.note_id
LEFT JOIN hashtags h ON nh.hashtag_id = h.id
WHERE n.id IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?)
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
		var hashtagNames sql.NullString
		if err := rows.Scan(&n.ID, &n.Content, &pinnedInt, &n.CreatedAt, &n.UpdatedAt, &hashtagNames); err != nil {
			return nil, 0, err
		}
		n.Pinned = pinnedInt == 1
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
		       GROUP_CONCAT(h.name, ',') as hashtag_names
		FROM notes n
		LEFT JOIN note_hashtags nh ON n.id = nh.note_id
		LEFT JOIN hashtags h ON nh.hashtag_id = h.id
		WHERE n.id = ?
		GROUP BY n.id`, id)

	var n models.Note
	var pinnedInt int
	var hashtagNames sql.NullString
	if err := row.Scan(&n.ID, &n.Content, &pinnedInt, &n.CreatedAt, &n.UpdatedAt, &hashtagNames); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	n.Pinned = pinnedInt == 1
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
	result, err := d.Exec("DELETE FROM notes WHERE id = ?", id)
	if err != nil {
		return err
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
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
