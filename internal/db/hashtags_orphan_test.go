package db

import (
	"path/filepath"
	"testing"
)

func hashtagRowCount(t *testing.T, d *DB, name string) int {
	t.Helper()
	var n int
	if err := d.QueryRow("SELECT COUNT(*) FROM hashtags WHERE name = ?", name).Scan(&n); err != nil {
		t.Fatalf("count hashtag rows: %v", err)
	}
	return n
}

// TestTrashNotePurgesOrphanHashtag defends the contract that a tag left with
// no active/archived note is deleted from the system immediately on trash —
// not merely hidden from the sidebar list until the trash is emptied.
func TestTrashNotePurgesOrphanHashtag(t *testing.T) {
	d, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer d.Close()

	note, err := d.CreateNote("only #uniquetag here")
	if err != nil {
		t.Fatalf("create note: %v", err)
	}
	if got := hashtagRowCount(t, d, "uniquetag"); got != 1 {
		t.Fatalf("expected hashtag row to exist after create, count=%d", got)
	}

	if err := d.TrashNote(note.ID); err != nil {
		t.Fatalf("trash note: %v", err)
	}
	if got := hashtagRowCount(t, d, "uniquetag"); got != 0 {
		t.Fatalf("expected orphan hashtag purged after trash, count=%d", got)
	}

	tags, err := d.ListHashtags()
	if err != nil {
		t.Fatalf("list hashtags: %v", err)
	}
	for _, h := range tags {
		if h.Name == "uniquetag" {
			t.Fatalf("orphan tag must not be listed after trash")
		}
	}

	if err := d.RestoreNote(note.ID); err != nil {
		t.Fatalf("restore note: %v", err)
	}
	if got := hashtagRowCount(t, d, "uniquetag"); got != 1 {
		t.Fatalf("expected hashtag re-created after restore, count=%d", got)
	}
	tags, err = d.ListHashtags()
	if err != nil {
		t.Fatalf("list hashtags after restore: %v", err)
	}
	found := false
	for _, h := range tags {
		if h.Name == "uniquetag" {
			found = true
		}
	}
	if !found {
		t.Fatalf("restored note's tag must reappear in hashtag list")
	}
}

// TestTrashNoteKeepsSharedHashtag ensures a tag still used by another
// active note survives when one of its notes is trashed.
func TestTrashNoteKeepsSharedHashtag(t *testing.T) {
	d, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer d.Close()

	kept, err := d.CreateNote("kept note #shared")
	if err != nil {
		t.Fatalf("create kept note: %v", err)
	}
	toTrash, err := d.CreateNote("trashed note #shared")
	if err != nil {
		t.Fatalf("create note to trash: %v", err)
	}
	_ = kept

	if err := d.TrashNote(toTrash.ID); err != nil {
		t.Fatalf("trash note: %v", err)
	}
	if got := hashtagRowCount(t, d, "shared"); got != 1 {
		t.Fatalf("shared tag must survive while another note still references it, count=%d", got)
	}
}
