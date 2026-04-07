# Feature Specification: Trash and Restore Notes

**Feature Branch**: `002-trash-restore-notes`  
**Created**: 2026-04-07  
**Status**: Draft  
**Input**: User description: "Quero modificar a forma de excluir notas. Ao lado do ícone de 'Fixar'/'Desafixar', quero um ícone para deletar a nota. Ao clicar em deletar, pedir confirmação do usuário. Quero criar uma 'Lixeira' onde as notas deletadas vão ficar. As notas deletadas na 'Lixeira' podem ser restauradas. A lixeira pode ser 'Esvaziada' totalmente, pedindo confirmação. Quero, então, retirar a opção de 'Excluir' quando estiver editando a nota."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Deletar nota com confirmação (Priority: P1)

O usuário visualiza as notas no feed e deseja deletar uma nota específica. Ao lado do ícone de fixar/desafixar, existe agora um ícone de lixeira. Ao clicar nele, uma caixa de confirmação é exibida. Ao confirmar, a nota é movida para a Lixeira e desaparece do feed principal.

**Why this priority**: É o fluxo central da funcionalidade — sem isso, a Lixeira não tem como ser populada.

**Independent Test**: Pode ser testado criando uma nota, clicando no ícone de deletar, confirmando, e verificando que a nota sumiu do feed principal.

**Acceptance Scenarios**:

1. **Given** uma nota visível no feed, **When** o usuário clica no ícone de deletar, **Then** uma confirmação é exibida perguntando se deseja mover a nota para a lixeira.
2. **Given** a caixa de confirmação está aberta, **When** o usuário confirma, **Then** a nota desaparece do feed principal e vai para a Lixeira.
3. **Given** a caixa de confirmação está aberta, **When** o usuário cancela, **Then** a nota permanece no feed sem alterações.

---

### User Story 2 - Visualizar e restaurar notas na Lixeira (Priority: P2)

O usuário acessa a seção "Lixeira" para ver as notas deletadas. Cada nota na lixeira exibe um botão de restaurar. Ao restaurar, a nota volta ao feed principal.

**Why this priority**: Permitir a restauração é o principal benefício da lixeira em relação à exclusão direta.

**Independent Test**: Pode ser testado deletando uma nota, navegando até a Lixeira, e clicando em restaurar — verificando que a nota retorna ao feed.

**Acceptance Scenarios**:

1. **Given** existem notas na Lixeira, **When** o usuário acessa a seção Lixeira, **Then** as notas deletadas são listadas com opção de restaurar.
2. **Given** uma nota está na Lixeira, **When** o usuário clica em restaurar, **Then** a nota volta ao feed principal e some da Lixeira.
3. **Given** a Lixeira está vazia, **When** o usuário acessa a seção Lixeira, **Then** uma mensagem indicando que a lixeira está vazia é exibida.

---

### User Story 3 - Esvaziar a Lixeira (Priority: P3)

O usuário deseja excluir permanentemente todas as notas da Lixeira de uma só vez. Uma ação "Esvaziar Lixeira" está disponível na tela da Lixeira. Ao acionar, uma confirmação é solicitada. Após confirmar, todas as notas são excluídas permanentemente.

**Why this priority**: É uma funcionalidade de conveniência secundária — a lixeira já funciona sem ela, mas facilita a gestão.

**Independent Test**: Pode ser testado com múltiplas notas na lixeira, acionando "Esvaziar Lixeira", confirmando, e verificando que a lixeira fica vazia.

**Acceptance Scenarios**:

1. **Given** existem notas na Lixeira, **When** o usuário aciona "Esvaziar Lixeira", **Then** uma confirmação é exibida alertando que a ação é irreversível.
2. **Given** a confirmação de esvaziar está aberta, **When** o usuário confirma, **Then** todas as notas da lixeira são excluídas permanentemente e a lixeira fica vazia.
3. **Given** a confirmação de esvaziar está aberta, **When** o usuário cancela, **Then** as notas permanecem na lixeira sem alterações.

---

### User Story 4 - Remover opção de excluir na edição (Priority: P4)

Ao editar uma nota, a opção de "Excluir" que existia anteriormente no modo de edição é removida. A exclusão passa a ser feita exclusivamente pelo ícone de lixeira no feed.

**Why this priority**: É uma simplificação da interface — remove redundância e centraliza o fluxo de exclusão no novo ícone.

**Independent Test**: Pode ser testado abrindo uma nota para edição e verificando que não existe mais botão/opção de excluir na interface de edição.

**Acceptance Scenarios**:

1. **Given** o usuário está no modo de edição de uma nota, **When** visualiza as opções disponíveis, **Then** não existe opção de "Excluir" acessível no modo de edição.

---

### Edge Cases

