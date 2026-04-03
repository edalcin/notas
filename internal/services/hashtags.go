package services

import (
	"database/sql"
	"fmt"
)

// RenameHashtag replaces all occurrences of #oldName with #newName in all notes content,
// updates the hashtag record.
func RenameHashtag(tx *sql.Tx, oldName, newName string) error {
	oldTag := "#" + oldName
	newTag := "#" + newName

	result, err := tx.Exec("UPDATE hashtags SET name = ? WHERE LOWER(name) = LOWER(?)", newName, oldName)
	if err != nil {
		return fmt.Errorf("update hashtag name: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("hashtag not found: %s", oldName)
	}

	if _, err := tx.Exec(
		"UPDATE notes SET content = REPLACE(content, ?, ?), updated_at = CURRENT_TIMESTAMP WHERE content LIKE ?",
		oldTag, newTag, "%"+oldTag+"%",
	); err != nil {
		return fmt.Errorf("update notes content: %w", err)
	}

	return nil
}

// DeleteHashtag removes all occurrences of #name from notes content and deletes the hashtag.
func DeleteHashtag(tx *sql.Tx, name string) error {
	tag := "#" + name

	// Remove the hashtag from note content by replacing it with empty string
	for _, pattern := range []string{tag + " ", " " + tag, tag} {
		if _, err := tx.Exec(
			"UPDATE notes SET content = TRIM(REPLACE(content, ?, '')), updated_at = CURRENT_TIMESTAMP WHERE content LIKE ?",
			pattern, "%"+tag+"%",
		); err != nil {
			return fmt.Errorf("remove hashtag from notes: %w", err)
		}
	}

	result, err := tx.Exec("DELETE FROM hashtags WHERE LOWER(name) = LOWER(?)", name)
	if err != nil {
		return fmt.Errorf("delete hashtag: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("hashtag not found: %s", name)
	}

	return nil
}
