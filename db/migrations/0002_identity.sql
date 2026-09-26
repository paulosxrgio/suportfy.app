-- Usuários, sessões, organizações e vínculos.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (email);

-- Guarda só o hash SHA-256 do token; o token em si fica apenas no cookie httpOnly.
CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role app.member_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX memberships_user_idx ON memberships (user_id);

-- Funções de acesso. SECURITY DEFINER para ler memberships sem recursão de RLS;
-- search_path fixo para não ser sequestrado.
CREATE FUNCTION app.is_member(target_org uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.org_id = target_org AND m.user_id = app.current_user_id()
    )
  $$;

CREATE FUNCTION app.has_role(target_org uuid, minimum app.member_role) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.org_id = target_org AND m.user_id = app.current_user_id()
        AND app.role_rank(m.role) >= app.role_rank(minimum)
    )
  $$;

CREATE FUNCTION app.shares_org(other_user uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.memberships a
      JOIN public.memberships b ON a.org_id = b.org_id
      WHERE a.user_id = app.current_user_id() AND b.user_id = other_user
    )
  $$;

REVOKE ALL ON FUNCTION app.is_member(uuid), app.has_role(uuid, app.member_role), app.shares_org(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.is_member(uuid), app.has_role(uuid, app.member_role), app.shares_org(uuid),
  app.current_user_id(), app.role_rank(app.member_role) TO suportfy_app;
