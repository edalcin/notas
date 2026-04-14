package db

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/edalcin/notes/internal/models"
)

func (d *DB) CreateAttachment(a *models.Attachment) (*models.Attachment, error) {
	result, err := d.Exec(`
		INSERT INTO attachments (note_id, stored_filename, original_name, mime_type, size_bytes)
		VALUES (?, ?, ?, ?, ?)`,
		a.NoteID, a.StoredFilename, a.OriginalName, a.MimeType, a.SizeBytes,
	)
	if err != nil {
		return nil, fmt.Errorf("insert attachment: %w", err)
	}
	id, _ := result.LastInsertId()
	return d.GetAttachment(id)
}

func (d *DB) GetAttachment(id int64) (*models.Attachment, error) {
	var a models.Attachment
	err := d.QueryRow(
		"SELECT id, note_id, stored_filename, original_name, mime_type, size_bytes, created_at FROM attachments WHERE id = ?",
		id,
	).Scan(&a.ID, &a.NoteID, &a.StoredFilename, &a.OriginalName, &a.MimeType, &a.SizeBytes, &a.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	a.URL = "/files/" + a.StoredFilename
	return &a, nil
}

func (d *DB) GetAttachmentsByNote(noteID int64) ([]models.Attachment, error) {
	rows, err := d.Query(
		"SELECT id, note_id, stored_filename, original_name, mime_type, size_bytes, created_at FROM attachments WHERE note_id = ? ORDER BY created_at ASC",
		noteID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attachments []models.Attachment
	for rows.Next() {
		var a models.Attachment
		if err := rows.Scan(&a.ID, &a.NoteID, &a.StoredFilename, &a.OriginalName, &a.MimeType, &a.SizeBytes, &a.CreatedAt); err != nil {
			return nil, err
		}
		a.URL = "/files/" + a.StoredFilename
		attachments = append(attachments, a)
	}
	if attachments == nil {
		attachments = []models.Attachment{}
	}
	return attachments, nil
}

func (d *DB) ListAllAttachments(hashtag string) ([]models.AttachmentListItem, error) {
	query := `
		SELECT a.id, a.note_id, a.original_name, a.mime_type, a.size_bytes, a.stored_filename, a.created_at,
		       COALESCE(SUBSTR(n.content, 1, 300), '') AS note_content,
		       n.created_at AS note_created_at,
		       GROUP_CONCAT(h.name, ',') AS hashtag_names
		FROM attachments a
		LEFT JOIN notes n ON n.id = a.note_id
		LEFT JOIN note_hashtags nh ON nh.note_id = n.id
		LEFT JOIN hashtags h ON h.id = nh.hashtag_id`

	var args []interface{}
	if hashtag != "" {
		query += `
		WHERE n.id IS NOT NULL
		AND n.deleted_at IS NULL
		AND n.id IN (
			SELECT nh2.note_id FROM note_hashtags nh2
			JOIN hashtags h2 ON nh2.hashtag_id = h2.id
			WHERE LOWER(h2.name) = LOWER(?)
		)`
		args = append(args, hashtag)
	} else {
		query += `
		WHERE n.id IS NOT NULL
		AND n.deleted_at IS NULL`
	}

	query += `
		GROUP BY a.id
		ORDER BY COALESCE(n.created_at, a.created_at) DESC`

	rows, err := d.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.AttachmentListItem
	for rows.Next() {
		var item models.AttachmentListItem
		var storedFilename string
		var noteContent string
		var noteCreatedAt sql.NullTime
		var hashtagNames sql.NullString
		if err := rows.Scan(
			&item.ID, &item.NoteID, &item.OriginalName, &item.MimeType, &item.SizeBytes,
			&storedFilename, &item.CreatedAt, &noteContent, &noteCreatedAt, &hashtagNames,
		); err != nil {
			return nil, err
		}
		item.URL = "/files/" + storedFilename
		item.NoteTitle = extractNoteTitle(noteContent)
		if noteCreatedAt.Valid {
			t := noteCreatedAt.Time
			item.NoteCreatedAt = &t
		}
		item.Hashtags = parseHashtagList(hashtagNames)
		items = append(items, item)
	}
	if items == nil {
		items = []models.AttachmentListItem{}
	}
	return items, nil
}

func extractNoteTitle(content string) string {
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "#") {
			title := strings.TrimLeft(line, "#")
			title = strings.TrimSpace(title)
			if title != "" {
				return title
			}
		}
	}
	return ""
}

func parseHashtagList(s sql.NullString) []string {
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

// DeleteOrphanAttachments removes attachment records whose note no longer
// exists in the notes table. Returns the stored filenames of deleted records
// so the caller can remove the physical files. Called at startup as a safety
// net for any state left by a crash or a missing explicit delete.
func (d *DB) DeleteOrphanAttachments() ([]string, error) {
	rows, err := d.Query(`
		SELECT stored_filename FROM attachments
		WHERE note_id NOT IN (SELECT id FROM notes)`)
	if err != nil {
		return nil, err
	}
	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			rows.Close()
			return nil, err
		}
		names = append(names, name)
	}
	rows.Close()
	if len(names) == 0 {
		return nil, nil
	}
	if _, err := d.Exec(`DELETE FROM attachments WHERE note_id NOT IN (SELECT id FROM notes)`); err != nil {
		return nil, err
	}
	return names, nil
}

// AllStoredFilenames returns a set of every stored_filename currently in the
// attachments table (including attachments on trashed notes). Used at startup
// to identify files on disk that have no matching DB record.
func (d *DB) AllStoredFilenames() (map[string]bool, error) {
	rows, err := d.Query("SELECT stored_filename FROM attachments")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	known := make(map[string]bool)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		known[name] = true
	}
	return known, rows.Err()
}

func (d *DB) DeleteAttachment(id int64) (string, error) {
	var storedFilename string
	if err := d.QueryRow("SELECT stored_filename FROM attachments WHERE id = ?", id).Scan(&storedFilename); err != nil {
		if err == sql.ErrNoRows {
			return "", nil
		}
		return "", err
	}
	if _, err := d.Exec("DELETE FROM attachments WHERE id = ?", id); err != nil {
		return "", err
	}
	return storedFilename, nil
}
