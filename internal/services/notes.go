package services

import (
	"regexp"
	"strings"
	"unicode/utf8"
)

var hashtagRegex = regexp.MustCompile(`#([a-zA-Z0-9_\x{00C0}-\x{017E}]+)`)

// ExtractHashtags returns deduplicated lowercase hashtag names from content.
func ExtractHashtags(content string) []string {
	matches := hashtagRegex.FindAllStringSubmatch(content, -1)
	seen := make(map[string]struct{})
	var result []string
	for _, m := range matches {
		tag := strings.ToLower(m[1])
		if _, ok := seen[tag]; !ok {
			seen[tag] = struct{}{}
			result = append(result, tag)
		}
	}
	return result
}

// GeneratePreview returns the first non-empty line of content, trimmed to maxLen runes.
func GeneratePreview(content string, maxLen int) string {
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		line = strings.TrimLeft(line, "#")
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if utf8.RuneCountInString(line) > maxLen {
			runes := []rune(line)
			return string(runes[:maxLen]) + "…"
		}
		return line
	}
	return "(sem conteúdo)"
}
