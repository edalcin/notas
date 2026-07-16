# Instalar a extensão do Chrome — Notas

A extensão envia a página/link atual (ou um link com clique direito) direto para o Notas como nova nota. Fonte: pasta `extension/` deste repositório.

## 1. Carregar a extensão no Chrome

1. Abra `chrome://extensions`
2. Ative **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação**
4. Selecione a pasta `extension/` deste repositório (`D:\git\notas\extension`)

A extensão aparece na lista e um ícone é adicionado à barra de ferramentas do Chrome (pode estar escondido no ícone de peça de quebra-cabeça — fixe clicando no pin).

## 2. Configurar (URL + token)

1. Clique com o botão direito no ícone da extensão → **Opções** (ou clique no ícone → **Configurar**)
2. Preencha:
   - **URL do servidor**: a URL pública da instância que você quer usar (ver tabela abaixo)
   - **Token**: o `EXTENSION_TOKEN` da mesma instância (ver tabela abaixo) — necessário porque ambas usam `APP_PIN`
3. Clique em **Testar conexão** → deve aparecer "Conexão OK"
4. Clique em **Salvar** (aceite o prompt de permissão para o domínio)

| Instância | URL do servidor | Token |
|---|---|---|
| Homologação (UNRAID, `notas2`) | `https://notas2.dalc.in` | `b6f21c9c87b6fb3dbd6787bf16f0731ff5abe148055c4f0d6abeda79baf1bbd1` |
| Produção (EC2, `notas`) | `https://notas.dalc.in` | `fddf4558347b49b46565c7b178b2f1a2c84485131eba57d866251f0a0cf711c6` |

> A extensão só guarda uma URL + token por vez (`chrome.storage.local`). Para alternar entre homologação e produção, reabra as Opções e troque os dois campos.

## 3. Usar

**Popup** — clique no ícone da extensão em qualquer página:
- Mostra título e URL da aba atual (somente leitura)
- Campo de comentário opcional, pré-preenchido com o texto que estiver selecionado na página
- **Salvar no Notas** → badge verde ✓ e o popup fecha

**Menu de contexto** — clique direito em:
- Uma página → cria nota com título + URL da página
- Um link → cria nota com a URL do link
- Texto selecionado → cria nota incluindo o texto selecionado

Todas as notas criadas pela extensão recebem a tag `#chrome`.

## Solução de problemas

- **Badge vermelho (!)** — falha ao salvar. Abra o popup para ver a mensagem de erro.
- **"Falha de autenticação: verifique o token"** — o token nas Opções não bate com o `EXTENSION_TOKEN` do servidor.
- **"Configure o servidor primeiro"** — as Opções ainda não foram salvas.
- Extensão não aparece na página `chrome://extensions` após "Carregar sem compactação" — confirme que selecionou a pasta `extension/` (não a raiz do repo).
