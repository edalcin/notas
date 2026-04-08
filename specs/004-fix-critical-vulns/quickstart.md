# Quickstart: Implementação das Correções de Segurança Críticas

**Branch**: `004-fix-critical-vulns`

## Ordem de implementação

Implementar na seguinte ordem para minimizar risco de conflitos:

1. **C-03 primeiro** (`files.go`) — backend-only, sem dependências de frontend, mais fácil de testar isoladamente
2. **C-01** (`public.go` + JS files) — frontend changes com novo arquivo `public.js`
3. **C-02 Fase 1** (`main.go`) — adicionar headers em modo report-only, validar no browser
4. **C-02 Fase 2** (`main.go`) — promover CSP de report-only para enforce (commit separado)

## Rodar localmente

```bash
# Compilar e rodar
DB_PATH=./data/notes.db FILES_PATH=./data/files go run .

# Ou via docker-compose
docker-compose up --build
```

## Testar C-01 (XSS)

1. Criar nota com conteúdo: `<img src=x onerror=alert(1)>`
2. Salvar e visualizar na lista → nenhum alert deve aparecer
3. Gerar link de compartilhamento e abrir em aba anônima → nenhum alert deve aparecer

## Testar C-02 (Headers)

```bash
curl -I http://localhost:8080/
# Deve incluir X-Content-Type-Options, X-Frame-Options, Referrer-Policy,
# Permissions-Policy e Content-Security-Policy-Report-Only
```

## Testar C-03 (Upload)

```bash
# Upload de SVG deve falhar
curl -X POST http://localhost:8080/api/notes/1/attachments \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test.svg;type=image/svg+xml" \
  -b "session=..." # com cookie de sessão válido

# Upload de JPEG deve funcionar
curl -X POST http://localhost:8080/api/notes/1/attachments \
  -H "Content-Type: multipart/form-data" \
  -F "file=@photo.jpg" \
  -b "session=..."
```

## Notas importantes

- `public.js` é um novo arquivo que precisa ser adicionado ao `frontend/assets/js/`; o Service Worker **não** precisa de atualização (ele cacheia assets na primeira visita)
- Ao adicionar o middleware de security headers, testar com `docker-compose up --build` para garantir que nenhuma variável de ambiente interfere
- Para Fase 2 da CSP: só promover quando o browser console mostrar zero violações CSP durante uso normal completo da app
