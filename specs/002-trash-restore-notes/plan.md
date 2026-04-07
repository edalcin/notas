# Implementation Plan: Trash and Restore Notes

**Branch**: `002-trash-restore-notes` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-trash-restore-notes/spec.md`

## Summary

Implementar um sistema de Lixeira para notas: mover notas para a lixeira (soft delete) em vez de excluir permanentemente, com modal de confirmação customizado; visualizar, restaurar notas da lixeira; esvaziar a lixeira com confirmação; e remover o botão "Excluir" da interface de edição. A abordagem usa um campo `deleted_at` na tabela `notes` e quatro novos endpoints REST.

## Technical Context

**Language/Version**: Go 1.23 (backend), ES2022 Vanilla JS (frontend)
**Primary Dependencies**: chi (HTTP router), modernc.org/sqlite (pure-Go SQLite), Marked.js (Markdown renderer)
**Storage**: SQLite — campo `deleted_at DATETIME` adicionado via migration `006_trash.sql`
**Testing**: Testes manuais via browser; sem suite automatizada existente
**Target Platform**: Web application (single binary Go + embedded frontend)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: Não há metas específicas — app de uso pessoal
**Constraints**: Single-user, sem autenticação por papel; SQLite single-connection (MaxOpenConns=1)
**Scale/Scope**: App pessoal — poucos usuários, notas da ordem de centenas

## Constitution Check

*GATE: Sem constitution.md encontrado — usando princípios de qualidade gerais do projeto.*

- [x] Sem novas dependências externas
- [x] Migration incremental (não destrutiva)
- [x] Padrão de view switching existente reutilizado (sem nova arquitetura)
- [x] Endpoints REST seguem convenção existente (`/api/notes/{id}/pin` → `/api/notes/{id}/trash`)
- [x] JS modular seguindo o padrão existente de módulos ES2022

## Project Structure

### Documentation (this feature)

```text
specs/002-trash-restore-notes/
├── plan.md              # Este arquivo
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
internal/
├── db/
│   ├── migrations/
│   │   └── 006_trash.sql          # NOVO — adiciona deleted_at
│   ├── notes.go                   # MODIFICAR — soft delete, restore, list trash, empty trash
│   └── db.go                      # sem alteração
├── handlers/
│   └── notes.go                   # MODIFICAR — handlers Trash, Restore, EmptyTrash; remover Delete handler ou adaptar
├── models/
│   └── note.go                    # MODIFICAR — adicionar campo DeletedAt
└── services/
    └── notes.go                   # sem alteração

frontend/
├── index.html                     # MODIFICAR — nav Lixeira, section trash-view, modal confirm
└── assets/
    └── js/
        ├── app.js                 # MODIFICAR — wiring trash nav, showTrashView()
        ├── notes.js               # MODIFICAR — ícone lixeira no card, trashNote() com modal
        ├── editor.js              # MODIFICAR — remover btn-delete-note
        └── trash.js               # NOVO — módulo da view Lixeira
```

**Structure Decision**: Web application (Option 2 do template). Backend em `internal/`, frontend em `frontend/`. Sem nova camada de abstração — alterações cirúrgicas nos arquivos existentes mais um módulo novo (`trash.js`).

## Complexity Tracking

> Nenhuma violação de complexidade identificada.
