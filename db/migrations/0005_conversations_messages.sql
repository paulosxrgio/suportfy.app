-- Conversas, mensagens (com outbox), eventos do agente e consumo de IA.
-- Não há responsável humano: o atendimento é feito pela IA.

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  store_id uuid NOT NULL,
  channel_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  -- Estado do agente na conversa. 'error' = a IA não conseguiu responder com
  -- segurança (motivo registrado em conversation_events).
  ai_status text NOT NULL DEFAULT 'active' CHECK (ai_status IN ('active', 'paused', 'error')),
  subject text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (store_id, org_id) REFERENCES stores (id, org_id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id, store_id) REFERENCES channels (id, store_id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id, store_id) REFERENCES customers (id, store_id) ON DELETE CASCADE,
  UNIQUE (id, store_id)
);
CREATE INDEX conversations_store_recent_idx ON conversations (store_id, last_message_at DESC);
-- No máximo uma conversa aberta por cliente e canal.
CREATE UNIQUE INDEX conversations_open_key ON conversations (channel_id, customer_id) WHERE status = 'open';

-- Mensagens são persistidas antes de qualquer envio. Saída percorre
-- queued -> sending -> sent/failed; `idempotency_key` impede duplicatas tanto
-- em webhooks repetidos quanto em novas tentativas de envio.
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  store_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  author text NOT NULL CHECK (author IN ('customer', 'ai', 'system')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 20000),
  status text NOT NULL CHECK (status IN ('received', 'queued', 'sending', 'sent', 'failed', 'blocked')),
  idempotency_key text NOT NULL UNIQUE,
  provider_message_id text,
  attempts int NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz,
  last_error text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  FOREIGN KEY (store_id, org_id) REFERENCES stores (id, org_id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id, store_id) REFERENCES conversations (id, store_id) ON DELETE CASCADE,
  CHECK ((direction = 'inbound') = (status = 'received'))
);
CREATE INDEX messages_conversation_idx ON messages (conversation_id, created_at);
CREATE INDEX messages_outbox_idx ON messages (next_attempt_at) WHERE status IN ('queued', 'sending');

CREATE TABLE conversation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  store_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  kind text NOT NULL CHECK (length(kind) BETWEEN 1 AND 60),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (store_id, org_id) REFERENCES stores (id, org_id) ON DELETE CASCADE,
  FOREIGN KEY (conversation_id, store_id) REFERENCES conversations (id, store_id) ON DELETE CASCADE
);
CREATE INDEX conversation_events_conversation_idx ON conversation_events (conversation_id, created_at);

-- Consumo diário por loja, usado pela trava de orçamento.
CREATE TABLE ai_usage (
  store_id uuid NOT NULL,
  org_id uuid NOT NULL,
  day date NOT NULL,
  requests int NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  -- Custo estimado em milionésimos de dólar.
  cost_usd_micros bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, day),
  FOREIGN KEY (store_id, org_id) REFERENCES stores (id, org_id) ON DELETE CASCADE
);
