# Esquema de banco proposto (PostgreSQL)

Proposta da Fase 0, ajustada ao que as fontes realmente entregam (ver [`fontes.md`](fontes.md)). Quando o ORM for escolhido, este texto vira migração.

## Decisões de modelagem

1. **Uma tabela `parlamentar` para deputados e senadores**, com `casa` (`CD` / `SF`) e o ID oficial (`id_fonte`). Na Câmara é o `id` do deputado; no Senado, o `CodigoParlamentar`. Quem mudou de Casa terá duas linhas, ligadas por `pessoa_id` (opcional e manual: não existe chave oficial comum e não guardamos CPF).
2. **Presença tem duas granularidades**, porque as fontes são diferentes:
   - `presenca_evento`: por evento ou votação (Câmara: lista de presentes por evento; Senado: código de comparecimento por votação nominal).
   - `presenca_resumo`: totais oficiais por período, como a Câmara publica no perfil (presenças / justificadas / não justificadas).
   O site mostra o número oficial quando ele existe e explica a origem.
3. **Votos guardam o valor original** (`tipo_voto_original`) e um valor normalizado (`tipo_voto`). Assim nada se perde e a Metodologia mostra a tabela de conversão.
4. **Todo registro que vem de fonte externa tem** `fonte_url`, `coletado_em` e `coleta_id` (ligado ao bruto guardado).
5. **Proposição única entre as Casas:** chave natural `(sigla, numero, ano)`, com IDs de cada Casa em colunas próprias.
6. **Horários sempre em `timestamptz`.** O texto original de horário (ex.: "11h45", fuso local) também é guardado quando a conversão depende de interpretação.
7. **Sem dado pessoal além do funcional** (sem CPF, sem endereço residencial). O CPF/CNPJ de fornecedor da cota parlamentar não é guardado quando for de pessoa física.

## Tabelas

