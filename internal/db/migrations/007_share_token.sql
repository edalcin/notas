ALTER TABLE notes ADD COLUMN share_token TEXT;
CREATE UNIQUE INDEX idx_notes_share_token ON notes(share_token) WHERE share_token IS NOT NULL;
