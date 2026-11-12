// Consultas usadas pelas páginas (somente leitura). SQL direto para deixar claro o que é calculado.
import { sql } from "@/lib/db";
import type { ItemPauta } from "@/lib/db/schema";

export type Evento = {
  id: number; casa: string; tipo: string; titulo: string; descricao: string | null; orgaos: string | null;
  inicio: Date; fim: Date | null; status: string; statusOriginal: string | null; local: string | null;
  linkVideo: string | null; urlPauta: string | null; pauta: ItemPauta[] | null; deliberativa: boolean | null;
  fonteUrl: string; coletadoEm: Date;
};

const camposEvento = sql`
  id, casa, tipo, titulo, descricao, orgaos, inicio, fim, status, status_original AS "statusOriginal", local,
  link_video AS "linkVideo", url_pauta AS "urlPauta", pauta, deliberativa, fonte_url AS "fonteUrl", coletado_em AS "coletadoEm"`;

/** Eventos de um intervalo [de, ate) em horário de Brasília (datas AAAA-MM-DD). */
export async function eventosEntre(de: string, ate: string): Promise<Evento[]> {
  return sql<Evento[]>`
    SELECT ${camposEvento} FROM evento
    WHERE inicio >= (${de}::date)::timestamp AT TIME ZONE 'America/Sao_Paulo' AND inicio < (${ate}::date)::timestamp AT TIME ZONE 'America/Sao_Paulo'
    ORDER BY inicio, casa, id`;
}

export async function evento(id: number): Promise<Evento | null> {
  const [e] = await sql<Evento[]>`SELECT ${camposEvento} FROM evento WHERE id = ${id}`;
  return e ?? null;
}

export type Votacao = {
  id: number; casa: string; dataHora: Date; descricao: string; nominal: boolean; secreta: boolean; aprovada: boolean | null;
  placarSim: number | null; placarNao: number | null; placarAbstencao: number | null; placarObstrucao: number | null;
  placarCalculado: boolean; fonteUrl: string; coletadoEm: Date; eventoId: number | null;
  proposicao: { sigla: string; numero: number; ano: number; slug: string; ementa: string | null; apelido: string | null } | null;
};

const camposVotacao = sql`
  v.id, v.casa, v.data_hora AS "dataHora", v.descricao, v.nominal, v.secreta, v.aprovada,
  v.placar_sim AS "placarSim", v.placar_nao AS "placarNao", v.placar_abstencao AS "placarAbstencao", v.placar_obstrucao AS "placarObstrucao",
  v.placar_calculado AS "placarCalculado", v.fonte_url AS "fonteUrl", v.coletado_em AS "coletadoEm", v.evento_id AS "eventoId",
  CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object('sigla', p.sigla, 'numero', p.numero, 'ano', p.ano, 'slug', p.slug, 'ementa', p.ementa, 'apelido', p.apelido) END AS proposicao`;

export async function votacoesEntre(de: string, ate: string, apenasNominais = false): Promise<Votacao[]> {
  return sql<Votacao[]>`
    SELECT ${camposVotacao} FROM votacao v LEFT JOIN proposicao p ON p.id = v.proposicao_id
    WHERE v.data_hora >= (${de}::date)::timestamp AT TIME ZONE 'America/Sao_Paulo' AND v.data_hora < (${ate}::date)::timestamp AT TIME ZONE 'America/Sao_Paulo'
      ${apenasNominais ? sql`AND v.nominal` : sql``}
    ORDER BY v.data_hora DESC`;
}

export async function votacoesDoEvento(eventoId: number): Promise<Votacao[]> {
  return sql<Votacao[]>`
    SELECT ${camposVotacao} FROM votacao v LEFT JOIN proposicao p ON p.id = v.proposicao_id
    WHERE v.evento_id = ${eventoId} ORDER BY v.data_hora`;
}

export async function votacoesDaProposicao(proposicaoId: number): Promise<Votacao[]> {
  return sql<Votacao[]>`
    SELECT ${camposVotacao} FROM votacao v LEFT JOIN proposicao p ON p.id = v.proposicao_id
    WHERE v.proposicao_id = ${proposicaoId} ORDER BY v.data_hora DESC`;
}