- Restaurar uma nota quando já existe nota com conteúdo idêntico no feed: a nota é restaurada normalmente — duplicatas são permitidas pois notas são identificadas por ID único.
- Como a Lixeira se comporta se o usuário deletar uma nota fixada — ela é restaurada como fixada ou desafixada?
- O que acontece se o usuário tentar esvaziar a lixeira quando ela já está vazia (botão deve ser desabilitado ou ausente)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE exibir um ícone de lixeira ao lado do ícone de fixar/desafixar em cada nota do feed.
- **FR-002**: Ao clicar no ícone de lixeira, o sistema DEVE exibir um modal overlay customizado solicitando confirmação do usuário antes de mover a nota, com botões "Confirmar" e "Cancelar".
- **FR-003**: Ao confirmar a exclusão, o sistema DEVE mover a nota para a Lixeira, removendo-a do feed principal.
- **FR-004**: Ao cancelar a confirmação, o sistema DEVE manter a nota no feed sem alterações.
- **FR-005**: O sistema DEVE disponibilizar uma seção "Lixeira" acessível como item fixo na barra lateral/menu de navegação principal, junto com os demais itens de navegação.
- **FR-006**: A seção Lixeira DEVE listar todas as notas deletadas ordenadas por data de exclusão (mais recente primeiro), com opção de restaurar cada uma individualmente. Não há exclusão permanente de nota individual pela lixeira — a única remoção permanente é via "Esvaziar Tudo".
- **FR-007**: Ao clicar em restaurar, o sistema DEVE mover a nota de volta ao feed principal e removê-la da Lixeira.
- **FR-008**: A seção Lixeira DEVE disponibilizar uma ação "Esvaziar Lixeira".
- **FR-009**: Ao acionar "Esvaziar Lixeira", o sistema DEVE exibir um modal overlay customizado alertando que a ação é irreversível, com botões "Confirmar" e "Cancelar".
- **FR-010**: Ao confirmar o esvaziamento, o sistema DEVE excluir permanentemente todas as notas da Lixeira.
- **FR-011**: O sistema DEVE remover a opção de "Excluir" da interface de edição de notas.
- **FR-012**: A Lixeira DEVE exibir uma mensagem de estado vazio quando não houver notas deletadas.
- **FR-013**: O botão "Esvaziar Lixeira" DEVE estar desabilitado ou ausente quando a Lixeira estiver vazia.

### Key Entities

- **Nota (Note)**: Entidade existente — passa a ter um atributo de estado indicando se está ativa ou na lixeira, e a data/hora em que foi movida para a lixeira.
- **Lixeira (Trash)**: Visão filtrada das notas em estado "deletado"; não é uma entidade separada, mas uma visualização do estado das notas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O usuário consegue mover uma nota para a lixeira em no máximo 2 interações (clique no ícone + confirmação).
- **SC-002**: O usuário consegue restaurar uma nota da lixeira em no máximo 2 interações (navegar até lixeira + clicar restaurar).
- **SC-003**: 100% das notas movidas para a lixeira não aparecem mais no feed principal.
- **SC-004**: 100% das notas restauradas da lixeira voltam a aparecer no feed principal.
- **SC-005**: O esvaziamento da lixeira elimina permanentemente 100% das notas contidas nela.
- **SC-006**: A interface de edição não apresenta mais a opção de excluir após a implementação.

## Clarifications

### Session 2026-04-07

- Q: Usuário pode excluir permanentemente uma nota individual da lixeira (sem esvaziar tudo)? → A: Não — a única forma de exclusão permanente é "Esvaziar Tudo".
- Q: O que acontece ao restaurar uma nota cujo conteúdo já existe no feed? → A: Restaura normalmente — duplicatas de conteúdo são permitidas; notas são identificadas por ID.
- Q: Qual o tipo de diálogo de confirmação ao deletar e ao esvaziar a lixeira? → A: Modal overlay customizado na página, com botões Confirmar/Cancelar.
- Q: Como as notas são ordenadas na visão da Lixeira? → A: Mais recentemente deletadas primeiro (data de exclusão, decrescente).
- Q: Como o usuário acessa a seção "Lixeira" na interface? → A: Item fixo na barra lateral/menu de navegação, junto com os demais itens de navegação principais.

## Assumptions

- A nota restaurada volta ao feed com seu estado de fixação original (como estava antes de ser deletada).
- Não há prazo de expiração automática para notas na lixeira — elas permanecem até serem restauradas ou a lixeira ser esvaziada manualmente.
- A Lixeira é acessível como item fixo na barra lateral de navegação principal.
- O estado "na lixeira" é persistido no banco de dados como um campo de status na tabela de notas, não como exclusão física imediata.
- Anexos associados a uma nota seguem o mesmo ciclo de vida da nota (vão para a lixeira junto e são excluídos permanentemente ao esvaziar).
