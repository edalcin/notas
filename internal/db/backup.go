package db

import (
	"database/sql"
	"fmt"
	"io"
	"os"

	_ "modernc.org/sqlite"
)

// Backup creates a live-consistent snapshot at destPath using VACUUM INTO.
func (d *DB) Backup(destPath string) error {
	if _, err := d.Exec("VACUUM INTO ?", destPath); err != nil {
		return fmt.Errorf("VACUUM INTO: %w", err)
	}
	return nil
}

// Restore replaces the active database with the SQLite file at srcPath.
// It validates the file, closes the current connection, atomically replaces
// the database file at dbPath, then reopens and re-runs any pending migrations.
// Because all handler structs share the same *DB pointer, they observe the
// restored data immediately without needing to be updated.
func (d *DB) Restore(srcPath, dbPath string) error {
	if err := validateSQLiteFile(srcPath); err != nil {
		return err
	}
	if err := d.DB.Close(); err != nil {
		return fmt.Errorf("close db: %w", err)
	}
	tmp := dbPath + ".restore.tmp"
	if err := copyFile(srcPath, tmp); err != nil {
		return fmt.Errorf("copy to temp: %w", err)
	}
	if err := os.Rename(tmp, dbPath); err != nil {
		os.Remove(tmp) //nolint:errcheck
		return fmt.Errorf("rename: %w", err)
	}
	dsn := fmt.Sprintf("file:%s?_foreign_keys=on&_journal_mode=WAL&_busy_timeout=5000", dbPath)
	newSQL, err := sql.Open("sqlite", dsn)
	if err != nil {
		return fmt.Errorf("reopen: %w", err)
	}
	newSQL.SetMaxOpenConns(1)
	if err := newSQL.Ping(); err != nil {
		newSQL.Close() //nolint:errcheck
		return fmt.Errorf("ping after restore: %w", err)
	}
	d.DB = newSQL
	if err := d.runMigrations(); err != nil {
		return fmt.Errorf("migrations after restore: %w", err)
	}
	return nil
}

func validateSQLiteFile(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open: %w", err)
	}
	magic := make([]byte, 16)
	_, err = f.Read(magic)
	f.Close()
	if err != nil || string(magic) != "SQLite format 3\x00" {
		return fmt.Errorf("arquivo não é um banco de dados SQLite válido")
	}
	return nil
}

func copyFile(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()
	buf := make([]byte, 32*1024)
	for {
		n, readErr := in.Read(buf)
		if n > 0 {
			if _, werr := out.Write(buf[:n]); werr != nil {
				return werr
			}
		}
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			return readErr
		}
	}
	return out.Sync()
}
