-- Clientes e pedidos das lojas. Pedidos são dados de contexto da IA:
-- não há tela independente de pedidos, mas o agente precisa consultá-los.

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  store_id uuid NOT NULL,
  name text NOT NULL DEFAULT '' CHECK (length(name) <= 200),
  email text CHECK (email IS NULL OR email = lower(email)),
  phone text CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{8,15}$'),
  external_id text,
  -- 'demo' marca dados de exemplo; 'shopify' quando vier da integração real.
  source text NOT NULL DEFAULT 'shopify' CHECK (source IN ('shopify', 'channel', 'demo')),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (store_id, org_id) REFERENCES stores (id, org_id) ON DELETE CASCADE,
  UNIQUE (id, store_id)
);
CREATE INDEX customers_store_idx ON customers (store_id);
CREATE UNIQUE INDEX customers_store_email_key ON customers (store_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX customers_store_phone_key ON customers (store_id, phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX customers_store_external_key ON customers (store_id, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  store_id uuid NOT NULL,
  customer_id uuid,
  -- Número exibido ao cliente (ex.: "#AU1019").
  number text NOT NULL CHECK (length(number) BETWEEN 1 AND 40),
  external_id text,
  financial_status text NOT NULL CHECK (financial_status IN ('pending', 'paid', 'refunded', 'partially_refunded', 'voided')),
  fulfillment_status text NOT NULL CHECK (fulfillment_status IN ('unfulfilled', 'in_transit', 'delivered', 'cancelled')),
  total_cents bigint NOT NULL CHECK (total_cents >= 0),
  currency char(3) NOT NULL DEFAULT 'BRL',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  tracking jsonb,
  placed_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'shopify' CHECK (source IN ('shopify', 'demo')),
  synced_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (store_id, org_id) REFERENCES stores (id, org_id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id, store_id) REFERENCES customers (id, store_id) ON DELETE SET NULL (customer_id),
  UNIQUE (store_id, number)
);
CREATE INDEX orders_customer_idx ON orders (customer_id);
CREATE UNIQUE INDEX orders_store_external_key ON orders (store_id, external_id) WHERE external_id IS NOT NULL;
