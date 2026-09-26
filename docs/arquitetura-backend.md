# Arquitetura do backend — Suportfy V4

Estado em 26/09/2026, ao fim da segunda fatia do backend (canal WhatsApp de ponta a ponta). Este documento descreve
o que existe de fato no código; o que ainda é plano está marcado como tal.

## Visão geral

```text
Navegador ──(cookie httpOnly)──▶ Next.js 16 (App Router, Node.js)
                                   ├─ src/proxy.ts            checagem otimista de sessão
                                   ├─ Server Components        leem dados com withTenant()
                                   ├─ Server Actions           login, cadastro, chaves, canal WhatsApp
                                   ├─ /api/webhooks/whatsapp/  entrada da Evolution API (JWT verificado)
                                   └─ src/server/**            código só de servidor ("server-only")
                                         │
                                         ▼
                                   PostgreSQL 15+  (RLS + papel suportfy_app)
                                         ▲
Provedores (OpenAI, Evolution API, Resend) ◀── pipeline do agente (src/server/messaging)
```

- **Um único app Next.js.** O backend roda nos mesmos deploys do frontend (Server
  Actions e Route Handlers, como o webhook do WhatsApp). Não há API
  pública (além do webhook autenticado) nem cliente de banco no navegador.
- **PostgreSQL puro**, sem depender de um provedor específico. Funciona em Supabase
  (conexão direta), Neon, RDS ou local. O driver é `pg`.
- **Modo demonstração preservado.** Sem `DATABASE_URL`, o app continua exatamente
  como antes: dados fictícios em memória, sem login. Com `DATABASE_URL`, login é
  obrigatório e as partes já ligadas ao servidor passam a usar dados reais.

## Dados e isolamento entre organizações

Migrations SQL em `db/migrations`, aplicadas por `npm run db:migrate`
(`scripts/db-migrate.mjs`). Cada arquivo roda numa transação, é registrado em
`schema_migrations` com SHA-256 e não pode ser alterado depois de aplicado
(o runner recusa). Um advisory lock impede dois deploys simultâneos.

| Tabela | Conteúdo |
| --- | --- |
| `users`, `sessions` | Contas (senha com scrypt) e sessões (só o hash SHA-256 do token) |
| `organizations`, `memberships` | Organizações e papéis (`owner`, `admin`, `member`) |
| `stores` | Lojas de uma organização |
| `channels` | Um canal WhatsApp (Evolution API) e um de e-mail (Resend) por loja, começando `disconnected` |
| `secrets` | Chaves cifradas (OpenAI, Evolution, Resend), por organização ou loja |
| `ai_settings` | Agente por loja: começa **desligado**; modelo, teto diário em US$, limite anti-loop |
| `customers`, `orders` | Clientes e pedidos (contexto da IA; `source` marca `shopify`, `channel` ou `demo`) |
| `conversations`, `messages` | Conversas por canal e mensagens com outbox (`queued → sending → sent/failed/blocked`) |
| `conversation_events` | Registro do que o agente fez (recebeu, pulou, rejeitou, respondeu, bloqueou envio) |
| `ai_usage` | Consumo diário por loja, usado pela trava de orçamento |

**Duas camadas de isolamento:**

1. **Banco (RLS).** Toda requisição de usuário roda em `withTenant()`: transação com
   `SET LOCAL ROLE suportfy_app` e `app.user_id` definido. As políticas usam
   `app.is_member(org_id)` / `app.has_role(org_id, …)`. Sem usuário definido, nada é
   visível. Todas as tabelas têm RLS ligado (há teste que confere).
2. **Privilégios por coluna.** O papel da aplicação não lê `password_hash`, sessões
   nem a cifra dos segredos; não muda a organização de uma loja; não marca canal como
   conectado; só lê pedidos, mensagens e eventos (que são escritos pelo servidor).

Chaves estrangeiras compostas (`store_id, org_id`) impedem que uma linha aponte para
loja de outra organização mesmo em contexto de sistema.

`withSystem()` (dono das tabelas, sem RLS) é usado só onde não existe usuário da
requisição: login/cadastro, leitura de segredos e o pipeline do agente — sempre
filtrando pela loja da conversa.

## Autenticação

- E-mail e senha, com scrypt (N=2¹⁵) e comparação em tempo constante; e-mail inexistente
  gasta o mesmo tempo que senha errada.
- Sessão: token aleatório de 256 bits no cookie `httpOnly`, `SameSite=Lax`,
  `Secure` e prefixo `__Host-` em produção; no banco só o hash. Expira em 30 dias.
- `src/proxy.ts` redireciona para `/entrar` quando falta o cookie; a validação real
  é feita no layout do app a cada requisição.