export type Orientacao = { bancada: string; tipoBancada: string | null; orientacao: string; orientacaoOriginal: string };

export async function orientacoes(votacaoIds: number[]): Promise<Map<number, Orientacao[]>> {
  if (!votacaoIds.length) return new Map();
  const linhas = await sql<(Orientacao & { votacaoId: number })[]>`
    SELECT votacao_id AS "votacaoId", bancada, tipo_bancada AS "tipoBancada", orientacao, orientacao_original AS "orientacaoOriginal"
    FROM orientacao WHERE votacao_id IN ${sql(votacaoIds)} ORDER BY tipo_bancada DESC, bancada`;
  const m = new Map<number, Orientacao[]>();
  for (const l of linhas) m.set(l.votacaoId, [...(m.get(l.votacaoId) ?? []), l]);
  return m;
}

export type VotoNominal = { nome: string; slug: string; partido: string | null; uf: string | null; tipoVoto: string; tipoVotoOriginal: string };

export async function votosDaVotacao(votacaoId: number): Promise<VotoNominal[]> {
  return sql<VotoNominal[]>`
    SELECT p.nome_parlamentar AS nome, p.slug, coalesce(v.partido, p.partido) AS partido, p.uf, v.tipo_voto AS "tipoVoto", v.tipo_voto_original AS "tipoVotoOriginal"
    FROM voto v JOIN parlamentar p ON p.id = v.parlamentar_id WHERE v.votacao_id = ${votacaoId}
    ORDER BY p.nome_parlamentar`;
}

// ---------------- Parlamentares ----------------

export type Parlamentar = {
  id: number; casa: string; idFonte: number; nome: string; nomeCivil: string | null; partido: string | null; uf: string | null;
  urlFoto: string | null; email: string | null; telefone: string | null; emExercicio: boolean; situacao: string | null;
  urlPaginaOficial: string | null; slug: string; fonteUrl: string; coletadoEm: Date;
};

const camposParl = sql`
  id, casa, id_fonte AS "idFonte", nome_parlamentar AS nome, nome_civil AS "nomeCivil", partido, uf, url_foto AS "urlFoto",
  email, telefone, em_exercicio AS "emExercicio", situacao, url_pagina_oficial AS "urlPaginaOficial", slug,
  fonte_url AS "fonteUrl", coletado_em AS "coletadoEm"`;

export async function parlamentarPorSlug(slug: string): Promise<Parlamentar | null> {
  const [p] = await sql<Parlamentar[]>`SELECT ${camposParl} FROM parlamentar WHERE slug = ${slug}`;
  return p ?? null;
}

export async function listarParlamentares(f: { casa?: string; uf?: string; partido?: string }): Promise<Parlamentar[]> {
  return sql<Parlamentar[]>`
    SELECT ${camposParl} FROM parlamentar
    WHERE em_exercicio
      ${f.casa ? sql`AND casa = ${f.casa}` : sql``}
      ${f.uf ? sql`AND uf = ${f.uf}` : sql``}
      ${f.partido ? sql`AND partido = ${f.partido}` : sql``}
    ORDER BY lower(f_unaccent(nome_parlamentar))`;
}

export async function filtrosParlamentares(): Promise<{ ufs: string[]; partidos: string[] }> {
  const ufs = await sql<{ v: string }[]>`SELECT DISTINCT uf AS v FROM parlamentar WHERE em_exercicio AND uf IS NOT NULL ORDER BY 1`;
  const partidos = await sql<{ v: string }[]>`SELECT DISTINCT partido AS v FROM parlamentar WHERE em_exercicio AND partido IS NOT NULL ORDER BY 1`;
  return { ufs: ufs.map((x) => x.v), partidos: partidos.map((x) => x.v) };
}

export type PresencaResumo = { ano: number; ambito: string; presencas: number | null; ausenciasJustificadas: number | null; ausenciasNaoJustificadas: number | null; unidade: string; fonteUrl: string; coletadoEm: Date };

