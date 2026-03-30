package db

import (
	"database/sql"
	"fmt"

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

func (d *DB) ListAllAttachments() ([]models.AttachmentListItem, error) {
	rows, err := d.Query(`
		SELECT a.id, a.note_id, a.original_name, a.mime_type, a.size_bytes, a.stored_filename, a.created_at,
		       COALESCE(SUBSTR(n.content, 1, 80), '') AS note_preview
		FROM attachments a
		LEFT JOIN notes n ON n.id = a.note_id
		ORDER BY a.created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.AttachmentListItem
	for rows.Next() {
		var item models.AttachmentListItem
		var storedFilename string
		if err := rows.Scan(&item.ID, &item.NoteID, &item.OriginalName, &item.MimeType, &item.SizeBytes, &storedFilename, &item.CreatedAt, &item.NotePreview); err != nil {
			return nil, err
		}
		item.URL = "/files/" + storedFilename
		items = append(items, item)
	}
	if items == nil {
		items = []models.AttachmentListItem{}
	}
	return items, nil
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
