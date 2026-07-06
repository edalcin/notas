package db

import (
	"path/filepath"
	"testing"
)

// TestSearchNotesIncludesArchived defends the contract that "Busca nas notas"
// surfaces archived notes (with ArchivedAt populated) but never trashed ones.
func TestSearchNotesIncludesArchived(t *testing.T) {
	d, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer d.Close()

	active, err := d.CreateNote("golang search me active")
	if err != nil {
		t.Fatalf("create active note: %v", err)
	}
	archived, err := d.CreateNote("golang search me archived")
	if err != nil {
		t.Fatalf("create archived note: %v", err)
	}
	trashed, err := d.CreateNote("golang search me trashed")
	if err != nil {
		t.Fatalf("create trashed note: %v", err)
	}

	if err := d.ArchiveNote(archived.ID); err != nil {
		t.Fatalf("archive note: %v", err)
	}
	if err := d.TrashNote(trashed.ID); err != nil {
		t.Fatalf("trash note: %v", err)
	}

	notes, total, err := d.SearchNotes("golang", 50, 0)
	if err != nil {
		t.Fatalf("search notes: %v", err)
	}
	if total != 2 {
		t.Fatalf("expected 2 results (active + archived, trashed excluded), got %d", total)
	}

	byID := map[int64]bool{}
	var archivedAtSet bool
	for _, n := range notes {
		byID[n.ID] = true
		if n.ID == archived.ID {
			archivedAtSet = n.ArchivedAt != nil
		}
	}
	if !byID[active.ID] {
		t.Errorf("active note %d missing from search results", active.ID)
	}
	if !byID[archived.ID] {
		t.Errorf("archived note %d missing from search results", archived.ID)
	}
	if byID[trashed.ID] {
		t.Errorf("trashed note %d must not appear in search results", trashed.ID)
	}
	if !archivedAtSet {
		t.Errorf("archived note %d must have ArchivedAt populated so the UI can flag it", archived.ID)
	}
}
