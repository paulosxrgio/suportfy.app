-- Fundação: papel da aplicação e funções de acesso usadas pelas políticas RLS.
--
-- Modelo de acesso:
-- * O usuário que roda as migrations é dono das tabelas e só é usado pelo
--   servidor em operações de sistema (login, webhooks, leitura de segredos).
-- * Toda requisição de um usuário autenticado roda numa transação com
--   `SET LOCAL ROLE suportfy_app` e `app.user_id` definido. As políticas RLS
--   abaixo valem para esse papel.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'suportfy_app') THEN
    CREATE ROLE suportfy_app NOLOGIN;
  END IF;
END
$$;

-- Permite que a conexão do servidor assuma o papel restrito com SET LOCAL ROLE.
GRANT suportfy_app TO CURRENT_USER;

CREATE SCHEMA IF NOT EXISTS app;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO suportfy_app;

-- Usuário da requisição atual, definido pelo servidor com set_config(..., true).
CREATE FUNCTION app.current_user_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;

CREATE TYPE app.member_role AS ENUM ('owner', 'admin', 'member');

CREATE FUNCTION app.role_rank(r app.member_role) RETURNS int
  LANGUAGE sql IMMUTABLE
  AS $$ SELECT CASE r WHEN 'owner' THEN 3 WHEN 'admin' THEN 2 ELSE 1 END $$;
