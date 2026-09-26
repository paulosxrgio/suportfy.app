-- Isolamento por organização: RLS em todas as tabelas de dados e privilégios
-- mínimos para o papel da aplicação.

GRANT USAGE ON SCHEMA public TO suportfy_app;

-- Usuários: sem acesso ao hash de senha. Sessões: nenhum acesso.
GRANT SELECT (id, email, name, created_at) ON users TO suportfy_app;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_select ON users FOR SELECT TO suportfy_app
  USING (id = app.current_user_id() OR app.shares_org(id));

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE (name) ON organizations TO suportfy_app;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY organizations_select ON organizations FOR SELECT TO suportfy_app USING (app.is_member(id));
CREATE POLICY organizations_update ON organizations FOR UPDATE TO suportfy_app
  USING (app.has_role(id, 'admin')) WITH CHECK (app.has_role(id, 'admin'));

GRANT SELECT ON memberships TO suportfy_app;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY memberships_select ON memberships FOR SELECT TO suportfy_app USING (app.is_member(org_id));

-- Lojas, canais e configuração da IA: leitura para membros, escrita para admins.
-- Privilégios por coluna: a aplicação não troca a organização de uma loja nem
-- marca um canal como conectado; o estado do canal só muda em contexto de sistema,
-- depois de validar credenciais com o provedor.
GRANT SELECT, INSERT (org_id, name, shopify_domain), UPDATE (name, shopify_domain) ON stores TO suportfy_app;
GRANT SELECT, INSERT (org_id, store_id, kind, provider, address, config), UPDATE (address, config) ON channels TO suportfy_app;
GRANT SELECT, INSERT (store_id, org_id, enabled, model, daily_budget_usd_cents, max_ai_replies_per_hour, max_reply_chars),
  UPDATE (enabled, model, daily_budget_usd_cents, max_ai_replies_per_hour, max_reply_chars, updated_at) ON ai_settings TO suportfy_app;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY stores_select ON stores FOR SELECT TO suportfy_app USING (app.is_member(org_id));
CREATE POLICY stores_write ON stores FOR INSERT TO suportfy_app WITH CHECK (app.has_role(org_id, 'admin'));
CREATE POLICY stores_update ON stores FOR UPDATE TO suportfy_app
  USING (app.has_role(org_id, 'admin')) WITH CHECK (app.has_role(org_id, 'admin'));
CREATE POLICY channels_select ON channels FOR SELECT TO suportfy_app USING (app.is_member(org_id));
CREATE POLICY channels_insert ON channels FOR INSERT TO suportfy_app WITH CHECK (app.has_role(org_id, 'admin'));
CREATE POLICY channels_update ON channels FOR UPDATE TO suportfy_app
  USING (app.has_role(org_id, 'admin')) WITH CHECK (app.has_role(org_id, 'admin'));
CREATE POLICY ai_settings_select ON ai_settings FOR SELECT TO suportfy_app USING (app.is_member(org_id));
CREATE POLICY ai_settings_insert ON ai_settings FOR INSERT TO suportfy_app WITH CHECK (app.has_role(org_id, 'admin'));
CREATE POLICY ai_settings_update ON ai_settings FOR UPDATE TO suportfy_app
  USING (app.has_role(org_id, 'admin')) WITH CHECK (app.has_role(org_id, 'admin'));

-- Segredos: só metadados. Cifra, IV e tag nunca são legíveis pelo papel da
-- aplicação; gravação e leitura do valor acontecem em contexto de sistema.
GRANT SELECT (id, org_id, store_id, kind, last4, updated_by, created_at, updated_at) ON secrets TO suportfy_app;
ALTER TABLE secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY secrets_metadata_select ON secrets FOR SELECT TO suportfy_app USING (app.is_member(org_id));

-- Dados de atendimento: membros da organização leem. Pedidos chegam pela
-- sincronização da Shopify e mensagens/eventos pelo pipeline do agente, ambos
-- em contexto de sistema; por isso a aplicação só lê essas tabelas.
GRANT SELECT, INSERT (org_id, store_id, name, email, phone, external_id, source), UPDATE (name, email, phone) ON customers TO suportfy_app;
GRANT SELECT, UPDATE (status, ai_status, subject) ON conversations TO suportfy_app;
GRANT SELECT ON orders, messages, conversation_events, ai_usage TO suportfy_app;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_rw ON customers FOR ALL TO suportfy_app
  USING (app.is_member(org_id)) WITH CHECK (app.is_member(org_id));
CREATE POLICY orders_rw ON orders FOR ALL TO suportfy_app
  USING (app.is_member(org_id)) WITH CHECK (app.is_member(org_id));
CREATE POLICY conversations_rw ON conversations FOR ALL TO suportfy_app
  USING (app.is_member(org_id)) WITH CHECK (app.is_member(org_id));
CREATE POLICY messages_rw ON messages FOR ALL TO suportfy_app
  USING (app.is_member(org_id)) WITH CHECK (app.is_member(org_id));
CREATE POLICY conversation_events_rw ON conversation_events FOR ALL TO suportfy_app
  USING (app.is_member(org_id)) WITH CHECK (app.is_member(org_id));
CREATE POLICY ai_usage_select ON ai_usage FOR SELECT TO suportfy_app USING (app.is_member(org_id));
