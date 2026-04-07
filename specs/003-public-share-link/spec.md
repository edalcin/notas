# Feature Specification: Public Note Share Link

**Feature Branch**: `003-public-share-link`  
**Created**: 2026-04-07  
**Status**: Draft  
**Input**: User description: "Quero criar um link para compartilhar publicamente uma nota. Quero um ícone de um link, junto com os ícones de Ficar/Desafixar e Mover para a Lixeira, que gera uma URL pública para a nota, para compartilhamento. Note que quero manter toda a aplicação protegida de acesso público pelo PIN. Porém, quero poder compartilhar notas, individualmente, gerando este link público."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gerar link público para uma nota (Priority: P1)

O usuário autenticado abre sua lista de notas e deseja compartilhar uma nota específica com alguém que não tem acesso ao aplicativo. Ele clica no ícone de link na nota e obtém uma URL pública que pode copiar e enviar a qualquer pessoa.

**Why this priority**: É o núcleo da funcionalidade. Sem a geração do link, nada mais pode ser testado ou entregue.

**Independent Test**: Pode ser testado completamente clicando no ícone de link em uma nota, copiando a URL gerada, abrindo em uma janela anônima (sem PIN), e verificando que o conteúdo da nota é exibido corretamente.

**Acceptance Scenarios**:

1. **Given** o usuário está autenticado e visualiza uma nota, **When** ele clica no ícone de link na nota, **Then** o sistema gera (ou reutiliza) um token único para aquela nota e exibe a URL pública de compartilhamento.
2. **Given** o link público de uma nota já foi gerado anteriormente, **When** o usuário clica novamente no ícone de link, **Then** o mesmo link é exibido (sem gerar um novo token).
3. **Given** uma URL pública válida de uma nota, **When** qualquer pessoa (sem PIN) acessa essa URL, **Then** o conteúdo da nota é exibido em uma página pública somente leitura.

---

### User Story 2 - Acessar nota pública sem autenticação (Priority: P2)

Um receptor do link (sem conta ou PIN) clica na URL compartilhada e consegue ler o conteúdo completo da nota, incluindo formatação Markdown, sem precisar fazer login.

**Why this priority**: Sem esta história, o link gerado não tem utilidade real — é necessário validar que o receptor consegue acessar o conteúdo sem autenticação.

**Independent Test**: Acessar a URL pública em uma sessão sem cookie de autenticação e verificar que a nota é renderizada corretamente, sem redirecionamento para a tela de PIN.

**Acceptance Scenarios**:

1. **Given** uma URL pública válida, **When** acessada sem cookie de autenticação, **Then** a página exibe o conteúdo da nota renderizado em Markdown, sem solicitar PIN.
2. **Given** uma URL com token inválido ou inexistente, **When** acessada, **Then** uma página de erro amigável é exibida (ex.: "Nota não encontrada ou link inválido").
3. **Given** uma nota na lixeira com link público ativo, **When** a URL pública é acessada, **Then** a nota não é exibida (exibe erro ou "link inválido").

---

### User Story 3 - Visualizar e gerenciar todas as notas compartilhadas (Priority: P3)

O usuário autenticado deseja ter uma visão consolidada de quais notas estão sendo compartilhadas publicamente. Ele acessa uma seção dedicada no menu lateral esquerdo chamada "Compartilhadas" e vê a lista de notas com link ativo, podendo revogar qualquer uma delas diretamente.

**Why this priority**: Dá ao usuário controle e visibilidade sobre o que está exposto publicamente, sem precisar procurar nota a nota.

**Independent Test**: Compartilhar 2-3 notas, acessar a seção "Compartilhadas" na barra lateral e verificar que todas aparecem listadas. Revogar uma delas e confirmar que sai da lista.

**Acceptance Scenarios**:

1. **Given** o usuário tem ao menos uma nota com link ativo, **When** ele acessa a seção "Compartilhadas" no menu lateral, **Then** vê uma lista das notas com link público ativo.
2. **Given** o usuário está na seção "Compartilhadas", **When** ele clica no ícone de link de uma nota listada, **Then** o modal de compartilhamento se abre com a opção de revogar.
3. **Given** nenhuma nota possui link ativo, **When** o usuário acessa "Compartilhadas", **Then** a seção exibe uma mensagem indicando que não há notas compartilhadas.

---

### User Story 4 - Revogar link público de uma nota (Priority: P4)

O usuário autenticado decide que não quer mais que determinada nota seja acessível publicamente. No modal de compartilhamento (aberto pelo ícone de link na nota ou pela seção "Compartilhadas"), ele clica em "Revogar link", tornando a URL anterior inválida.

**Why this priority**: Importante para privacidade e controle, mas não bloqueia o MVP — o compartilhamento funciona sem revogação na primeira versão.

**Independent Test**: Após revogar o link de uma nota via modal, tentar acessar a URL anterior em janela anônima e verificar que retorna erro. Verificar também que a nota desaparece da seção "Compartilhadas".

**Acceptance Scenarios**:

1. **Given** uma nota com link público ativo, **When** o usuário abre o modal de compartilhamento e clica em "Revogar link", **Then** o token anterior é invalidado e a URL antiga retorna erro.
2. **Given** uma nota com link revogado, **When** o usuário gera um novo link, **Then** um novo token é criado e uma nova URL é disponibilizada.
3. **Given** o usuário revoga o link de uma nota, **When** ele acessa a seção "Compartilhadas", **Then** a nota revogada não aparece mais na lista.