```sql
-- Extensões para busca tolerante a erros e acentos
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ============ Controle de coleta ============
CREATE TABLE fonte (
  id            text PRIMARY KEY,           -- 'camara', 'senado', 'dou', 'planalto', 'stf', 'datajud'
  nome          text NOT NULL,
  url_base      text NOT NULL,
  falhas_seguidas int NOT NULL DEFAULT 0     -- alerta ao admin quando chegar a 3
);

CREATE TABLE coleta (                         -- log de cada execução (alimenta /status)
  id            bigserial PRIMARY KEY,
  fonte_id      text NOT NULL REFERENCES fonte(id),
  tarefa        text NOT NULL,              -- ex.: 'eventos_do_dia', 'votacoes', 'cadastro_parlamentares'
  iniciado_em   timestamptz NOT NULL,
  terminado_em  timestamptz,
  status        text NOT NULL CHECK (status IN ('rodando','ok','parcial','erro')),
  itens_lidos   int, itens_alterados int,
  erro          text
);

CREATE TABLE bruto (                          -- resposta original, para auditoria e reprocessamento
  id            bigserial PRIMARY KEY,
  coleta_id     bigint NOT NULL REFERENCES coleta(id),
  url           text NOT NULL,
  status_http   int NOT NULL,
  sha256        text NOT NULL,
  armazenamento text NOT NULL,              -- caminho no storage (ex.: S3/R2/Supabase Storage), gzip
  coletado_em   timestamptz NOT NULL
);
CREATE INDEX ON bruto (url, coletado_em DESC);

CREATE TABLE mudanca (                        -- eventos de detecção de mudança (alertas e linha do tempo)
  id            bigserial PRIMARY KEY,
  tipo          text NOT NULL,              -- 'nova_votacao','mudou_status','nova_publicacao','novo_evento','evento_mudou'...
  entidade      text NOT NULL,              -- 'proposicao','evento','votacao','ato_dou'...
  entidade_id   bigint NOT NULL,
  dados         jsonb NOT NULL,             -- antes/depois resumido
  detectado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON mudanca (entidade, entidade_id);

-- ============ Legislativo: cadastros ============
CREATE TABLE partido (
  id            serial PRIMARY KEY,
  sigla         text NOT NULL UNIQUE,
  nome          text,
  id_camara     int,                        -- /partidos
  fonte_url     text, coletado_em timestamptz
);

CREATE TABLE parlamentar (
  id            serial PRIMARY KEY,
  casa          text NOT NULL CHECK (casa IN ('CD','SF')),
  id_fonte      int  NOT NULL,              -- id da Câmara ou CodigoParlamentar do Senado
  pessoa_id     int,                        -- liga a mesma pessoa nas duas Casas (manual)
  nome_parlamentar text NOT NULL,
  nome_civil    text,
  sexo          text,
  partido_id    int REFERENCES partido(id),
  uf            char(2),
  url_foto      text,
  email         text,
  telefone      text,
  em_exercicio  boolean NOT NULL,
  situacao      text,                       -- 'Exercício','Licença','Afastado'...
  url_pagina_oficial text,
  slug          text NOT NULL UNIQUE,       -- URL amigável para SEO: /deputado/nome-uf
  busca         tsvector,                   -- full-text (unaccent)
  fonte_url     text NOT NULL, coletado_em timestamptz NOT NULL,
  UNIQUE (casa, id_fonte)
);
CREATE INDEX ON parlamentar USING gin (nome_parlamentar gin_trgm_ops);

CREATE TABLE mandato (
  id            serial PRIMARY KEY,
  parlamentar_id int NOT NULL REFERENCES parlamentar(id),
  legislatura   int NOT NULL,
  inicio        date, fim date,
  condicao      text,                       -- Titular/Suplente
  uf            char(2)
);

CREATE TABLE filiacao (                       -- histórico de partido (votos usam o partido na data)
  parlamentar_id int NOT NULL REFERENCES parlamentar(id),
  partido_id    int NOT NULL REFERENCES partido(id),
  inicio        date NOT NULL, fim date,
  PRIMARY KEY (parlamentar_id, partido_id, inicio)
);

CREATE TABLE licenca (                        -- Senado: /senador/{cod}/licencas
  id            serial PRIMARY KEY,
  parlamentar_id int NOT NULL REFERENCES parlamentar(id),
  inicio        date NOT NULL, fim date,
  tipo_sigla    text, tipo_descricao text,
  fonte_url     text NOT NULL, coletado_em timestamptz NOT NULL
);

CREATE TABLE orgao (                          -- comissões, plenários, CPIs, mesas
  id            serial PRIMARY KEY,
  casa          text NOT NULL CHECK (casa IN ('CD','SF','CN')),
  id_fonte      int NOT NULL,
  sigla         text, nome text NOT NULL, tipo text,
  UNIQUE (casa, id_fonte)
);

CREATE TABLE membro_orgao (
  parlamentar_id int NOT NULL REFERENCES parlamentar(id),
  orgao_id      int NOT NULL REFERENCES orgao(id),
  cargo         text,                       -- Titular, Suplente, Presidente...
  inicio        date NOT NULL, fim date,
  PRIMARY KEY (parlamentar_id, orgao_id, inicio)
);

-- ============ Legislativo: atividade ============
CREATE TABLE evento (                         -- sessões e reuniões (Câmara, Senado, Congresso)
  id            serial PRIMARY KEY,
  casa          text NOT NULL CHECK (casa IN ('CD','SF','CN')),
  id_fonte      text NOT NULL,              -- id do evento (Câmara) / CodigoSessao ou código da reunião (Senado)
  tipo          text NOT NULL,              -- texto original: 'Sessão Deliberativa', 'Reunião Deliberativa'...
  deliberativa  boolean,                    -- conta para presença?
  titulo        text,
  descricao     text,
  inicio        timestamptz NOT NULL,
  fim           timestamptz,
  status        text NOT NULL CHECK (status IN ('agendada','em_andamento','encerrada','cancelada','suspensa','adiada')),
  status_original text,                     -- 'Encerrada (Final)', 'Convocada'...
  local         text,
  link_video    text,                       -- Câmara: urlRegistro (YouTube)
  url_pauta     text,
  hash_conteudo text NOT NULL,              -- detecção de mudança
  fonte_url     text NOT NULL, coletado_em timestamptz NOT NULL,
  UNIQUE (casa, id_fonte)
);
CREATE INDEX ON evento (inicio);

CREATE TABLE evento_orgao (evento_id int REFERENCES evento(id), orgao_id int REFERENCES orgao(id), PRIMARY KEY (evento_id, orgao_id));

CREATE TABLE pauta_item (
  id            serial PRIMARY KEY,
  evento_id     int NOT NULL REFERENCES evento(id),
  ordem         int,
  titulo        text,
  proposicao_id int REFERENCES proposicao(id) DEFERRABLE INITIALLY DEFERRED,
  relator_id    int REFERENCES parlamentar(id),
  regime        text,
  situacao      text
);

CREATE TABLE presenca_evento (
  parlamentar_id int NOT NULL REFERENCES parlamentar(id),
  evento_id     int REFERENCES evento(id),
  votacao_id    int REFERENCES votacao(id) DEFERRABLE INITIALLY DEFERRED,  -- Senado: presença por votação nominal
  situacao      text NOT NULL CHECK (situacao IN ('presente','ausencia_justificada','ausencia_nao_justificada','nao_registrado')),
  codigo_original text,                     -- 'NCom','MIS','P-NRV'... (Senado)
  descricao_original text,
  CHECK (evento_id IS NOT NULL OR votacao_id IS NOT NULL)
);
CREATE UNIQUE INDEX ON presenca_evento (parlamentar_id, coalesce(evento_id,0), coalesce(votacao_id,0));

CREATE TABLE presenca_resumo (                -- totais oficiais (Câmara: página do perfil)
  parlamentar_id int NOT NULL REFERENCES parlamentar(id),
  ano           int NOT NULL,
  ambito        text NOT NULL CHECK (ambito IN ('plenario','comissoes')),
  presencas     int, ausencias_justificadas int, ausencias_nao_justificadas int,
  unidade       text NOT NULL,              -- 'dias' ou 'reunioes'
  fonte_url     text NOT NULL, coletado_em timestamptz NOT NULL,
  PRIMARY KEY (parlamentar_id, ano, ambito)
);

CREATE TABLE proposicao (
  id            serial PRIMARY KEY,
  sigla         text NOT NULL,              -- PL, PEC, MPV, PLP, PDL, VET...
  numero        int  NOT NULL,
  ano           int  NOT NULL,
  id_camara     int,                        -- /proposicoes/{id}
  id_senado     int,                        -- /processo/{id}
  codigo_materia_senado int,
  casa_iniciadora text,
  ementa        text,
  ementa_detalhada text,
  apelido       text,                       -- 'PEC da Segurança Pública' (Senado)
  situacao_atual text,
  situacao_casa text,                       -- onde está agora: CD/SF/sancao/veto/norma
  data_apresentacao date,
  url_inteiro_teor text,
  norma_gerada  text,                       -- 'Lei nº ...' quando houver
  palavras_chave text[],
  slug          text NOT NULL UNIQUE,       -- /proposicao/pl-2475-2025
  busca         tsvector,
  hash_conteudo text NOT NULL,
  atualizado_em timestamptz NOT NULL,
  UNIQUE (sigla, numero, ano)
);
CREATE INDEX ON proposicao USING gin (busca);

CREATE TABLE autoria (
  proposicao_id int NOT NULL REFERENCES proposicao(id),
  parlamentar_id int REFERENCES parlamentar(id),
  nome_autor    text NOT NULL,              -- autores não parlamentares (Poder Executivo, comissões...)
  tipo          text, proponente boolean, ordem int
);

CREATE TABLE tramitacao (
  id            bigserial PRIMARY KEY,
  proposicao_id int NOT NULL REFERENCES proposicao(id),
  casa          text NOT NULL,
  data_hora     timestamptz NOT NULL,
  sequencia     int,
  orgao_sigla   text,
  descricao     text,                       -- descricaoTramitacao
  situacao      text,                       -- descricaoSituacao
  despacho      text,
  url           text,
  UNIQUE (proposicao_id, casa, sequencia)
);

CREATE TABLE votacao (
  id            serial PRIMARY KEY,
  casa          text NOT NULL CHECK (casa IN ('CD','SF','CN')),
  id_fonte      text NOT NULL,              -- '2233802-416' (Câmara) / codigoSessaoVotacao (Senado)
  evento_id     int REFERENCES evento(id),
  proposicao_id int REFERENCES proposicao(id),
  data_hora     timestamptz NOT NULL,
  descricao     text NOT NULL,
  nominal       boolean NOT NULL,
  secreta       boolean NOT NULL DEFAULT false,
  aprovada      boolean,
  placar_sim    int, placar_nao int, placar_abstencao int, placar_obstrucao int,
  placar_calculado boolean NOT NULL,        -- true quando somamos os votos nós mesmos
  fonte_url     text NOT NULL, coletado_em timestamptz NOT NULL,
  UNIQUE (casa, id_fonte)
);
CREATE INDEX ON votacao (data_hora);

CREATE TABLE voto (
  votacao_id    int NOT NULL REFERENCES votacao(id),
  parlamentar_id int NOT NULL REFERENCES parlamentar(id),
  partido_sigla text,                       -- partido NA DATA do voto
  tipo_voto     text NOT NULL CHECK (tipo_voto IN ('sim','nao','abstencao','obstrucao','presidente','presente_sem_voto','ausente')),
  tipo_voto_original text NOT NULL,
  registrado_em timestamptz,
  PRIMARY KEY (votacao_id, parlamentar_id)
);
CREATE INDEX ON voto (parlamentar_id);

CREATE TABLE orientacao (
  votacao_id    int NOT NULL REFERENCES votacao(id),
  bancada       text NOT NULL,              -- sigla do partido/bloco ou 'Governo','Maioria','Minoria','Oposição'
  tipo_bancada  text,                       -- 'partido','bloco','governo','lideranca'
  orientacao    text NOT NULL,              -- 'sim','nao','liberado','obstrucao','abstencao'
  orientacao_original text NOT NULL,
  PRIMARY KEY (votacao_id, bancada)
);

CREATE TABLE despesa (                        -- cota parlamentar (CEAP) — Câmara (Senado: avaliar CEAPS em fase posterior)
  id            bigserial PRIMARY KEY,
  parlamentar_id int NOT NULL REFERENCES parlamentar(id),
  ano           int NOT NULL, mes int NOT NULL,
  categoria     text NOT NULL,              -- tipoDespesa
  data_documento date,
  valor_liquido numeric(12,2) NOT NULL,
  valor_glosa   numeric(12,2),
  fornecedor_nome text,
  fornecedor_cnpj text,                     -- só CNPJ; CPF de pessoa física não é guardado
  url_documento text,
  cod_documento bigint,
  UNIQUE (parlamentar_id, cod_documento)
);
CREATE INDEX ON despesa (parlamentar_id, ano, mes);

-- ============ Executivo ============
CREATE TABLE ato_dou (
  id            bigserial PRIMARY KEY,
  data_publicacao date NOT NULL,
  secao         text NOT NULL,              -- DO1, DO2, DO3, DO1E (extra)
  edicao        text,
  pagina        text,
  tipo          text NOT NULL,              -- artType: Lei, Decreto, Medida Provisória, Portaria...
  titulo        text NOT NULL,
  orgao         text,                       -- hierarchyStr
  resumo        text,                       -- início do texto oficial (sem reescrita)
  url           text NOT NULL,              -- https://www.in.gov.br/web/dou/-/{urlTitle}
  url_title     text NOT NULL UNIQUE,
  proposicao_id int REFERENCES proposicao(id),  -- sanção/veto ligado ao projeto (Fase 2)
  coletado_em   timestamptz NOT NULL
);
CREATE INDEX ON ato_dou (data_publicacao, tipo);

CREATE TABLE agenda_executivo (
  id            serial PRIMARY KEY,
  autoridade    text NOT NULL,              -- 'presidente', 'vice'
  data          date NOT NULL,
  inicio        timestamptz,                -- convertido para o fuso de Brasília
  inicio_texto  text,                       -- '11h45' como publicado
  fuso_aviso    text,                       -- 'Antália (Turquia) (Fuso horário: +6h...)'
  titulo        text NOT NULL,
  local         text,
  url           text NOT NULL,
  hash_conteudo text NOT NULL,
  coletado_em   timestamptz NOT NULL,
  UNIQUE (autoridade, data, titulo, inicio_texto)
);

CREATE TABLE veto (                           -- Senado /materia/vetos/{ano}
  id            serial PRIMARY KEY,
  codigo_senado int NOT NULL UNIQUE,
  numero        int NOT NULL, ano int NOT NULL,
  total         boolean,
  proposicao_id int REFERENCES proposicao(id),  -- matéria vetada
  ementa        text,
  em_tramitacao boolean,
  fonte_url     text NOT NULL, coletado_em timestamptz NOT NULL
);

-- ============ Judiciário (Fase 3 — depende da solução de acesso ao STF) ============
CREATE TABLE julgamento_stf (
  id            serial PRIMARY KEY,
  data          date NOT NULL,
  tipo_sessao   text,                       -- presencial / virtual
  classe        text, numero int,           -- ADI 7000
  relator       text,
  descricao     text,
  resultado     text,
  link_video    text,
  fonte_url     text NOT NULL, coletado_em timestamptz NOT NULL
);

CREATE TABLE processo (                       -- cache de consultas ao DataJud
  numero_cnj    text NOT NULL,              -- 20 dígitos
  tribunal      text NOT NULL,
  grau          text,
  classe        text, orgao_julgador text,
  assuntos      jsonb, movimentos jsonb,
  data_ajuizamento timestamptz,
  atualizado_fonte timestamptz,             -- dataHoraUltimaAtualizacao
  coletado_em   timestamptz NOT NULL,
  PRIMARY KEY (numero_cnj, tribunal, grau)
);

-- ============ Usuários e alertas (Fase 4) ============
CREATE TABLE usuario (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text UNIQUE,
  telegram_chat_id text UNIQUE,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE inscricao_alerta (
  id            serial PRIMARY KEY,
  usuario_id    uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  alvo_tipo     text NOT NULL CHECK (alvo_tipo IN ('parlamentar','proposicao','tema')),
  alvo_id       int, tema text,
  canais        text[] NOT NULL,            -- {'push','email','telegram'}
  frequencia    text NOT NULL DEFAULT 'imediato'  -- imediato / diario / semanal
);

CREATE TABLE push_assinatura (
  id            serial PRIMARY KEY,
  usuario_id    uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  endpoint      text NOT NULL UNIQUE, p256dh text NOT NULL, auth text NOT NULL
);

CREATE TABLE notificacao (
  id            bigserial PRIMARY KEY,
  usuario_id    uuid NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  mudanca_id    bigint NOT NULL REFERENCES mudanca(id),
  canal         text NOT NULL,
  enviado_em    timestamptz,
  erro          text,
  UNIQUE (usuario_id, mudanca_id, canal)
);

-- ============ Reporte de erro pelo cidadão ============
CREATE TABLE reporte_erro (
  id            serial PRIMARY KEY,
  url_pagina    text NOT NULL,
  descricao     text NOT NULL,
  email_contato text,
  status        text NOT NULL DEFAULT 'aberto',
  criado_em     timestamptz NOT NULL DEFAULT now()
);
```

> As referências circulares (`pauta_item` → `proposicao`, `presenca_evento` → `votacao`) aparecem como `DEFERRABLE` só para manter a leitura por assunto. Na migração real, as tabelas serão criadas na ordem certa.

## Tabelas de conversão (documentadas na página Metodologia)

**Câmara — `tipoVoto` → `tipo_voto`:** `Sim`→sim · `Não`→nao · `Abstenção`→abstencao · `Obstrução`→obstrucao · `Artigo 17`→presidente. Quem não aparece na lista de votos não ganha linha em `voto`: o site mostra "não registrou voto" sem afirmar o motivo.

**Senado — `siglaVotoParlamentar`:** `Sim`/`Não`/`Abstenção` → voto · `P-NRV` → presente_sem_voto · `Presidente (art. 51 RISF)` → presidente · `MIS`, `AP`, `L*`, `LAP`, `LAF`… → ausente + presença `ausencia_justificada` · `NCom` → ausente + presença `ausencia_nao_justificada`. A lista completa vem de `/plenario/lista/tiposComparecimento` e é sincronizada 1× por mês.
