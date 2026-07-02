# Graph Report - notas  (2026-07-02)

## Corpus Check
- 100 files · ~72,292 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 433 nodes · 790 edges · 42 communities (27 shown, 15 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 88 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `23da6b63`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]

## God Nodes (most connected - your core abstractions)
1. `jsonError()` - 25 edges
2. `DB` - 22 edges
3. `NoteHandler` - 20 edges
4. `main()` - 20 edges
5. `jsonResponse()` - 20 edges
6. `Request` - 18 edges
7. `ResponseWriter` - 17 edges
8. `loadNotes()` - 15 edges
9. `Note` - 15 edges
10. `parseID()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Docker Compose Configuration` --references--> `Backend Entry Point`  [INFERRED]
  docker-compose.yml → backend/cmd/server/main.go
- `main()` --calls--> `NewNoteHandler()`  [INFERRED]
  main.go → internal/handlers/notes.go
- `main()` --calls--> `Open()`  [INFERRED]
  main.go → internal/db/db.go
- `main()` --calls--> `NewSessionSecret()`  [INFERRED]
  main.go → internal/handlers/auth.go
- `main()` --calls--> `NewBackupHandler()`  [INFERRED]
  main.go → internal/handlers/backup.go

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Core Application Stack** — backend_main, backend_db, frontend_index, frontend_app_js [EXTRACTED 1.00]
- **Feature 001 Design Artifacts** — spec_001_web_notes_app, data_model_001, api_contract_001 [EXTRACTED 1.00]
- **Feature: Trash and Restore Notes** — specs_002_trash_restore_notes_tasks, specs_002_trash_restore_notes_requirements, specs_002_trash_restore_notes_api [EXTRACTED 1.00]
- **Feature: Public Note Share Link** — specs_003_public_share_link_data_model, specs_003_public_share_link_plan, specs_003_public_share_link_quickstart, specs_003_public_share_link_research, specs_003_public_share_link_spec, specs_003_public_share_link_tasks, specs_003_public_share_link_requirements, specs_003_public_share_link_share_api [EXTRACTED 1.00]
- **Feature: Critical Security Vulnerability Fixes** — specs_004_fix_critical_vulns_data_model, specs_004_fix_critical_vulns_plan, specs_004_fix_critical_vulns_quickstart, specs_004_fix_critical_vulns_research, specs_004_fix_critical_vulns_spec, specs_004_fix_critical_vulns_tasks, specs_004_fix_critical_vulns_requirements [EXTRACTED 1.00]

## Communities (42 total, 15 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (30): showSharedView(), showTrashView(), showConfirmModal(), appendCards(), bindCardEvents(), currentFilter, disconnectObserver(), esc() (+22 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (24): FileHeader, HashtagHandler, isValidHexColor(), NewHashtagHandler(), deleteFileFromPath(), getFilesPath(), getMaxUpload(), jsonError() (+16 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (18): DB, generateShareToken(), parseHashtags(), scanArchivedNotes(), scanNotes(), scanSharedNotes(), scanTrashedNotes(), syncNoteHashtags() (+10 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (33): FS, AttachmentHandler, NewAttachmentHandler(), ServeFile(), NewSessionSecret(), PINLogin(), PINLogout(), PINMiddleware() (+25 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (37): bindUI(), initApp(), showAttachmentsView(), deleteGlobalAttachment(), esc(), itemHTML(), loadAttachmentsView(), mimeIcon() (+29 more)

