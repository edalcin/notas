# Quickstart: Testing Public Note Share Link

**Branch**: `003-public-share-link` | **Date**: 2026-04-07

## Prerequisites

- Go 1.23+ installed
- App running locally (`APP_PIN`, `DB_PATH`, `FILES_PATH`, `SESSION_SECRET` set)

## Running the App

```bash
cd D:/git/notas
APP_PIN=1234 DB_PATH=./notas.db FILES_PATH=./files SESSION_SECRET=devsecret go run .
```

App available at: `http://localhost:8080`

---

## Test Flow 1 — Generate and Use a Share Link (P1 + P2)

1. Open `http://localhost:8080` and log in with PIN `1234`
2. Create a note with some Markdown: `## Hello\n\nThis is a **shared** note.`
3. On the note card, click the 🔗 (share) icon
4. The share modal opens — click **"Gerar link"**
5. The modal now shows the full URL, e.g. `http://localhost:8080/s/abc123...`
6. Click **"Copiar link"** — URL is copied to clipboard
7. Open a new browser window **in incognito mode** (no session cookie)
8. Paste the URL and open it
9. **Expected**: The note content is displayed as rendered Markdown, no PIN prompt

---

## Test Flow 2 — Revoke a Share Link (P3/P4)

1. With the share modal open (from Flow 1), click **"Revogar link"**
2. The modal resets to "Gerar link" state
3. In the incognito window, refresh the previously shared URL
4. **Expected**: Page shows "Nota não encontrada ou link inválido"
5. In the sidebar, click **"Compartilhadas"**
6. **Expected**: The note is no longer listed

---

## Test Flow 3 — Shared Notes Sidebar Section

1. Share 2-3 different notes (repeat Flow 1 for each)
2. Click **"Compartilhadas"** in the left sidebar
3. **Expected**: All shared notes appear in the list
4. Each card has a 🔗 icon (active state) — clicking it opens the share modal
5. Revoke one note's link via the modal
6. **Expected**: That note disappears from the "Compartilhadas" list immediately

---

## Test Flow 4 — Trash Protection

1. Share a note (generates a public URL)
2. Copy the URL
3. Move the note to the trash (🗑️ icon)
4. In an incognito window, open the copied URL
5. **Expected**: Page shows error ("Nota não encontrada ou link inválido") — not the note content

---

## Test Flow 5 — Rate Limiting

```bash
# Send 35 rapid requests to the public endpoint
for i in $(seq 1 35); do
  curl -o /dev/null -s -w "%{http_code}\n" "http://localhost:8080/s/SOME_VALID_TOKEN"
done
```

**Expected**: First ~30 responses are `200`, remaining responses are `429`

---

## Verifying the "shared" Field in Note List

```bash
# Authenticated request (replace cookie value)
curl -s -H "Cookie: notas_session=YOUR_SESSION_COOKIE" \
  "http://localhost:8080/api/notes" | jq '.[].shared'
```

Notes without a share link should return `false`, notes with an active link return `true`.
