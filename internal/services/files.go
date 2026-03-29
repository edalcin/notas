package services

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
)

var allowedMimeTypes = map[string]bool{
	"image/jpeg":      true,
	"image/png":       true,
	"image/gif":       true,
	"image/webp":      true,
	"image/svg+xml":   true,
	"application/pdf": true,
	"application/msword": true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
	"application/vnd.ms-excel": true,
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
}

// SaveFile validates and saves an uploaded file. Returns stored filename and error.
func SaveFile(header *multipart.FileHeader, filesPath string, maxBytes int64) (string, error) {
	if header.Size > maxBytes {
		return "", fmt.Errorf("file too large: %d bytes (max %d)", header.Size, maxBytes)
	}

	mimeType := header.Header.Get("Content-Type")
	if idx := strings.Index(mimeType, ";"); idx != -1 {
		mimeType = strings.TrimSpace(mimeType[:idx])
	}
	if !allowedMimeTypes[mimeType] && !strings.HasPrefix(mimeType, "image/") {
		return "", fmt.Errorf("unsupported file type: %s", mimeType)
	}

	ext := filepath.Ext(header.Filename)
	storedFilename := uuid.New().String() + ext

	src, err := header.Open()
	if err != nil {
		return "", fmt.Errorf("open upload: %w", err)
	}
	defer src.Close()

	destPath := filepath.Join(filesPath, storedFilename)
	dst, err := os.Create(destPath)
	if err != nil {
		return "", fmt.Errorf("create file: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		os.Remove(destPath)
		return "", fmt.Errorf("write file: %w", err)
	}

	return storedFilename, nil
}

// DeleteFile removes a file from the storage directory. Ignores not-found errors.
func DeleteFile(storedFilename, filesPath string) error {
	path := filepath.Join(filesPath, storedFilename)
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("delete file %s: %w", storedFilename, err)
	}
	return nil
}
