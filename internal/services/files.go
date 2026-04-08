package services

import (
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"

	"github.com/google/uuid"
)

var allowedMimeTypes = map[string]bool{
	"image/jpeg":      true,
	"image/png":       true,
	"image/gif":       true,
	"image/webp":      true,
	"application/pdf": true,
}

// SaveFile validates and saves an uploaded file using magic bytes detection.
// Returns the stored filename, the detected MIME type, and any error.
func SaveFile(header *multipart.FileHeader, filesPath string, maxBytes int64) (string, string, error) {
	if header.Size > maxBytes {
		return "", "", fmt.Errorf("file too large: %d bytes (max %d)", header.Size, maxBytes)
	}

	src, err := header.Open()
	if err != nil {
		return "", "", fmt.Errorf("open upload: %w", err)
	}
	defer src.Close()

	// Detect real MIME type from file content, ignoring client-declared Content-Type.
	buf := make([]byte, 512)
	n, _ := src.Read(buf)
	detectedMime := http.DetectContentType(buf[:n])
	if _, err := src.Seek(0, io.SeekStart); err != nil {
		return "", "", fmt.Errorf("seek upload: %w", err)
	}

	if !allowedMimeTypes[detectedMime] {
		return "", "", fmt.Errorf("unsupported file type")
	}

	ext := filepath.Ext(header.Filename)
	storedFilename := uuid.New().String() + ext

	destPath := filepath.Join(filesPath, storedFilename)
	dst, err := os.Create(destPath)
	if err != nil {
		return "", "", fmt.Errorf("create file: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		os.Remove(destPath)
		return "", "", fmt.Errorf("write file: %w", err)
	}

	return storedFilename, detectedMime, nil
}

// DeleteFile removes a file from the storage directory. Ignores not-found errors.
func DeleteFile(storedFilename, filesPath string) error {
	path := filepath.Join(filesPath, storedFilename)
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete file %s: %w", storedFilename, err)
	}
	return nil
}
