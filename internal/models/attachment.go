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

// AttachmentListItem is used by the global attachments list endpoint.
type AttachmentListItem struct {
	ID            int64      `json:"id"`
	NoteID        int64      `json:"note_id"`
	OriginalName  string     `json:"original_name"`
	MimeType      string     `json:"mime_type"`
	SizeBytes     int64      `json:"size_bytes"`
	URL           string     `json:"url"`
	CreatedAt     time.Time  `json:"created_at"`
	NotePreview   string     `json:"note_preview"`
	NoteTitle     string     `json:"note_title"`
	NoteCreatedAt *time.Time `json:"note_created_at,omitempty"`
	Hashtags      []string   `json:"hashtags"`
}

type AttachmentsListResponse struct {
	Attachments []AttachmentListItem `json:"attachments"`
}
