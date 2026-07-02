ALTER TABLE notes ADD COLUMN archived_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_notes_archived_at ON notes(archived_at);
