package db

import (
	"github.com/edalcin/notes/internal/models"
	"github.com/edalcin/notes/internal/services"
)

func (d *DB) ListHashtags() ([]models.Hashtag, error) {
	rows, err := d.Query(`
		SELECT h.name, COUNT(nh.note_id) as count
		FROM hashtags h
		LEFT JOIN note_hashtags nh ON h.id = nh.hashtag_id
		GROUP BY h.id, h.name
		ORDER BY h.name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hashtags []models.Hashtag
	for rows.Next() {
		var h models.Hashtag
		if err := rows.Scan(&h.Name, &h.Count); err != nil {
			return nil, err
		}
		hashtags = append(hashtags, h)
	}
	if hashtags == nil {
		hashtags = []models.Hashtag{}
	}
	return hashtags, nil
}

func (d *DB) RenameHashtag(oldName, newName string) error {
	tx, err := d.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := services.RenameHashtag(tx, oldName, newName); err != nil {
		return err
	}

	rows, err := tx.Query("SELECT id, content FROM notes WHERE content LIKE ?", "%#"+newName+"%")
	if err != nil {
		return err
	}

	type noteRow struct {
		id      int64
		content string
	}
	var affected []noteRow
	for rows.Next() {
		var nr noteRow
		rows.Scan(&nr.id, &nr.content)
		affected = append(affected, nr)
	}
	rows.Close()

	for _, nr := range affected {
		tags := services.ExtractHashtags(nr.content)
		if err := syncNoteHashtags(tx, nr.id, tags); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (d *DB) DeleteHashtag(name string) error {
	tx, err := d.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	rows, err := tx.Query("SELECT id, content FROM notes WHERE content LIKE ?", "%#"+name+"%")
	if err != nil {
		return err
	}

	type noteRow struct {
		id      int64
		content string
	}
	var affected []noteRow
	for rows.Next() {
		var nr noteRow
		rows.Scan(&nr.id, &nr.content)
		affected = append(affected, nr)
	}
	rows.Close()

	if err := services.DeleteHashtag(tx, name); err != nil {
		return err
	}

	for _, nr := range affected {
		tags := services.ExtractHashtags(nr.content)
		if err := syncNoteHashtags(tx, nr.id, tags); err != nil {
			return err
		}
	}

	return tx.Commit()
}
