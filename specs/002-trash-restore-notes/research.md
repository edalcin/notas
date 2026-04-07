# Research: Trash and Restore Notes

**Feature**: `002-trash-restore-notes`
**Date**: 2026-04-07

## Decisão 1: Soft Delete vs Hard Delete com tabela separada

- **Decision**: Soft delete via coluna `deleted_at DATETIME NULL` na tabela `notes`
- **Rationale**: Mantém integridade referencial com `attachments` e `note_hashtags` (CASCADE DELETE não dispara), preserva dados até "Esvaziar Lixeira", migration trivial (`ALTER TABLE ... ADD COLUMN`), sem necessidade de tabela extra ou JOIN complexo
- **Alternatives considered**:
  - *Tabela `trash` separada*: mais complexo, exigiria migrar linhas entre tabelas; rejeitado por ser desnecessário dado o escopo
  - *Hard delete imediato*: eliminado — objetivo da feature é exatamente permitir recuperação

## Decisão 2: Filtro de notas deletadas nas queries existentes

- **Decision**: Adicionar `WHERE n.deleted_at IS NULL` a **todas** as queries ativas — `ListNotes`, `FilterByHashtag`, `SearchNotes`, `GetNote` (retornar nil para notas deletadas)
- **Rationale**: Notas na lixeira não devem aparecer no feed principal, em buscas, nem em filtros por hashtag. O campo `deleted_at IS NULL` é indexado para performance.
- **Critical point**: `SearchNotes` usa `notes_fts` (external content table) com triggers — a FTS não filtra `deleted_at`. O join de volta à tabela `notes` já existente na query atual (`n.id IN (SELECT rowid FROM notes_fts ...)`) permite adicionar `AND n.deleted_at IS NULL` sem alterar o FTS.

## Decisão 3: Endpoints REST para operações de lixeira

- **Decision**: Quatro novos endpoints seguindo o padrão existente do projeto:
  - `PUT /api/notes/{id}/trash` — move para lixeira (sets `deleted_at`)
  - `PUT /api/notes/{id}/restore` — restaura da lixeira (clears `deleted_at`)
  - `GET /api/trash` — lista notas na lixeira, ordenado por `deleted_at DESC`
  - `DELETE /api/trash` — esvazia lixeira permanentemente
- **Rationale**: Padrão RESTful consistente com `/api/notes/{id}/pin` existente. `DELETE /api/trash` como recurso-coleção é semântico para "destruir tudo na lixeira".
- **Alternatives considered**:
  - `DELETE /api/notes/{id}` reutilizado com query param `?permanent=true`: rejeitado — semântica confusa e mistura dois fluxos distintos
  - PATCH para operações de estado: rejeitado — PUT já é usado no projeto para toggle de pin

## Decisão 4: Exclusão permanente no "Esvaziar Lixeira" — tratamento de arquivos

- **Decision**: Ao esvaziar a lixeira, excluir fisicamente os arquivos de anexo do disco (mesmo comportamento do `DeleteNote` existente), depois deletar as linhas de `notes` (CASCADE cuida de `attachments` e `note_hashtags`)
- **Rationale**: O handler `Delete` existente já faz isso — busca attachments, deleta o note, depois remove os arquivos. `EmptyTrash` replica esse padrão em batch.
- **Critical point**: Buscar todos os attachments das notas deletadas ANTES de deletar as linhas, porque o CASCADE SQLite remove as linhas de `attachments` junto com a `note`.

## Decisão 5: Modal de confirmação customizado (reusável)

- **Decision**: Criar uma função JS `showConfirmModal(message, onConfirm)` reutilizável, renderizada no `index.html` como um elemento `<div id="modal-confirm">` similar ao `modal-hashtags` existente
- **Rationale**: Consistência com o modal de hashtags existente. Evita `window.confirm()` nativo (que bloquearia o event loop e tem aparência inconsistente). Reusável para tanto "deletar nota" quanto "esvaziar lixeira".
- **Alternatives considered**: Inline confirmation (botões aparecem no card): rejeitado — mais complexo de implementar e de usar em mobile

## Decisão 6: Estado de ordenação na Lixeira

- **Decision**: Listar notas na lixeira ordenadas por `deleted_at DESC` (mais recentemente deletadas primeiro), com paginação (`limit`/`offset`) via query params
- **Rationale**: Clarificado na fase de spec (Q4). O usuário mais provavelmente quer recuperar a nota que acabou de deletar por engano — tê-la no topo é o comportamento mais útil.

## Decisão 7: Restauração preserva estado de fixação

- **Decision**: `RestoreNote` apenas limpa `deleted_at` — o campo `pinned` é preservado como estava antes da exclusão
- **Rationale**: Documentado nas Assumptions da spec. Implementação trivial: não há necessidade de persistir o `pinned` separadamente porque ele nunca é alterado durante o ciclo trash/restore.