- O cadastro cria usuário, organização (usuário como proprietário), primeira loja,
  canais desconectados e agente desligado.

## Segredos (chave da OpenAI)

- Cifrados com AES-256-GCM usando `SUPORTFY_ENCRYPTION_KEY` (só no servidor). O AAD
  amarra a cifra a `organização:loja:tipo`: copiar a linha para outra organização faz
  a decifragem falhar.
- Gravação exige papel `admin` ou `owner`, conferido no contexto do usuário.
- A interface recebe apenas os 4 últimos caracteres e a data. O valor nunca volta em
  respostas nem vai para logs (mensagens de erro só citam o tipo do erro).
- A chave da loja, se existir, substitui a da organização.
- "Testar conexão" faz uma chamada real e barata (`GET /v1/models`).
- `SUPORTFY_ENCRYPTION_KEY_VERSION` permite rotação (o keyring aceita chaves anteriores).

## Canais

### WhatsApp — Evolution API (funcional; falta validar com instância real)

Formato conferido no código-fonte oficial da Evolution API v2 (o site de documentação
não é acessível a partir do ambiente de desenvolvimento):

| Uso | Chamada |
| --- | --- |
| Autenticação | cabeçalho `apikey` (chave global ou token da instância; 401 se recusada) |
| Estado da instância | `GET /instance/connectionState/{instância}` → `{ instance: { state: "open" \| "connecting" \| "close" } }` |
| Registrar webhook | `POST /webhook/set/{instância}` com `{ webhook: { enabled, url, headers, byEvents, base64, events } }` |
| Enviar texto | `POST /message/sendText/{instância}` com `{ number, text }` → 201 com `key.id` |

**Conectar** (Configurações › WhatsApp, só administradores): o servidor valida o endereço
(SSRF), grava a `apikey` cifrada, gera uma chave aleatória de 256 bits por canal
(`evolution_webhook_key`, também cifrada), consulta o estado da instância e registra o
webhook `SUPORTFY_PUBLIC_URL/api/webhooks/whatsapp/{canal}` com `headers.jwt_key` =
essa chave e os eventos `MESSAGES_UPSERT` e `CONNECTION_UPDATE`. O canal só fica
`connected` se a chave foi aceita, a instância está `open` e o webhook foi registrado;
`pending` quando a instância não está no WhatsApp (falta ler o QR code); `error` com o
motivo quando algo falha. **Testar conexão** só consulta o estado. **Desconectar**
desliga o webhook no provedor (melhor esforço), apaga as duas chaves e marca o canal
como desconectado (não faz logout da instância).

**Autenticidade do webhook.** Com `jwt_key` configurado, a Evolution API envia em cada
entrega `Authorization: Bearer <JWT HS256>` assinado com essa chave, válido por 600 s,
com `{ app: "evolution", action: "webhook" }`. O Suportfy aceita só HS256, compara a
assinatura em tempo constante, confere `iat`/`exp` (60 s de tolerância), as declarações
e que o campo `instance` do corpo é a instância do canal. Antes disso nada do corpo é
lido. Canal inexistente ou desconectado responde 404 sem revelar qual é o caso; corpo
acima de 256 KB, 413. **O corpo nunca vai para logs** (traz dados do cliente e a `apikey`).

**Recebimento.** Só mensagens de texto de contatos individuais. Ignora mensagens da
própria loja (`fromMe` e o número da instância), grupos, listas de transmissão e mídia
sem texto. Endereços `@lid` só são aceitos quando o provedor informa o número real
(`senderPn`/`remoteJidAlt`); sem isso a mensagem é ignorada em vez de responder a um
número errado. `connection.update` atualiza o estado do canal.

**Processamento.** O webhook grava a mensagem (idempotente) e responde 200; em seguida,
via `after()`, roda `processConversation`: lock consultivo por conversa (dois webhooks
simultâneos não chamam o modelo duas vezes), `runAgent` e `dispatchOutbox` só daquela
conversa. Reentrega do mesmo evento também agenda o processamento: se a primeira
tentativa caiu antes de responder, esta completa; se já respondeu, o agente pula.

**SSRF.** `src/server/net/safe-request.ts` faz as chamadas aos provedores configurados
pelos clientes: só `https`, sem usuário/senha na URL, nomes `localhost`/`.local`/
`.internal` recusados, IP conferido **no momento da conexão** (cobre DNS rebinding) contra
redes privadas, loopback, link-local (inclui 169.254.169.254), CGNAT, multicast,
reservadas e equivalentes IPv6/IPv4-mapeados; sem seguir redirecionamentos; resposta
limitada a 1 MB. `SUPORTFY_DEV_ALLOW_PRIVATE_PROVIDER_URLS=true` libera http e redes
internas só fora de produção, para testar com uma Evolution API local.

