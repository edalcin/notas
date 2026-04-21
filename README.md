# Notas

Sistema pessoal de anotações baseado na web, com editor Markdown, organização por hashtags, PWA e integração com [PKD](#integração-com-pkd). Roda como container Docker (~20 MB) e foi projetado para instalação em servidores UNRAID.

## Funcionalidades

- **Editor Markdown** — escreva notas com formatação completa (negrito, listas, títulos, código); salvamento automático após pausa na digitação
- **Hashtags automáticas** — escreva `#tag` no texto e a nota é classificada automaticamente; filtre notas clicando em uma hashtag na barra lateral
- **Busca por texto** — encontre notas por qualquer palavra ou substring no conteúdo
- **Fixar notas** — marque notas importantes para mantê-las sempre no topo da lista
- **Anexos** — associe imagens (exibidas inline) e documentos (PDF, Word) às notas; galeria global de anexos na sidebar
- **Lixeira** — notas excluídas vão para a lixeira e podem ser restauradas; esvaziamento em lote
- **Links de compartilhamento** — gere um link público somente leitura para qualquer nota; revogue a qualquer momento
- **Gerenciador de hashtags** — renomeie ou exclua hashtags em lote, atualizando todas as notas automaticamente; cores personalizáveis por tag
- **Proteção por PIN** — acesso protegido por PIN numérico (opcional)
- **Tema claro/escuro** — alternância com persistência da preferência
- **PWA** — instalável como app nativo no celular (iOS e Android); acesso offline para leitura das notas existentes
- **Web Share Target (Android)** — compartilhe texto ou links de qualquer app diretamente para o Notas; a nota é criada automaticamente com a tag `#android` e o título formatado como cabeçalho
- **Mobile-first** — interface totalmente responsiva a partir de 320 px de largura
- **Integração com PKD** — exporte qualquer nota para o [PKD](https://github.com/edalcin/pkd) com um clique; a nota é automaticamente movida para a lixeira após o envio

## Stack

| Componente | Tecnologia |
|-----------|-----------|
| Backend | Go 1.23 + [chi](https://github.com/go-chi/chi) |
| Banco de dados | SQLite ([modernc.org/sqlite](https://gitlab.com/cznic/sqlite) — pure Go, sem CGO) |
| Frontend | Vanilla JS (ES2022) + [Marked.js](https://marked.js.org/) + [DOMPurify](https://github.com/cure53/DOMPurify) |
| Container | Docker multi-stage (~20 MB) |
| CI/CD | GitHub Actions → `ghcr.io/edalcin/notes` |

## Execução rápida

```bash
docker run -d \
  --name notas \
  -p 8080:8080 \
  -v /caminho/para/dados/db:/data/db \
  -v /caminho/para/dados/files:/data/files \
  -e DB_PATH=/data/db/notes.db \
  -e FILES_PATH=/data/files \
  --restart unless-stopped \
  ghcr.io/edalcin/notes:latest
```

Acesse em `http://localhost:8080`.

## Variáveis de ambiente

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `DB_PATH` | ✓ | — | Caminho para o arquivo SQLite (ex: `/data/db/notes.db`) |
| `FILES_PATH` | ✓ | — | Diretório para arquivos anexados (ex: `/data/files`) |
| `PORT` | — | `8080` | Porta HTTP |
| `MAX_UPLOAD_BYTES` | — | `52428800` | Tamanho máximo de upload em bytes (padrão: 50 MB) |
| `APP_PIN` | — | *(sem PIN)* | PIN numérico para proteger o acesso |
| `SESSION_SECRET` | — | *(gerado na inicialização)* | Chave HMAC para assinar cookies de sessão; defina para que sessões sobrevivam a reinicializações |
| `BASE_URL` | — | *(host da request)* | URL pública base (ex: `https://notas.exemplo.com/`); necessária para cookies seguros com HTTPS |
| `PKD_URL` | — | *(desativado)* | URL base da instância PKD para integração (ex: `http://pkd:8080`). Deixe vazio para desativar o botão de exportação |
| `PKD_TOKEN` | — | *(desativado)* | Token secreto compartilhado com `PKD_IMPORT_TOKEN` no container PKD |

## Integração com PKD

O Notas pode exportar notas diretamente para o [PKD — Personal Knowledge Database](https://github.com/edalcin/pkd).

**Como funciona:**

1. Configure `PKD_URL` e `PKD_TOKEN` no container Notas
2. Configure `PKD_IMPORT_TOKEN` (mesmo valor de `PKD_TOKEN`) no container PKD
3. Um botão 📤 aparece em cada nota
4. Ao clicar: a nota é convertida de Markdown para HTML, enviada ao PKD como novo documento com todas as hashtags da nota **mais a tag `notas`** como identificador de origem, e automaticamente movida para a lixeira do Notas

**Recomendação de configuração (docker compose, mesma rede):**

```yaml
services:
  notas:
    environment:
      PKD_URL: 'http://pkd:8080'   # nome do serviço PKD na rede Docker
      PKD_TOKEN: ${PKD_TOKEN}
  pkd:
    environment:
      PKD_IMPORT_TOKEN: ${PKD_IMPORT_TOKEN}
```

```bash
# .env
PKD_TOKEN=seu-token-secreto
PKD_IMPORT_TOKEN=seu-token-secreto   # mesmo valor
```

## Instalação no UNRAID

1. Vá em **Docker** → **Add Container**
2. Preencha os campos:
   - **Repository**: `ghcr.io/edalcin/notes:latest`
   - **Port**: `8080:8080`
3. Adicione dois **Volume Paths**:
   - `/data/db` → `/mnt/user/appdata/notas/db` (Read/Write)
   - `/data/files` → `/mnt/user/appdata/notas/files` (Read/Write)
4. Adicione as variáveis de ambiente obrigatórias:
   - `DB_PATH` = `/data/db/notes.db`
   - `FILES_PATH` = `/data/files`
5. Clique em **Apply**

Os dados ficam em `/mnt/user/appdata/notas/` — faça backup desse diretório para preservar suas notas.

## Desenvolvimento local

```bash
git clone https://github.com/edalcin/notas.git
cd notas

export DB_PATH=/tmp/notes.db
export FILES_PATH=/tmp/notes-files

go run .
# → http://localhost:8080
```

**Pré-requisitos**: Go 1.23+

## Build Docker local

```bash
docker build -t notas .
docker run -p 8080:8080 \
  -e DB_PATH=/data/notes.db \
  -e FILES_PATH=/data/files \
  -v $(pwd)/data:/data \
  notas
```

## CI/CD

Todo push para o branch `main` dispara o workflow do GitHub Actions que:
1. Executa `go test ./...`
2. Builda a imagem Docker (linux/amd64)
3. Publica em `ghcr.io/edalcin/notes:latest` e `ghcr.io/edalcin/notes:<sha>`

Nenhuma credencial é armazenada no repositório — o workflow usa o `GITHUB_TOKEN` automático do GitHub Actions.

## Changelog

### 2026-04-21

- **Integração com PKD** — botão 📤 em cada nota exporta o conteúdo (Markdown → HTML) para o PKD como novo documento, aplicando as mesmas hashtags da nota mais a tag `notas`; a nota é movida para a lixeira do Notas após o envio com sucesso
- **Web Share Target (Android)** — compartilhe de qualquer app para o Notas; título formatado como cabeçalho e tag `#android` aplicada automaticamente
- **Links de compartilhamento** — links públicos somente leitura por nota, revogáveis
- **Lixeira** — notas excluídas ficam recuperáveis; esvaziamento em lote
- **Segurança** — CSP promovida para modo enforce; correção de vulnerabilidades XSS (C-01, C-02, C-03); DOMPurify adicionado para sanitização de HTML renderizado

## Licença

MIT
