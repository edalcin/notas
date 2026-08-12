# ADR-0001: Anexos no Envio de Notas para o PKD

**Status:** Aceito
**Data:** 2026-08-12

## Contexto

O botão 📤 ("Enviar para PKD") só enviava `{title, content, tags}` — anexos da nota (imagens, arquivos) eram ignorados e ficavam presos no Notas mesmo depois da nota ser movida para a lixeira. Isso exige uma mudança de contrato entre dois serviços: Notas (este repositório) e [PKD](https://github.com/edalcin/pkd), que só se comunicam via `POST {PKD_URL}/api/import` autenticado por `PKD_TOKEN`/`PKD_IMPORT_TOKEN`.

## Decisões

### D1 — Anexos viajam em base64 dentro do mesmo JSON de `/api/import`, não numa chamada separada

`ExportToPKD` (`internal/handlers/notes.go`) passa a carregar `note.Attachments`, ler cada arquivo de `FILES_PATH` e enviar `attachments: [{filename, mime_type, data_base64}]` junto com `title`/`content`/`tags` na mesma requisição.

**Alternativa descartada:** criar o documento primeiro e depois fazer upload multipart em `/api/documents/{id}/attachments` do PKD — exigiria que o PKD aceitasse o token de import numa rota hoje restrita a sessão, e um terceiro passo (`PUT`) para referenciar as imagens no corpo. Ver ADR-003 do repositório `pkd` para a decisão espelhada do outro lado.

### D2 — Exportação é tudo-ou-nada

Se o PKD responder qualquer status diferente de `201` (documento criado com todos os anexos), a nota **não** é movida para a lixeira e o erro é mostrado no botão 📤, igual ao tratamento de erro já existente. Perder o arquivo original silenciosamente (nota já na lixeira, anexo não transferido) seria pior que forçar uma nova tentativa.

### D3 — Sem verificação prévia de tamanho no lado Notas

O Notas não conhece `PKD_MAX_ATTACHMENT_MB`/`PKD_MAX_IMAGE_MB` do PKD e não tenta replicá-los. Um `413` do PKD é repassado como mensagem de erro. Evita duplicar configuração entre os dois containers Docker (prioridade de simplicidade do stack).

## Consequências

- `internal/handlers/notes.go`: `ExportToPKD` passa a chamar `h.db.GetAttachmentsByNote(id)` e a ler arquivos de `getFilesPath(r)`.
- Nenhuma env var nova no Notas para esta funcionalidade.
- Depende de ADR-003 do repositório `pkd` (`/api/import` aceitando `attachments`).
