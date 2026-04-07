ALTER TABLE notes ADD COLUMN deleted_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at);