export async function presencaResumo(parlamentarId: number): Promise<PresencaResumo[]> {
  return sql<PresencaResumo[]>`
    SELECT ano, ambito, presencas, ausencias_justificadas AS "ausenciasJustificadas", ausencias_nao_justificadas AS "ausenciasNaoJustificadas",
      unidade, fonte_url AS "fonteUrl", coletado_em AS "coletadoEm"
    FROM presenca_resumo WHERE parlamentar_id = ${parlamentarId} ORDER BY ano DESC, ambito DESC`;
}

/** Senado: presença por votação nominal, por mês, separando os motivos oficiais. */
export async function presencaSenadoPorMes(parlamentarId: number, ano: number) {
  return sql<{ mes: number; presente: number; justificada: number; naoJustificada: number; total: number }[]>`
    SELECT extract(month FROM v.data_hora AT TIME ZONE 'America/Sao_Paulo')::int AS mes,
      count(*) FILTER (WHERE pv.situacao = 'presente')::int AS presente,
      count(*) FILTER (WHERE pv.situacao = 'ausencia_justificada')::int AS justificada,
      count(*) FILTER (WHERE pv.situacao = 'ausencia_nao_justificada')::int AS "naoJustificada",
      count(*)::int AS total
    FROM presenca_votacao pv JOIN votacao v ON v.id = pv.votacao_id
    WHERE pv.parlamentar_id = ${parlamentarId} AND extract(year FROM v.data_hora AT TIME ZONE 'America/Sao_Paulo') = ${ano}
    GROUP BY 1 ORDER BY 1`;
}

export async function motivosAusenciaSenado(parlamentarId: number, ano: number) {
  return sql<{ codigo: string; descricao: string | null; vezes: number }[]>`
    SELECT pv.codigo_original AS codigo, max(pv.descricao_original) AS descricao, count(*)::int AS vezes
    FROM presenca_votacao pv JOIN votacao v ON v.id = pv.votacao_id
    WHERE pv.parlamentar_id = ${parlamentarId} AND pv.situacao <> 'presente'
      AND extract(year FROM v.data_hora AT TIME ZONE 'America/Sao_Paulo') = ${ano}
    GROUP BY 1 ORDER BY 3 DESC`;
}

export type VotoDoParlamentar = {
  votacaoId: number; dataHora: Date; descricao: string; aprovada: boolean | null; tipoVoto: string; tipoVotoOriginal: string;
  partido: string | null; orientacaoPartido: string | null; orientacaoGoverno: string | null; haOrientacaoDeBloco: boolean;
  proposicao: { sigla: string; numero: number; ano: number; slug: string; ementa: string | null } | null;
};

/** Votos nominais com a orientação do partido do parlamentar (na data) e a do Governo, lado a lado. */
export async function votosDoParlamentar(parlamentarId: number, limite = 50, busca?: string): Promise<VotoDoParlamentar[]> {
  const filtro = busca ? `%${busca}%` : null;
  return sql<VotoDoParlamentar[]>`
    SELECT v.id AS "votacaoId", v.data_hora AS "dataHora", v.descricao, v.aprovada, vo.tipo_voto AS "tipoVoto",
      vo.tipo_voto_original AS "tipoVotoOriginal", vo.partido,
      -- Orientação do partido; se o partido votou dentro de federação/bloco, usa a orientação da federação que o contém
      (SELECT o.orientacao FROM orientacao o WHERE o.votacao_id = v.id
         AND (upper(f_unaccent(o.bancada)) = upper(f_unaccent(vo.partido))
              OR upper(f_unaccent(o.bancada)) ~ ('(^|[^A-Z])' || upper(f_unaccent(vo.partido)) || '([^A-Z]|$)'))
       ORDER BY (upper(f_unaccent(o.bancada)) = upper(f_unaccent(vo.partido))) DESC LIMIT 1) AS "orientacaoPartido",
      (SELECT o.orientacao FROM orientacao o WHERE o.votacao_id = v.id AND o.tipo_bancada = 'governo' LIMIT 1) AS "orientacaoGoverno",
      -- A Câmara publica blocos com nome abreviado (ex.: "Bl UniPpPsd..."), sem dizer quais partidos contêm:
      -- não ligamos partido a bloco por adivinhação; só sinalizamos que houve orientação de bloco
      EXISTS (SELECT 1 FROM orientacao o WHERE o.votacao_id = v.id AND o.tipo_bancada = 'bloco') AS "haOrientacaoDeBloco",
      CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object('sigla', p.sigla, 'numero', p.numero, 'ano', p.ano, 'slug', p.slug, 'ementa', p.ementa) END AS proposicao
    FROM voto vo JOIN votacao v ON v.id = vo.votacao_id LEFT JOIN proposicao p ON p.id = v.proposicao_id
    WHERE vo.parlamentar_id = ${parlamentarId}
      ${filtro ? sql`AND (f_unaccent(v.descricao) ILIKE f_unaccent(${filtro}) OR f_unaccent(coalesce(p.ementa,'')) ILIKE f_unaccent(${filtro}))` : sql``}
    ORDER BY v.data_hora DESC LIMIT ${limite}`;
}

