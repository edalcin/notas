# Notas

Sistema pessoal de anotações baseado na web, com editor Markdown, organização por hashtags e suporte a PWA. Roda como container Docker (~20MB) e foi projetado para instalação em servidores UNRAID.

## Funcionalidades

- **Editor Markdown** — escreva notas com formatação completa (negrito, listas, títulos, código); salvamento automático após pausa na digitação
- **Hashtags automáticas** — escreva `#tag` no texto e a nota é classificada automaticamente; filtre notas clicando em uma hashtag na barra lateral
- **Busca por texto** — encontre notas por qualquer palavra ou substring no conteúdo
- **Fixar notas** — marque notas importantes para mantê-las sempre no topo da lista
- **Anexos** — associe imagens (exibidas inline) e documentos (PDF, Word) às notas
- **Gerenciador de hashtags** — renomeie ou exclua hashtags em lote, atualizando todas as notas automaticamente
- **Tema claro/escuro** — alternância com persistência da preferência
- **PWA** — instalável como app nativo no celular (iOS e Android); acesso offline para leitura das notas existentes
- **Mobile-first** — interface totalmente responsiva a partir de 320px de largura

## Stack

| Componente | Tecnologia |
|-----------|-----------|
| Backend | Go 1.23 + [chi](https://github.com/go-chi/chi) |
| Banco de dados | SQLite ([modernc.org/sqlite](https://gitlab.com/cznic/sqlite) — pure Go, sem CGO) |
| Frontend | Vanilla JS (ES2022) + [EasyMDE](https://github.com/Ionaru/easy-markdown-editor) + [Marked.js](https://marked.js.org/) |
| Container | Docker multi-stage → Alpine 3.19 (~20MB) |
| CI/CD | GitHub Actions → `ghcr.io/edalcin/notes` |

## Execução rápida

```bash
docker run -d \
  --name notas \
  -p 8080:8080 \
  -v /caminho/para/dados:/data \
  -e DB_PATH=/data/notes.db \
  -e FILES_PATH=/data/files \
  --restart unless-stopped \
  ghcr.io/edalcin/notes:latest
```

Acesse em `http://localhost:8080`.

## Variáveis de ambiente

| Variável | Obrigatória | Padrão | Descrição |
|----------|-------------|--------|-----------|
| `DB_PATH` | ✓ | — | Caminho para o arquivo SQLite (ex: `/data/notes.db`) |
| `FILES_PATH` | ✓ | — | Diretório para arquivos anexados (ex: `/data/files`) |
| `PORT` | — | `8080` | Porta HTTP |
| `MAX_UPLOAD_BYTES` | — | `52428800` | Tamanho máximo de upload em bytes (padrão: 50MB) |

## Instalação no UNRAID

1. Vá em **Docker** → **Add Container**
2. Preencha os campos:
   - **Repository**: `ghcr.io/edalcin/notes:latest`
   - **Port**: `8080:8080`
3. Adicione dois **Volume Paths**:
   - `/data/db` → `/mnt/user/appdata/notas/db` (Read/Write)
   - `/data/files` → `/mnt/user/appdata/notas/files` (Read/Write)
4. Adicione as variáveis de ambiente:
   - `DB_PATH` = `/data/db/notes.db`
   - `FILES_PATH` = `/data/files`
5. Clique em **Apply**

Os dados ficam em `/mnt/user/appdata/notas/` — faça backup desse diretório para preservar suas notas.

Para instruções detalhadas, veja [`specs/001-web-notes-app/quickstart.md`](specs/001-web-notes-app/quickstart.md).

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
2. Builda imagem multi-arch (amd64 + arm64)
3. Publica em `ghcr.io/edalcin/notes:latest` e `ghcr.io/edalcin/notes:<sha>`

Nenhuma credencial é armazenada no repositório — o workflow usa o `GITHUB_TOKEN` automático do GitHub Actions.

## Licença

MIT
