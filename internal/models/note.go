package models

import "time"

type Note struct {
	ID          int64        `json:"id"`
	Content     string       `json:"content"`
	Preview     string       `json:"preview"`
	Pinned      bool         `json:"pinned"`
	Hashtags    []string     `json:"hashtags"`
	Attachments []Attachment `json:"attachments"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
	DeletedAt   *time.Time   `json:"deleted_at,omitempty"`
}

type NotesResponse struct {
	Notes  []Note `json:"notes"`
	Total  int    `json:"total"`
	Offset int    `json:"offset"`
	Limit  int    `json:"limit"`
}
