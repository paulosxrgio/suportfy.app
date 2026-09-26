-- Conexão real do canal WhatsApp (Evolution API).

-- Chave, gerada pelo servidor, com que a Evolution API assina (JWT HS256) cada
-- entrega de webhook deste canal.
ALTER TABLE secrets DROP CONSTRAINT secrets_kind_check;
ALTER TABLE secrets ADD CONSTRAINT secrets_kind_check
  CHECK (kind IN ('openai_api_key', 'evolution_api_key', 'resend_api_key', 'evolution_webhook_key'));

-- Último estado informado pelo provedor e quando foi conferido.
ALTER TABLE channels ADD COLUMN provider_state text CHECK (provider_state IN ('open', 'connecting', 'close'));
ALTER TABLE channels ADD COLUMN last_checked_at timestamptz;
