# Relatório de Correções — Notas App

**Data:** 2026-03-31

---

## Problemas identificados

### 1. Dados não salvavam via Cloudflare Tunnel

O Service Worker (`sw.js`) usava estratégias de cache incorretas para chamadas de API:

- `/api/notes*` usava **stale-while-revalidate** — retornava dados desatualizados do cache antes de buscar no servidor
- `/api/hashtags`, `/api/attachments` e `/api/auth/*` caíam na regra genérica **cache-first** — uma vez em cache, o servidor nunca mais era consultado

**Resultado:** Ao acessar via `https://notas.dalc.in`, o navegador servia respostas antigas do cache. As notas eram salvas no banco, mas o GET seguinte retornava dados antigos. Localmente parecia funcionar porque o cache era preenchido com dados frescos.

### 2. Login via PIN não era persistente

Três causas combinadas:

| Causa | Efeito |
|-------|--------|
| `sessionSecret` era gerado aleatoriamente a cada boot do servidor | Cada restart do Docker invalidava todas as sessões |
| Cookie sem `MaxAge` | Cookie morria ao fechar o navegador (session cookie) |
| `SameSite: Strict` | Cookie não era enviado ao navegar de links externos, bookmarks ou PWA |
| Sem flag `Secure` | Navegadores modernos podem rejeitar cookies em conexões HTTPS sem esta flag |

### 3. PWA incompleto para instalação mobile

- `manifest.json` sem campo `id` (necessário para identidade estável da PWA no Chrome)
- `manifest.json` sem campo `scope`
- Faltavam meta tags para iOS (`apple-mobile-web-app-capable`, etc.)

---

## Correções aplicadas

### Service Worker (`frontend/sw.js`)

- Todas as rotas `/api/*` agora usam estratégia **network-first** (consulta o servidor primeiro; cache só é usado offline)
- Assets estáticos continuam com **cache-first** (não mudam entre deploys)
- Cache version incrementado para `v5` (força limpeza do cache antigo em todos os clientes)

### Autenticação (`internal/handlers/auth.go` + `main.go`)

- Nova variável de ambiente `SESSION_SECRET` — define um segredo fixo para que sessões sobrevivam a restarts
- Se não definida, gera segredo efêmero (comportamento anterior) com log de aviso
- Cookie `MaxAge` definido para **30 dias**
- `SameSite` alterado de `Strict` para `Lax`
- Nova variável `BASE_URL` — quando começa com `https://`, ativa flag `Secure` no cookie

### PWA (`frontend/manifest.json` + `frontend/index.html`)

- Adicionados campos `id` e `scope` ao manifest
- Adicionadas meta tags no HTML:
  - `apple-mobile-web-app-capable`
  - `apple-mobile-web-app-status-bar-style`
  - `apple-mobile-web-app-title`
  - `mobile-web-app-capable`

### Docker (`docker-compose.yml`)

- Adicionados exemplos comentados para `SESSION_SECRET` e `BASE_URL`

---

## O que você precisa fazer

### 1. Gerar um SESSION_SECRET fixo

Execute no terminal:

```bash
openssl rand -hex 32
```

Copie o valor gerado (ex: `a1b2c3d4e5f6...`).

### 2. Configurar variáveis de ambiente na produção (AWS)

No seu `docker-compose.yml` de produção ou na configuração do container, defina:

```yaml
environment:
  DB_PATH: /data/db/notes.db
  FILES_PATH: /data/files
  APP_PIN: "seu-pin-aqui"
  SESSION_SECRET: "valor-gerado-no-passo-1"
  BASE_URL: "https://notas.dalc.in"
```

### 3. Rebuild e deploy

```bash
docker compose build
docker compose up -d
```

### 4. Limpar cache no navegador (uma única vez)

Após o deploy, os usuários que já acessaram o app terão o Service Worker antigo (v4) ativo. O novo SW (v5) será instalado automaticamente, mas para garantir uma transição limpa:

- **Chrome desktop:** F12 → Application → Storage → "Clear site data"
- **Chrome mobile:** Configurações → Privacidade → Limpar dados de navegação → selecione o site
- **Alternativa:** O SW novo ativa automaticamente com `skipWaiting()` + `clients.claim()`, mas pode levar até 2 reloads

### 5. Instalar como PWA no celular

Após o deploy com as correções:

- **Android (Chrome):** Acesse `https://notas.dalc.in` → menu ⋮ → "Instalar app" ou "Adicionar à tela inicial"
- **iOS (Safari):** Acesse o site → botão compartilhar (⬆) → "Adicionar à Tela de Início"

### 6. Verificar que o Cloudflare Tunnel não adiciona cache extra

No dashboard do Cloudflare, verifique:

- **Caching → Configuration:** Certifique-se de que não há Cache Rules customizadas cacheando `/api/*`
- **Rules → Page Rules:** Verifique que não há regra de cache para `notas.dalc.in/api/*`
- Se houver, adicione uma regra: `notas.dalc.in/api/*` → Cache Level: Bypass
