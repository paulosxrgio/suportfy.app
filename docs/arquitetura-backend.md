# Arquitetura do backend — Suportfy V4

Estado em 26/09/2026, ao fim da primeira fatia do backend. Este documento descreve
o que existe de fato no código; o que ainda é plano está marcado como tal.

## Visão geral

```text
Navegador ──(cookie httpOnly)──▶ Next.js 16 (App Router, Node.js)
                                   ├─ src/proxy.ts            checagem otimista de sessão
                                   ├─ Server Components        leem dados com withTenant()
                                   ├─ Server Actions           login, cadastro, chave da OpenAI
                                   └─ src/server/**            código só de servidor ("server-only")
                                         │
                                         ▼
                                   PostgreSQL 15+  (RLS + papel suportfy_app)
                                         ▲
Provedores (OpenAI, Evolution API, Resend) ◀── pipeline do agente (src/server/messaging)
```

- **Um único app Next.js.** O backend roda nos mesmos deploys do frontend (Server
  Actions e, na próxima etapa, Route Handlers para webhooks e jobs). Não há API
  pública nem cliente de banco no navegador.
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

- **WhatsApp — Evolution API** (provedor já definido na interface do V4). Adaptador de
  envio e parser do webhook `messages.upsert`, que descarta mensagens `fromMe` e de
  grupos. **Não verificado contra uma instância real.**
- **E-mail — Resend**, separado do WhatsApp. Envio com cabeçalho `Idempotency-Key`.
  **Não verificado com credenciais reais**; recebimento de e-mail ainda não existe.
- `resolveChannel()` só entrega um adaptador quando o canal está `connected` e a
  credencial cifrada existe. Caso contrário, o envio fica `blocked` com o motivo —
  nunca é marcado como enviado.

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
responder com segurança, o caso fica visível como erro do agente, com o motivo.

## Comandos

```bash
npm run db:migrate                  # aplica migrations (DATABASE_URL)
npm run check                       # lint, typecheck e testes
TEST_DATABASE_URL=postgres://… npm test   # inclui os testes de integração com Postgres real
npm run build
```

Sem `TEST_DATABASE_URL`, os testes de integração aparecem como *skipped* (não passam
em silêncio).

## O que ainda é demonstração

- Inbox, Visão geral, Clientes, Tickets, Pedidos, Relatórios, Conhecimento, Automações e
  Agente de IA continuam lendo `src/lib/demo/data.ts`. A faixa do topo diz isso também
  no modo com servidor.
- Modelo, orçamento e limites do agente na tela de IA ficam só na sessão; o servidor usa
  os padrões da tabela `ai_settings`.
- Nenhum canal está conectado; não há webhooks públicos nem job que rode o agente e a
  outbox (as funções existem e são testadas, mas nada as chama em produção ainda).
