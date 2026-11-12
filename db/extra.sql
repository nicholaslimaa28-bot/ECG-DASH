-- Executado depois das migrações do Drizzle (idempotente).
-- Busca tolerante a erros de digitação e acentos.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() não é IMMUTABLE; este invólucro permite usá-lo em índices.
CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
  AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE INDEX IF NOT EXISTS parlamentar_nome_trgm ON parlamentar USING gin (lower(f_unaccent(nome_parlamentar)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS proposicao_ementa_fts ON proposicao USING gin (to_tsvector('portuguese', f_unaccent(coalesce(ementa,'') || ' ' || coalesce(apelido,''))));
CREATE INDEX IF NOT EXISTS proposicao_apelido_trgm ON proposicao USING gin (lower(f_unaccent(coalesce(apelido,''))) gin_trgm_ops);

-- Fontes conhecidas
INSERT INTO fonte (id, nome, url_base) VALUES
  ('camara', 'Câmara dos Deputados', 'https://dadosabertos.camara.leg.br'),
  ('senado', 'Senado Federal / Congresso Nacional', 'https://legis.senado.leg.br/dadosabertos'),
  ('planalto', 'Presidência da República — agenda', 'https://www.gov.br/planalto/pt-br/acompanhe-o-planalto')
ON CONFLICT (id) DO NOTHING;