### Community 5 - "Community 5"
Cohesion: 0.15
Nodes (21): handleIncomingShare(), attachmentHTML(), deleteAttachment(), escapeHtml(), loadAttachments(), renderAttachments(), uploadAttachment(), acConfirm() (+13 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (21): background_color, categories, description, display, icons, id, name, orientation (+13 more)

### Community 7 - "Community 7"
Cohesion: 0.29
Nodes (18): Extract-PlanField(), Format-TechnologyStack(), Get-CommandsForLanguage(), Get-LanguageConventions(), Get-ProjectStructure(), Main(), New-AgentFile(), Parse-PlanData() (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (9): copyFile(), validateSQLiteFile(), Open(), NewBackupHandler(), BackupHandler, DB, DB, Request (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.19
Nodes (6): AttachmentListItem, extractNoteTitle(), parseHashtagList(), Attachment, DB, NullString

### Community 10 - "Community 10"
Cohesion: 0.23
Nodes (10): clientIP(), NewPublicHandler(), ParseTrustedProxies(), PublicHandler, rateLimiter, DB, IPNet, Mutex (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.40
Nodes (5): frontend/assets/js/shared.js, internal/handlers/public.go, Implementation Plan: Public Note Share Link, Feature Specification: Public Note Share Link, Tasks: Public Note Share Link

### Community 12 - "Community 12"
Cohesion: 0.33
Nodes (6): Find-SpecifyRoot(), Get-CurrentBranch(), Get-FeatureDir(), Get-FeaturePathsEnv(), Get-RepoRoot(), Test-HasGit()

### Community 13 - "Community 13"
Cohesion: 0.40
Nodes (6): frontend/assets/js/public.js, internal/services/files.go, Data Model: Correção de Vulnerabilidades Críticas de Segurança, Implementation Plan: Correção de Vulnerabilidades Críticas de Segurança, Feature Specification: Correção de Vulnerabilidades Críticas de Segurança, Tasks: Correção de Vulnerabilidades Críticas de Segurança

### Community 14 - "Community 14"
Cohesion: 0.53
Nodes (5): ConvertTo-CleanBranchName(), Get-BranchName(), Get-HighestNumberFromBranches(), Get-HighestNumberFromSpecs(), Get-NextBranchNumber()

### Community 15 - "Community 15"
Cohesion: 0.40
Nodes (5): Database Layer, Notes Handlers, Backend Entry Point, Docker Compose Configuration, Relatório de Correções

### Community 17 - "Community 17"
Cohesion: 0.50
Nodes (4): API Contract: Web Notes App, Data Model: Web Notes App, Feature Spec: Web Notes App, Feature Spec: Trash and Restore

### Community 18 - "Community 18"
Cohesion: 1.00
Nodes (3): Time, AttachmentListItem, AttachmentsListResponse

### Community 19 - "Community 19"
Cohesion: 0.67
Nodes (4): Attachment, Time, Note, NotesResponse

### Community 20 - "Community 20"
Cohesion: 0.67
Nodes (3): Tx, DeleteHashtag(), RenameHashtag()

### Community 22 - "Community 22"
Cohesion: 0.48
Nodes (6): showArchiveView(), archiveCardHTML(), bindArchiveCardEvents(), esc(), formatArchivedAt(), loadArchive()

### Community 41 - "Community 41"
Cohesion: 0.18
Nodes (10): Active Technologies, Add commands for Go 1.23 (backend), ES2022 Vanilla JS (frontend), Code Style, Commands, graphify, Inspiration, notas Development Guidelines, Project Rules (+2 more)

## Knowledge Gaps
- **77 isolated node(s):** `Project Rules`, `Inspiration`, `Active Technologies`, `Project Structure`, `Commands` (+72 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `main()` connect `Community 3` to `Community 8`, `Community 1`, `Community 10`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `jsonError()` connect `Community 1` to `Community 3`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `PINLogin()` connect `Community 3` to `Community 10`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Are the 22 inferred relationships involving `jsonError()` (e.g. with `.Delete()` and `.ListAll()`) actually correct?**
  _`jsonError()` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 17 inferred relationships involving `main()` (e.g. with `Open()` and `NewAttachmentHandler()`) actually correct?**
  _`main()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **Are the 16 inferred relationships involving `jsonResponse()` (e.g. with `.ListAll()` and `.Upload()`) actually correct?**
  _`jsonResponse()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Project Rules`, `Inspiration`, `Active Technologies` to the rest of the system?**
  _77 weakly-connected nodes found - possible documentation gaps or missing edges._