A Evolution API não oferece chave de idempotência no envio: se o processo cair depois
do envio e antes de gravar o resultado, a mensagem pode sair duas vezes. A outbox
garante no máximo uma resposta por mensagem recebida do lado do Suportfy.

### E-mail — Resend (não implementado nesta fatia)

Adaptador de envio existe, sem verificação com credenciais reais e sem recebimento.
O canal de e-mail continua separado e desconectado.

## Pipeline do agente (IA atende; sem fila humana)

`src/server/messaging/pipeline.ts`, em três passos independentes e repetíveis:

1. **`ingestInbound`** — grava a mensagem recebida antes de qualquer coisa. Chave de
   idempotência `in:<canal>:<id do provedor>`: webhook repetido não duplica. Ignora o
   próprio número/endereço da loja. Cria ou reutiliza cliente e conversa aberta.
2. **`runAgent`** — travas antes de chamar o modelo:
   agente desligado, conversa pausada, mensagem já respondida, resposta automática
   (auto-reply, no-reply), eco da última resposta, limite de respostas por conversa
   por hora (anti-loop), teto diário de gasto e ausência de chave.
   Depois monta o contexto **só da loja da conversa**: pedidos do cliente e pedidos
   citados por número (um número de outra loja nunca entra). A resposta do modelo é
   estruturada (JSON Schema estrito) e validada: pedidos, códigos de rastreio e links
   citados precisam existir no contexto; tamanho máximo; sem repetir a resposta
   anterior. Uma nova tentativa com o motivo da rejeição; se falhar de novo, nada é
   enviado, a conversa fica `ai_status = 'error'` e o evento registra o motivo.
   A resposta válida é gravada como `queued` com chave `reply:<mensagem recebida>`
   — no máximo uma resposta por mensagem, mesmo que o passo rode duas vezes.
   Todo uso de tokens é contabilizado (inclusive respostas rejeitadas).
3. **`dispatchOutbox`** — reserva mensagens vencidas com `FOR UPDATE SKIP LOCKED` e um
   prazo de 2 min (processo que cair no meio libera a mensagem). Canal desconectado →
   `blocked`. Erro temporário (rede, 429, 5xx) → nova tentativa com backoff (30 s, 1 min,
   2 min… até 1 h) e a mesma chave de idempotência. Erro definitivo ou tentativas
   esgotadas → `failed` com evento.

Não existe atribuição a pessoas nem fila de operadores. Quando a IA não consegue
responder com segurança, o caso fica visível como erro do agente, com o motivo, e a
tela do canal mostra a última mensagem que ficou sem resposta e a última falha de envio.

O agente começa **desligado** em toda loja. Liga-se em Configurações › Inteligência
Artificial › Atendimento automático (só administradores; gravado em `ai_settings`).

## Comandos

```bash
npm run db:migrate                  # aplica migrations (DATABASE_URL)
npm run check                       # lint, typecheck e testes
TEST_DATABASE_URL=postgres://… npm test   # inclui os testes de integração com Postgres real
npm run build
```

Sem `TEST_DATABASE_URL`, os testes de integração aparecem como *skipped* (não passam
em silêncio).

## O que ainda é demonstração ou falta

- Inbox, Visão geral, Clientes, Relatórios, Conhecimento, Automações e Agente de IA
  continuam lendo `src/lib/demo/data.ts`. A faixa do topo diz isso também no modo com
  servidor.
- Modelo, orçamento e limites do agente na tela de IA ficam só na sessão; o servidor usa
  os padrões de `ai_settings` (o liga/desliga é real).
- Não há job periódico: o agente e a outbox rodam logo após cada webhook. Novas
  tentativas de envio agendadas (backoff) só acontecem quando chega outra mensagem da
  mesma conversa ou quando um job for criado.
- A integração WhatsApp foi testada com um provedor falso que segue os formatos do
  código-fonte da Evolution API, não com uma instância real.
- E-mail (Resend) e Shopify não estão conectados.

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Liga o backend. Sem ela, modo demonstração. |
| `SUPORTFY_ENCRYPTION_KEY` / `_VERSION` | Chave AES-256 dos segredos (32 bytes em base64). |
| `SUPORTFY_PUBLIC_URL` | Endereço público do app, para registrar o webhook do WhatsApp. |
| `SUPORTFY_DEV_ALLOW_PRIVATE_PROVIDER_URLS` | Só desenvolvimento: Evolution API local (http/rede interna). |
| `TEST_DATABASE_URL` | Testes de integração. |
