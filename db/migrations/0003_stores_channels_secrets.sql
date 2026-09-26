-- Lojas, canais de atendimento, segredos cifrados e configuração da IA.

CREATE TABLE stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  shopify_domain text CHECK (shopify_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Alvo das chaves estrangeiras compostas que garantem a mesma organização.
  UNIQUE (id, org_id)
);
CREATE INDEX stores_org_idx ON stores (org_id);

-- Um canal por tipo e loja. WhatsApp e e-mail são separados de propósito.
-- `status` reflete o estado real: começa desconectado e só muda quando o
-- servidor validar credenciais com o provedor.
CREATE TABLE channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  store_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('whatsapp', 'email')),
  provider text NOT NULL CHECK (
    (kind = 'whatsapp' AND provider = 'evolution') OR (kind = 'email' AND provider = 'resend')
  ),
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'pending', 'connected', 'error')),
  -- Número ou endereço público do canal (não é segredo).
  address text,
  -- Configuração não sensível (ex.: nome da instância). Nunca guarda chaves.
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (store_id, org_id) REFERENCES stores (id, org_id) ON DELETE CASCADE,
  UNIQUE (store_id, kind),
  UNIQUE (id, store_id)
);

-- Segredos cifrados com AES-256-GCM pelo servidor. O papel da aplicação só
-- enxerga as colunas de metadados (ver 0006); cifra, IV e tag ficam fora.
CREATE TABLE secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  -- NULL = vale para a organização inteira; preenchido = substitui para a loja.
  store_id uuid,
  kind text NOT NULL CHECK (kind IN ('openai_api_key', 'evolution_api_key', 'resend_api_key')),
  ciphertext bytea NOT NULL,
  iv bytea NOT NULL,
  auth_tag bytea NOT NULL,
  key_version int NOT NULL,
  last4 text NOT NULL CHECK (length(last4) <= 4),
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (store_id, org_id) REFERENCES stores (id, org_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX secrets_scope_key ON secrets (org_id, coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid), kind);

-- Configuração do agente por loja. Começa desligado até existir chave e canal.
CREATE TABLE ai_settings (
  store_id uuid PRIMARY KEY,
  org_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  model text NOT NULL DEFAULT 'gpt-5-mini',
  -- Teto diário de gasto com o modelo, em centavos de dólar (preços da OpenAI são em USD).
  daily_budget_usd_cents int NOT NULL DEFAULT 500 CHECK (daily_budget_usd_cents BETWEEN 0 AND 1000000),
  -- Trava anti-loop: máximo de respostas da IA por conversa numa janela de 1 hora.
  max_ai_replies_per_hour int NOT NULL DEFAULT 6 CHECK (max_ai_replies_per_hour BETWEEN 1 AND 30),
  max_reply_chars int NOT NULL DEFAULT 1200 CHECK (max_reply_chars BETWEEN 200 AND 4000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (store_id, org_id) REFERENCES stores (id, org_id) ON DELETE CASCADE
);
