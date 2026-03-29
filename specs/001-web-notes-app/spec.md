# Feature Specification: Sistema de Anotações Web com Markdown

**Feature Branch**: `001-web-notes-app`
**Created**: 2026-03-29
**Status**: Draft
**Input**: User description: "Sistema web de anotações com editor Markdown, hashtags, fixação de notas, anexos de arquivos, suporte PWA, interface clara/escura, SQLite externo ao Docker, deploy via GHCR no UNRAID"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Criar e Visualizar Notas com Markdown (Priority: P1)

O usuário acessa a aplicação e cria uma nova nota digitando texto em formato Markdown. A nota é salva automaticamente e exibida na lista principal em ordem cronológica (mais recente no topo). O usuário pode clicar na nota para ler o conteúdo renderizado em Markdown.

**Why this priority**: É o núcleo da aplicação. Sem criar e visualizar notas, nenhuma outra funcionalidade tem valor.

**Independent Test**: Pode ser testado criando uma nota com formatação Markdown (negrito, listas, títulos) e verificando que a lista exibe a nota e o conteúdo é renderizado corretamente.

**Acceptance Scenarios**:

1. **Given** o usuário está na tela principal, **When** clica em "Nova Nota" e digita texto com Markdown, **Then** a nota é salva automaticamente após pausa na digitação e aparece na lista principal com conteúdo renderizado corretamente
2. **Given** múltiplas notas existem, **When** o usuário visualiza a lista, **Then** as notas aparecem em ordem cronológica decrescente (mais recente primeiro)
3. **Given** uma nota existe, **When** o usuário clica para editar, **Then** o editor abre com o conteúdo original em Markdown editável
4. **Given** uma nota existe, **When** o usuário confirma a exclusão, **Then** a nota é removida permanentemente da lista

---

### User Story 2 - Classificar e Filtrar Notas por Hashtag (Priority: P2)

O usuário inclui hashtags no texto da nota (ex: `#trabalho`, `#pessoal`). Um painel lateral ou seção exibe todas as hashtags existentes. O usuário clica em uma hashtag para filtrar e ver apenas as notas que a contêm. Também pode digitar qualquer texto na busca para encontrar notas por substring.

**Why this priority**: Sem organização e busca, a aplicação se torna inútil conforme o número de notas cresce.

**Independent Test**: Pode ser testado criando notas com diferentes hashtags e verificando que o filtro exibe apenas as notas corretas.

**Acceptance Scenarios**:

1. **Given** uma nota contém `#projeto`, **When** o usuário clica em `#projeto` na lista de hashtags, **Then** apenas notas com `#projeto` são exibidas
2. **Given** múltiplas hashtags existem, **When** o usuário clica em uma hashtag diferente, **Then** a lista é atualizada para mostrar notas com a nova hashtag
3. **Given** notas com diferentes conteúdos, **When** o usuário digita uma substring no campo de busca, **Then** apenas notas contendo aquela substring são exibidas
4. **Given** filtros ativos, **When** o usuário limpa o filtro, **Then** todas as notas são exibidas novamente
5. **Given** uma hashtag não tem mais notas associadas, **When** o usuário visualiza a lista de hashtags, **Then** a hashtag não aparece mais na lista

---

### User Story 3 - Fixar Notas no Topo da Lista (Priority: P3)

O usuário pode marcar uma nota como "fixada" (pinned). As notas fixadas aparecem sempre no topo da lista, independente da data de criação, seguidas pelas demais em ordem cronológica.

**Why this priority**: Permite acesso rápido a notas importantes sem necessidade de busca.

**Independent Test**: Pode ser testado fixando uma nota antiga e verificando que ela aparece acima de notas mais recentes não fixadas.

**Acceptance Scenarios**:

1. **Given** uma nota existe, **When** o usuário ativa o "pin" na nota, **Then** a nota move para o topo da lista com indicador visual de "fixada"
2. **Given** múltiplas notas fixadas existem, **When** o usuário visualiza a lista, **Then** as notas fixadas aparecem no topo em ordem cronológica entre si, seguidas pelas não fixadas
3. **Given** uma nota está fixada, **When** o usuário desativa o "pin", **Then** a nota retorna à sua posição cronológica normal
4. **Given** filtros por hashtag ativos, **When** notas fixadas correspondem ao filtro, **Then** notas fixadas aparecem no topo da lista filtrada

---

### User Story 4 - Associar Arquivos e Imagens às Notas (Priority: P4)

O usuário pode anexar imagens e documentos (PDF, etc.) a uma nota. Os arquivos são armazenados em um diretório externo ao container. Imagens podem ser visualizadas inline na nota. Outros documentos aparecem como links para download.

**Why this priority**: Enriquece o conteúdo das notas, mas a aplicação é funcional sem esta capacidade.

