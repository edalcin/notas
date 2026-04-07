package handlers

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

const sessionCookieName = "notas_session"
const sessionMaxAge = 30 * 24 * 60 * 60 // 30 days in seconds

// NewSessionSecret generates a random 32-byte hex secret.
func NewSessionSecret() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic("cannot generate session secret: " + err.Error())
	}
	return hex.EncodeToString(b)
}

func tokenForPIN(pin, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(pin))
	return hex.EncodeToString(mac.Sum(nil))
}

// PINMiddleware enforces PIN authentication when pin is non-empty.
// Exempts /api/auth/login and /health so they are always reachable.
// API/files paths return 401 JSON; HTML/static routes serve the SPA (which shows PIN overlay).
func PINMiddleware(pin, secret string, secureCookie bool) func(http.Handler) http.Handler {
	if pin == "" {
		return func(next http.Handler) http.Handler { return next }
	}
	expected := tokenForPIN(pin, secret)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Always allow these paths (public share pages need no auth)
			if r.URL.Path == "/api/auth/login" || r.URL.Path == "/health" ||
				strings.HasPrefix(r.URL.Path, "/s/") {
				next.ServeHTTP(w, r)
				return
			}
			// Validate session cookie
			if c, err := r.Cookie(sessionCookieName); err == nil &&
				hmac.Equal([]byte(c.Value), []byte(expected)) {
				next.ServeHTTP(w, r)
				return
			}
			// Protected API/files → 401 JSON so frontend can detect unauthenticated state
			if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/files/") {
				w.Header().Set("Content-Type", "application/json")
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			// Static/SPA → serve normally; frontend shows PIN overlay
			next.ServeHTTP(w, r)
		})
	}
}

// PINLogin handles POST /api/auth/login.
func PINLogin(pin, secret string, secureCookie bool) http.HandlerFunc {
	expected := tokenForPIN(pin, secret)
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			PIN string `json:"pin"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			w.Header().Set("Content-Type", "application/json")
			http.Error(w, `{"error":"bad request"}`, http.StatusBadRequest)
			return
		}
		if body.PIN != pin {
			w.Header().Set("Content-Type", "application/json")
			http.Error(w, `{"error":"invalid pin"}`, http.StatusUnauthorized)
			return
		}
		http.SetCookie(w, &http.Cookie{
			Name:     sessionCookieName,
			Value:    expected,
			Path:     "/",
			MaxAge:   sessionMaxAge,
			HttpOnly: true,
			Secure:   secureCookie,
			SameSite: http.SameSiteLaxMode,
		})
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true}`))
	}
}

// PINLogout clears the session cookie.
func PINLogout() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.SetCookie(w, &http.Cookie{
			Name:    sessionCookieName,
			Value:   "",
			Path:    "/",
			Expires: time.Unix(0, 0),
			MaxAge:  -1,
		})
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"ok":true}`))
	}
}
