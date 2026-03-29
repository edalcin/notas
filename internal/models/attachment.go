package models

import "time"

type Attachment struct {
	ID             int64     `json:"id"`
	NoteID         int64     `json:"note_id,omitempty"`
	StoredFilename string    `json:"stored_filename"`
	OriginalName   string    `json:"original_name"`
	MimeType       string    `json:"mime_type"`
	SizeBytes      int64     `json:"size_bytes"`
	URL            string    `json:"url"`
	CreatedAt      time.Time `json:"created_at"`
}