**Independent Test**: Pode ser testado fazendo upload de uma imagem e um PDF a uma nota e verificando que a imagem aparece inline e o PDF aparece como link.

**Acceptance Scenarios**:

1. **Given** uma nota está sendo editada, **When** o usuário faz upload de uma imagem, **Then** a imagem é salva no diretório de arquivos externo e exibida inline na nota renderizada
2. **Given** uma nota está sendo editada, **When** o usuário faz upload de um documento (PDF, DOCX), **Then** o arquivo é salvo no diretório externo e aparece como link clicável na nota
3. **Given** uma nota com anexos é excluída, **When** a exclusão é confirmada, **Then** os arquivos associados também são removidos do diretório externo
4. **Given** o diretório de arquivos está indisponível, **When** o usuário tenta fazer upload, **Then** uma mensagem de erro clara é exibida

---

### User Story 5 - Gerenciar Hashtags (Priority: P5)

O usuário pode visualizar todas as hashtags existentes, renomear uma hashtag (atualizando todas as notas que a contêm) e excluir uma hashtag (removendo-a de todas as notas).

**Why this priority**: Manutenção da taxonomia de organização; importante mas não bloqueia uso básico.

**Independent Test**: Pode ser testado renomeando uma hashtag e verificando que todas as notas foram atualizadas.

**Acceptance Scenarios**:

1. **Given** o usuário acessa o gerenciamento de hashtags, **When** visualiza a tela, **Then** todas as hashtags são listadas com a contagem de notas associadas
2. **Given** uma hashtag existe, **When** o usuário a renomeia, **Then** todas as notas que continham a hashtag antiga passam a conter a nova hashtag
3. **Given** uma hashtag existe, **When** o usuário a exclui, **Then** a hashtag é removida de todas as notas e desaparece da lista

---

### User Story 6 - Interface Clara/Escura e PWA (Priority: P6)

O usuário pode alternar entre tema claro e escuro. A aplicação pode ser instalada como PWA no celular ou desktop, funcionando como um aplicativo nativo.

**Why this priority**: Melhora conforto visual e experiência mobile, mas são funcionalidades de polish.

**Independent Test**: Pode ser testado alternando o tema e verificando que toda a interface muda corretamente, e instalando como PWA no celular.

**Acceptance Scenarios**:

1. **Given** o usuário está na aplicação, **When** alterna para modo escuro, **Then** toda a interface aplica o tema escuro sem recarregar a página
2. **Given** o tema foi alterado, **When** o usuário fecha e reabre a aplicação, **Then** o tema selecionado é mantido
3. **Given** o usuário acessa via celular, **When** adiciona à tela inicial via PWA, **Then** a aplicação é instalada e funciona como app nativo sem barra de browser
4. **Given** o usuário está no celular, **When** usa qualquer funcionalidade, **Then** a interface é totalmente responsiva e usável com toque

---

### Edge Cases

- O que acontece quando o banco de dados SQLite não está acessível (PATH incorreto ou sem permissão)?
- Como o sistema lida com notas muito grandes (texto com megabytes de conteúdo)?
- O que acontece quando o diretório de arquivos está cheio ou sem permissão de escrita?
- Como o sistema lida com hashtags com caracteres especiais ou acentos?
- Quando duas sessões editam a mesma nota simultaneamente, a última escrita salva vence (last-write-wins); não há aviso de conflito.
- Quando offline após instalação PWA, o usuário pode visualizar notas existentes (somente leitura); criar e editar notas requer conexão ativa.
- O que acontece quando se tenta fazer upload de um arquivo muito grande?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir criar notas com texto em formato Markdown, com salvamento automático por debounce (após pausa na digitação) e botão de salvar explícito disponível
- **FR-002**: O sistema DEVE renderizar o conteúdo Markdown das notas na visualização
- **FR-003**: O sistema DEVE exibir notas em lista cronológica decrescente (mais recente primeiro)
- **FR-004**: O sistema DEVE permitir editar e excluir notas existentes
- **FR-005**: O sistema DEVE persistir todas as notas em banco de dados SQLite localizado em PATH configurável via variável de ambiente
- **FR-006**: O sistema DEVE extrair automaticamente hashtags do texto das notas (padrão `#palavra`)
- **FR-007**: O sistema DEVE exibir lista de todas as hashtags existentes com contagem de notas
- **FR-008**: O sistema DEVE filtrar notas ao clicar em uma hashtag da lista
- **FR-009**: O sistema DEVE filtrar notas por substring digitada em campo de busca
- **FR-010**: O sistema DEVE permitir marcar e desmarcar notas como "fixadas" (pinned)
- **FR-011**: Notas fixadas DEVEM aparecer no topo da lista, antes das não fixadas, mantendo ordem cronológica entre si
- **FR-012**: O sistema DEVE permitir anexar imagens e documentos às notas via upload
- **FR-013**: Arquivos anexados DEVEM ser armazenados em PATH externo ao container, configurável via variável de ambiente
- **FR-014**: Imagens anexadas DEVEM ser exibidas inline no conteúdo renderizado da nota
- **FR-015**: Documentos anexados DEVEM aparecer como links de download na nota
- **FR-016**: O sistema DEVE permitir renomear hashtags, atualizando todas as notas associadas
- **FR-017**: O sistema DEVE permitir excluir hashtags, removendo-as de todas as notas associadas
- **FR-018**: O sistema DEVE oferecer modo claro e modo escuro com persistência da preferência do usuário
- **FR-019**: A aplicação DEVE ser compatível com dispositivos móveis (responsiva a partir de 320px de largura)
- **FR-020**: A aplicação DEVE suportar instalação como PWA (Progressive Web App) com manifest e service worker; offline, o usuário pode visualizar notas existentes (somente leitura) — criar e editar requerem conexão ativa
- **FR-021**: O sistema DEVE ser distribuído como imagem Docker disponível em `ghcr.io/edalcin/`, expondo a aplicação na porta **8080**
- **FR-022**: O repositório DEVE ter workflow GitHub Actions para gerar nova imagem Docker automaticamente a cada mudança no código no branch principal
- **FR-023**: Ao excluir uma nota, os arquivos anexados DEVEM ser removidos do diretório de armazenamento externo