export async function proposicoesDoAutor(parlamentarId: number, limite = 30) {
  return sql<{ sigla: string; numero: number; ano: number; slug: string; ementa: string | null; situacao: string | null }[]>`
    SELECT p.sigla, p.numero, p.ano, p.slug, p.ementa, coalesce(p.situacao_senado, p.situacao_camara) AS situacao
    FROM autoria a JOIN proposicao p ON p.id = a.proposicao_id
    WHERE a.parlamentar_id = ${parlamentarId}
    ORDER BY p.ano DESC, p.numero DESC LIMIT ${limite}`;
}

export async function totalProposicoesDoAutor(parlamentarId: number): Promise<number> {
  const [r] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM autoria WHERE parlamentar_id = ${parlamentarId}`;
  return r.n;
}

export async function despesasPorCategoria(parlamentarId: number, ano: number) {
  return sql<{ categoria: string; total: string; documentos: number }[]>`
    SELECT categoria, sum(valor)::text AS total, count(*)::int AS documentos FROM despesa
    WHERE parlamentar_id = ${parlamentarId} AND ano = ${ano} GROUP BY 1 ORDER BY sum(valor) DESC`;
}

export async function despesasPorMes(parlamentarId: number, ano: number) {
  return sql<{ mes: number; total: string }[]>`
    SELECT mes, sum(valor)::text AS total FROM despesa WHERE parlamentar_id = ${parlamentarId} AND ano = ${ano} GROUP BY 1 ORDER BY 1`;
}

export async function licencasRecentes(parlamentarId: number, limite = 10) {
  return sql<{ inicio: string; fim: string | null; tipo: string | null }[]>`
    SELECT inicio::text, fim::text, coalesce(tipo_descricao, tipo_sigla) AS tipo FROM licenca
    WHERE parlamentar_id = ${parlamentarId} ORDER BY inicio DESC LIMIT ${limite}`;
}

export async function eventosPresentes(parlamentarId: number, limite = 10) {
  return sql<{ id: number; titulo: string; inicio: Date }[]>`
    SELECT e.id, e.titulo, e.inicio FROM presenca_evento pe JOIN evento e ON e.id = pe.evento_id
    WHERE pe.parlamentar_id = ${parlamentarId} ORDER BY e.inicio DESC LIMIT ${limite}`;
}

// ---------------- Proposições ----------------

export type Proposicao = {
  id: number; sigla: string; numero: number; ano: number; idCamara: number | null; idSenado: number | null; casaIniciadora: string | null;
  ementa: string | null; apelido: string | null; situacaoCamara: string | null; situacaoSenado: string | null;
  dataApresentacao: string | null; urlInteiroTeor: string | null; slug: string; atualizadoEm: Date;
  normaGerada: string | null; urlNorma: string | null; dataNorma: string | null;
};

export async function proposicaoPorSlug(slug: string): Promise<Proposicao | null> {
  const [p] = await sql<Proposicao[]>`
    SELECT id, sigla, numero, ano, id_camara AS "idCamara", id_senado AS "idSenado", casa_iniciadora AS "casaIniciadora", ementa, apelido,
      situacao_camara AS "situacaoCamara", situacao_senado AS "situacaoSenado", data_apresentacao::text AS "dataApresentacao",
      url_inteiro_teor AS "urlInteiroTeor", slug, atualizado_em AS "atualizadoEm",
      norma_gerada AS "normaGerada", url_norma AS "urlNorma", data_norma::text AS "dataNorma"
    FROM proposicao WHERE slug = ${slug}`;
  return p ?? null;
}

export async function tramitacoes(proposicaoId: number) {
  return sql<{ casa: string; dataHora: Date; orgao: string | null; descricao: string | null; situacao: string | null; despacho: string | null; url: string | null }[]>`
    SELECT casa, data_hora AS "dataHora", orgao_sigla AS orgao, descricao, situacao, despacho, url
    FROM tramitacao WHERE proposicao_id = ${proposicaoId} ORDER BY data_hora DESC, sequencia DESC`;
}

export async function autoresDaProposicao(proposicaoId: number) {
  return sql<{ nome: string; slug: string; partido: string | null; uf: string | null; casa: string }[]>`
    SELECT p.nome_parlamentar AS nome, p.slug, p.partido, p.uf, p.casa FROM autoria a JOIN parlamentar p ON p.id = a.parlamentar_id
    WHERE a.proposicao_id = ${proposicaoId} ORDER BY p.nome_parlamentar`;
}

// ---------------- Busca ----------------

export type ResultadoBusca =
  | { tipo: "parlamentar"; titulo: string; detalhe: string; url: string }
  | { tipo: "proposicao"; titulo: string; detalhe: string; url: string }
  | { tipo: "sessao"; titulo: string; detalhe: string; url: string };

/** Busca unificada: número de proposição ("PL 2475/2025"), nome de parlamentar (tolerante a erros) e palavras da ementa. */
export async function buscar(q: string, limite = 20): Promise<ResultadoBusca[]> {
  const termo = q.trim();
  if (termo.length < 2) return [];
  const resultados: ResultadoBusca[] = [];

  // 1) Número de proposição: "PL 2475/2025", "pec 18 2025", "PL2475/25"
  const m = termo.match(/^([a-zA-Z]{2,4})\s*\.?\s*(\d[\d.]*)\s*(?:\/|\s|de)\s*(\d{2,4})$/i);
  if (m) {
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const props = await sql<{ slug: string; sigla: string; numero: number; ano: number; ementa: string | null }[]>`
      SELECT slug, sigla, numero, ano, ementa FROM proposicao WHERE upper(sigla) = ${m[1].toUpperCase()} AND numero = ${Number(m[2].replace(/\./g, ""))} AND ano = ${ano}`;
    for (const p of props) resultados.push({ tipo: "proposicao", titulo: `${p.sigla} ${p.numero}/${p.ano}`, detalhe: p.ementa ?? "", url: `/proposicao/${p.slug}` });
  }

  // 2) Parlamentares: similaridade de trigramas sem acento (tolera erros de digitação)
  const parl = await sql<{ nome: string; slug: string; casa: string; partido: string | null; uf: string | null; emExercicio: boolean }[]>`
    SELECT nome_parlamentar AS nome, slug, casa, partido, uf, em_exercicio AS "emExercicio"
    FROM parlamentar
    WHERE lower(f_unaccent(nome_parlamentar)) % lower(f_unaccent(${termo}))
       OR lower(f_unaccent(nome_parlamentar)) LIKE '%' || lower(f_unaccent(${termo})) || '%'
    ORDER BY em_exercicio DESC, similarity(lower(f_unaccent(nome_parlamentar)), lower(f_unaccent(${termo}))) DESC
    LIMIT 8`;
  for (const p of parl) {
    resultados.push({
      tipo: "parlamentar", titulo: p.nome, url: `/parlamentar/${p.slug}`,
      detalhe: `${p.casa === "CD" ? "Deputado(a)" : "Senador(a)"} · ${p.partido ?? "sem partido"}-${p.uf ?? ""}${p.emExercicio ? "" : " · fora de exercício"}`,
    });
  }

  // 3) Proposições por palavras da ementa ou apelido (full-text em português, sem acento)
  if (!m) {
    const props = await sql<{ slug: string; sigla: string; numero: number; ano: number; ementa: string | null; apelido: string | null }[]>`
      SELECT slug, sigla, numero, ano, ementa, apelido FROM proposicao
      WHERE to_tsvector('portuguese', f_unaccent(coalesce(ementa,'') || ' ' || coalesce(apelido,''))) @@ plainto_tsquery('portuguese', f_unaccent(${termo}))
      ORDER BY ts_rank(to_tsvector('portuguese', f_unaccent(coalesce(ementa,'') || ' ' || coalesce(apelido,''))), plainto_tsquery('portuguese', f_unaccent(${termo}))) DESC, ano DESC
      LIMIT ${limite}`;
    for (const p of props) resultados.push({ tipo: "proposicao", titulo: `${p.sigla} ${p.numero}/${p.ano}${p.apelido ? ` — ${p.apelido}` : ""}`, detalhe: p.ementa ?? "", url: `/proposicao/${p.slug}` });
  }
  return resultados.slice(0, limite);
}

// ---------------- Status das coletas ----------------

export async function statusFontes() {
  const fontes = await sql<{ id: string; nome: string; urlBase: string; falhasSeguidas: number }[]>`
    SELECT id, nome, url_base AS "urlBase", falhas_seguidas AS "falhasSeguidas" FROM fonte ORDER BY id`;
  const tarefas = await sql<{ fonteId: string; tarefa: string; ultimaOk: Date | null; ultima: Date; ultimoStatus: string; ultimoErro: string | null; itens: number | null }[]>`
    SELECT DISTINCT ON (fonte_id, tarefa) fonte_id AS "fonteId", tarefa,
      (SELECT max(terminado_em) FROM coleta c2 WHERE c2.fonte_id = c.fonte_id AND c2.tarefa = c.tarefa AND c2.status = 'ok') AS "ultimaOk",
      iniciado_em AS ultima, status AS "ultimoStatus", erro AS "ultimoErro", itens_lidos AS itens
    FROM coleta c ORDER BY fonte_id, tarefa, iniciado_em DESC`;
  const falhas = await sql<{ fonteId: string; tarefa: string; iniciadoEm: Date; erro: string | null }[]>`
    SELECT fonte_id AS "fonteId", tarefa, iniciado_em AS "iniciadoEm", erro FROM coleta
    WHERE status IN ('erro', 'parcial') ORDER BY iniciado_em DESC LIMIT 10`;
  return { fontes, tarefas, falhas };
}

/** Horário da última coleta bem-sucedida de uma tarefa (para o rodapé "atualizado às"). */
export async function ultimaColeta(fonteId: string, tarefa: string): Promise<Date | null> {
  const [r] = await sql<{ t: Date | null }[]>`
    SELECT max(terminado_em) AS t FROM coleta WHERE fonte_id = ${fonteId} AND tarefa = ${tarefa} AND status IN ('ok','parcial')`;
  return r?.t ?? null;
}

// ---------------- Executivo: agenda do Presidente ----------------

export type DiaAgenda = { data: string; publicada: boolean; aviso: string | null; fusoMin: number | null; url: string; coletadoEm: Date } | null;
export type CompromissoAgenda = { inicio: Date | null; inicioTexto: string | null; horaLocal: boolean; titulo: string; local: string | null; url: string | null };

export async function agendaPresidente(dia: string): Promise<{ dia: DiaAgenda; compromissos: CompromissoAgenda[] }> {
  const [d] = await sql<NonNullable<DiaAgenda>[]>`
    SELECT data::text, publicada, aviso, fuso_min AS "fusoMin", url, coletado_em AS "coletadoEm"
    FROM agenda_dia WHERE autoridade = 'presidente' AND data = ${dia}`;
  const compromissos = await sql<CompromissoAgenda[]>`
    SELECT inicio, inicio_texto AS "inicioTexto", hora_local AS "horaLocal", titulo, local, url
    FROM agenda_executivo WHERE autoridade = 'presidente' AND data = ${dia} ORDER BY ordem`;
  return { dia: d ?? null, compromissos };
}

export async function diasComAgenda(limite = 14): Promise<string[]> {
  const r = await sql<{ data: string }[]>`
    SELECT data::text FROM agenda_dia WHERE autoridade = 'presidente' AND publicada ORDER BY data DESC LIMIT ${limite}`;
  return r.map((x) => x.data);
}

// ---------------- Sanções, vetos, leis e MPs ----------------

export type LeiRecente = { nome: string; ementa: string | null; dataAssinatura: string; url: string; proposicao: { sigla: string; numero: number; ano: number; slug: string } | null; vetoParcial: boolean };

export async function leisRecentes(desde: string, limite = 30): Promise<LeiRecente[]> {
  return sql<LeiRecente[]>`
    SELECT n.nome, n.ementa, n.data_assinatura::text AS "dataAssinatura", n.url,
      CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object('sigla', p.sigla, 'numero', p.numero, 'ano', p.ano, 'slug', p.slug) END AS proposicao,
      EXISTS (SELECT 1 FROM veto v WHERE v.proposicao_id = p.id AND v.total = false) AS "vetoParcial"
    FROM norma n LEFT JOIN proposicao p ON p.id = n.proposicao_id
    WHERE n.data_assinatura >= ${desde} ORDER BY n.data_assinatura DESC, n.numero DESC LIMIT ${limite}`;
}

export type VetoResumo = {
  id: number; numero: number; ano: number; total: boolean | null; assunto: string | null; ementa: string | null; comentario: string | null;
  dataPublicacao: string | null; dataSobrestacao: string | null; sobrestando: boolean | null; emTramitacao: boolean | null;
  urlMensagem: string | null; resultado: string; dispositivos: { identificador: string | null; descricao: string; situacao: string; dataSessao: string | null }[] | null;
  fonteUrl: string; coletadoEm: Date;
  proposicao: { sigla: string; numero: number; ano: number; slug: string } | null;
};

const camposVeto = sql`
  v.id, v.numero, v.ano, v.total, v.assunto, v.ementa, v.comentario, v.data_publicacao::text AS "dataPublicacao",
  v.data_sobrestacao::text AS "dataSobrestacao", v.sobrestando, v.em_tramitacao AS "emTramitacao", v.url_mensagem AS "urlMensagem",
  v.resultado, v.dispositivos, v.fonte_url AS "fonteUrl", v.coletado_em AS "coletadoEm",
  CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object('sigla', p.sigla, 'numero', p.numero, 'ano', p.ano, 'slug', p.slug) END AS proposicao`;

export async function vetosRecentes(desde: string, limite = 30): Promise<VetoResumo[]> {
  return sql<VetoResumo[]>`SELECT ${camposVeto} FROM veto v LEFT JOIN proposicao p ON p.id = v.proposicao_id
    WHERE v.data_publicacao >= ${desde} ORDER BY v.data_publicacao DESC, v.numero DESC LIMIT ${limite}`;
}

export async function vetosPendentes(): Promise<VetoResumo[]> {
  return sql<VetoResumo[]>`SELECT ${camposVeto} FROM veto v LEFT JOIN proposicao p ON p.id = v.proposicao_id
    WHERE v.em_tramitacao ORDER BY v.data_sobrestacao NULLS LAST, v.numero`;
}

export async function vetosDaProposicao(proposicaoId: number): Promise<VetoResumo[]> {
  return sql<VetoResumo[]>`SELECT ${camposVeto} FROM veto v LEFT JOIN proposicao p ON p.id = v.proposicao_id
    WHERE v.proposicao_id = ${proposicaoId} ORDER BY v.ano DESC, v.numero DESC`;
}

export async function mpvsRecentes(desde: string, limite = 20) {
  return sql<{ sigla: string; numero: number; ano: number; slug: string; ementa: string | null; situacao: string | null; data: string; normaGerada: string | null }[]>`
    SELECT sigla, numero, ano, slug, ementa, situacao_senado AS situacao, data_apresentacao::text AS data, norma_gerada AS "normaGerada"
    FROM proposicao WHERE sigla = 'MPV' AND data_apresentacao >= ${desde} ORDER BY data_apresentacao DESC, numero DESC LIMIT ${limite}`;
}