---

### Edge Cases

- O que acontece quando a nota é movida para a lixeira enquanto o link público ainda está ativo? (A nota não deve ser exibida publicamente se estiver na lixeira.)
- O que acontece quando a nota é deletada permanentemente? (O link deve retornar erro "não encontrado".)
- O que acontece se o token for adulterado ou truncado na URL? (Deve retornar erro, não expor nenhuma nota.)
- O usuário compartilha o link e depois edita a nota — o link deve refletir o conteúdo atualizado.
- Notas com anexos: a página pública exibe apenas o texto/Markdown da nota, sem acesso aos arquivos de anexo (fora do escopo desta versão).
- Um IP que excede o limite de requisições ao endpoint público recebe HTTP 429 e não consegue acessar nenhuma nota pública até o período de cooldown expirar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE exibir um ícone de link em cada nota, posicionado junto aos ícones de fixar/desafixar e mover para a lixeira.
- **FR-002**: Ao clicar no ícone de link, o sistema DEVE gerar um token único e imprevisível associado à nota, caso ainda não exista.
- **FR-003**: Ao clicar no ícone de link em uma nota que já possui token, o sistema DEVE reutilizar o token existente (sem gerar um novo).
- **FR-004**: O sistema DEVE exibir a URL pública gerada em um modal/dialog, mostrando a URL completa e um botão "Copiar link" para copiar para a área de transferência.
- **FR-005**: O sistema DEVE disponibilizar um endpoint público (sem autenticação por PIN) que receba o token e retorne o conteúdo da nota.
- **FR-006**: A página pública DEVE renderizar o conteúdo da nota em Markdown (somente leitura), sem os controles do aplicativo (barra lateral, editor, menu de ações).
- **FR-007**: O sistema DEVE rejeitar tokens inválidos, expirados ou inexistentes, exibindo uma mensagem de erro amigável.
- **FR-008**: O sistema NÃO DEVE exibir notas que estão na lixeira via link público, mesmo que o token ainda exista.
- **FR-009**: O modal de compartilhamento DEVE exibir um botão "Revogar link" quando a nota já possui um token ativo, permitindo que o usuário invalide o token existente.
- **FR-010**: O menu lateral esquerdo DEVE incluir uma seção "Compartilhadas" que lista todas as notas com link público ativo.
- **FR-011**: A seção "Compartilhadas" DEVE exibir uma mensagem vazia quando nenhuma nota possui link ativo.
- **FR-012**: O endpoint público de notas compartilhadas DEVE aplicar rate limiting por IP para prevenir enumeração automatizada de tokens e abuso.
- **FR-013**: Todas as outras rotas e funcionalidades da aplicação DEVEM continuar protegidas pelo PIN, sem qualquer alteração no fluxo de autenticação atual.

### Key Entities

- **Share Token**: Identificador único e aleatório associado a uma nota específica. Permite acesso público somente leitura ao conteúdo da nota. Pode ser revogado pelo proprietário.
- **Nota (Note)**: Entidade já existente. Passa a ter um atributo opcional de share token. Notas na lixeira não são acessíveis via share token.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O usuário autenticado consegue gerar e copiar um link público para qualquer nota em no máximo 2 cliques.
- **SC-002**: Qualquer pessoa com a URL pública consegue acessar e ler o conteúdo da nota sem qualquer etapa de autenticação.
- **SC-003**: Acessar uma URL pública com token inválido exibe uma mensagem de erro clara em menos de 1 segundo.
- **SC-004**: Após revogar um link, a URL anterior se torna inacessível imediatamente (sem cache ou delay).
- **SC-005**: 100% das rotas da aplicação (exceto o endpoint de nota pública) continuam exigindo autenticação por PIN — nenhuma rota existente é exposta publicamente.
- **SC-006**: Requisições excessivas ao endpoint público a partir do mesmo IP resultam em resposta de erro (HTTP 429) antes de atingir um volume que permita enumeração prática de tokens.

## Clarifications

### Session 2026-04-07

- Q: Como a URL de compartilhamento deve ser apresentada ao usuário após clicar no ícone de link? → A: Modal/dialog exibe a URL completa com botão "Copiar link" (Opção A)
- Q: Onde e como o usuário aciona a revogação do link? → A: No próprio modal de compartilhamento (botão "Revogar link"); adicionalmente, o menu lateral esquerdo terá uma seção "Compartilhadas" listando todas as notas com link ativo
- Q: O endpoint público de notas compartilhadas deve ter proteção contra abuso? → A: Rate limiting por IP (Opção A)

## Assumptions

- O aplicativo atual possui um sistema de autenticação via PIN que protege todas as rotas; este sistema não será modificado.
- O link público exibe apenas o conteúdo textual/Markdown da nota. Anexos e arquivos não são acessíveis via link público nesta versão.
- Não há expiração automática de links — o link permanece válido até ser explicitamente revogado pelo usuário.
- O token de compartilhamento é gerado aleatoriamente e não contém informações codificadas sobre a nota ou o usuário.
- A página pública de compartilhamento é uma view minimalista, sem a interface completa do aplicativo (sem header de autenticação, sem barra lateral).
- Tags da nota não são exibidas na página pública nesta versão.
- Não há funcionalidade de compartilhamento com expiração automática por tempo (fora do escopo desta versão).