### Key Entities *(include if feature involves data)*

- **Nota**: Unidade principal de conteúdo — possui corpo em Markdown, data de criação, data de modificação, flag de fixada (pinned), e lista de hashtags extraídas automaticamente do texto
- **Hashtag**: Tag de classificação extraída do texto das notas — possui nome e contagem de notas associadas; gerenciável (renomear/excluir)
- **Anexo**: Arquivo (imagem ou documento) associado a uma nota — possui nome original, caminho no sistema de arquivos externo, tipo MIME, e data de upload

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Usuário consegue criar, editar e salvar uma nota em menos de 30 segundos
- **SC-002**: A lista de notas carrega em menos de 2 segundos com até 1.000 notas no banco de dados
- **SC-003**: Busca por texto ou hashtag retorna resultados em menos de 1 segundo
- **SC-004**: A aplicação é totalmente funcional em telas de 320px de largura ou mais (celulares pequenos)
- **SC-005**: A aplicação pode ser instalada como PWA em iOS e Android
- **SC-006**: O container Docker tem menos de 100MB de tamanho de imagem comprimida
- **SC-007**: A aplicação inicia corretamente quando as variáveis de ambiente `DB_PATH` e `FILES_PATH` são fornecidas, respondendo na porta 8080
- **SC-008**: 100% das funcionalidades estão disponíveis em dispositivos móveis via interface touch

## Clarifications

### Session 2026-03-29

- Q: Qual o comportamento offline do PWA? → A: Somente leitura — notas existentes acessíveis offline; criar/editar requerem conexão ativa
- Q: Exportação/backup de notas está no escopo? → A: Não — backup feito diretamente no volume Docker externo
- Q: Qual porta o container Docker expõe? → A: 8080
- Q: Como resolver conflito de edição simultânea entre sessões? → A: Última escrita vence (last-write-wins) — sem aviso de conflito
- Q: Mecanismo de salvamento de notas? → A: Auto-save com debounce (pausa na digitação) + botão de salvar explícito disponível

## Assumptions

- A aplicação é de uso pessoal ou pequeno grupo — não há requisito de autenticação/autorização de usuários múltiplos
- O banco de dados SQLite e diretório de arquivos são montados como volumes Docker na instalação no UNRAID
- A variável de ambiente `DB_PATH` aponta para o arquivo SQLite (ex: `/data/notes.db`) e `FILES_PATH` para o diretório de arquivos (ex: `/data/files/`)
- Upload de arquivos tem limite razoável (50MB por arquivo por padrão) para evitar sobrecarga do servidor
- A aplicação roda em rede local do UNRAID — HTTPS não é obrigatório para a v1
- Não há requisito de sincronização em tempo real entre múltiplas abas/dispositivos simultâneos
- O workflow GitHub Actions publicará a imagem Docker no GitHub Container Registry (ghcr.io/edalcin/) automaticamente via `GITHUB_TOKEN` sem expor credenciais no repositório
- A imagem base Docker será minimalista (Alpine Linux ou equivalente) para manter o container abaixo de 100MB
- Notas não têm título obrigatório — as primeiras palavras do conteúdo são usadas como prévia na lista
- Commits sempre no branch `main` — nunca criar branches separados no repositório
- Exportação/backup de notas está fora do escopo — o usuário faz backup diretamente nos volumes Docker montados externamente
