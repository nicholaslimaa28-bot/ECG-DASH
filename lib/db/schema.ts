// Esquema do banco — Fase 1 (Legislativo). Ver docs/esquema-banco.md para o desenho completo.
import {
  pgTable, serial, bigserial, text, integer, boolean, timestamp, date, numeric, jsonb,
  uniqueIndex, index, primaryKey, char,
} from "drizzle-orm/pg-core";

const tz = (nome: string) => timestamp(nome, { withTimezone: true, mode: "date" });

// ---------------- Controle de coleta ----------------

/** Uma linha por fonte oficial; guarda o contador de falhas seguidas para o alerta do /status. */
export const fonte = pgTable("fonte", {
  id: text("id").primaryKey(), // 'camara' | 'senado' | ...
  nome: text("nome").notNull(),
  urlBase: text("url_base").notNull(),
  falhasSeguidas: integer("falhas_seguidas").notNull().default(0),
});

/** Log de cada execução de coletor. */
export const coleta = pgTable("coleta", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  fonteId: text("fonte_id").notNull().references(() => fonte.id),
  tarefa: text("tarefa").notNull(),
  iniciadoEm: tz("iniciado_em").notNull(),
  terminadoEm: tz("terminado_em"),
  status: text("status").notNull(), // rodando | ok | parcial | erro
  itensLidos: integer("itens_lidos"),
  itensAlterados: integer("itens_alterados"),
  erro: text("erro"),
}, (t) => [index("coleta_fonte_idx").on(t.fonteId, t.iniciadoEm)]);

/** Referência a cada resposta bruta guardada (o conteúdo fica em arquivo gzip). */
export const bruto = pgTable("bruto", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  coletaId: integer("coleta_id").references(() => coleta.id),
  url: text("url").notNull(),
  statusHttp: integer("status_http").notNull(),
  sha256: text("sha256").notNull(),
  armazenamento: text("armazenamento").notNull(),
  coletadoEm: tz("coletado_em").notNull(),
}, (t) => [index("bruto_url_idx").on(t.url, t.coletadoEm)]);

/** Mudanças detectadas (alimentam a linha do tempo e, na Fase 4, os alertas). */
export const mudanca = pgTable("mudanca", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  tipo: text("tipo").notNull(), // nova_votacao | mudou_status | novo_evento | evento_mudou
  entidade: text("entidade").notNull(),
  entidadeId: integer("entidade_id").notNull(),
  dados: jsonb("dados").notNull(),
  detectadoEm: tz("detectado_em").notNull().defaultNow(),
}, (t) => [index("mudanca_entidade_idx").on(t.entidade, t.entidadeId)]);

// ---------------- Legislativo: cadastros ----------------

export const parlamentar = pgTable("parlamentar", {
  id: serial("id").primaryKey(),
  casa: text("casa").notNull(), // CD | SF
  idFonte: integer("id_fonte").notNull(),
  nomeParlamentar: text("nome_parlamentar").notNull(),
  nomeCivil: text("nome_civil"),
  sexo: text("sexo"),
  partido: text("partido"),
  uf: char("uf", { length: 2 }),
  urlFoto: text("url_foto"),
  email: text("email"),
  telefone: text("telefone"),
  emExercicio: boolean("em_exercicio").notNull(),
  situacao: text("situacao"),
  urlPaginaOficial: text("url_pagina_oficial"),
  slug: text("slug").notNull(),
  fonteUrl: text("fonte_url").notNull(),
  coletadoEm: tz("coletado_em").notNull(),
}, (t) => [
  uniqueIndex("parlamentar_casa_id_uq").on(t.casa, t.idFonte),
  uniqueIndex("parlamentar_slug_uq").on(t.slug),
]);

export const licenca = pgTable("licenca", {
  id: serial("id").primaryKey(),
  parlamentarId: integer("parlamentar_id").notNull().references(() => parlamentar.id),
  codigoFonte: integer("codigo_fonte").notNull(),
  inicio: date("inicio").notNull(),
  fim: date("fim"),
  tipoSigla: text("tipo_sigla"),
  tipoDescricao: text("tipo_descricao"),
  fonteUrl: text("fonte_url").notNull(),
  coletadoEm: tz("coletado_em").notNull(),
}, (t) => [uniqueIndex("licenca_uq").on(t.parlamentarId, t.codigoFonte)]);

export const orgao = pgTable("orgao", {
  id: serial("id").primaryKey(),
  casa: text("casa").notNull(), // CD | SF | CN
  idFonte: integer("id_fonte").notNull(),
  sigla: text("sigla"),
  nome: text("nome").notNull(),
  tipo: text("tipo"),
}, (t) => [uniqueIndex("orgao_uq").on(t.casa, t.idFonte)]);

export const membroOrgao = pgTable("membro_orgao", {
  parlamentarId: integer("parlamentar_id").notNull().references(() => parlamentar.id),
  orgaoId: integer("orgao_id").notNull().references(() => orgao.id),
  cargo: text("cargo").notNull(),
  inicio: date("inicio").notNull(),
  fim: date("fim"),
}, (t) => [primaryKey({ columns: [t.parlamentarId, t.orgaoId, t.inicio, t.cargo] })]);

// ---------------- Legislativo: atividade ----------------

export type ItemPauta = {
  ordem: number | null;
  titulo: string;
  proposicao: { sigla: string; numero: number; ano: number } | null;
  ementa: string | null;
  situacao: string | null;
  regime: string | null;
};

export const evento = pgTable("evento", {
  id: serial("id").primaryKey(),
  casa: text("casa").notNull(), // CD | SF | CN
  idFonte: text("id_fonte").notNull(),
  tipo: text("tipo").notNull(),
  deliberativa: boolean("deliberativa"),
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),
  orgaos: text("orgaos"), // siglas separadas por vírgula, para exibição
  inicio: tz("inicio").notNull(),
  fim: tz("fim"),
  status: text("status").notNull(), // agendada | em_andamento | encerrada | cancelada | suspensa
  statusOriginal: text("status_original"),
  local: text("local"),
  linkVideo: text("link_video"),
  urlPauta: text("url_pauta"),
  pauta: jsonb("pauta").$type<ItemPauta[]>(), // itens da pauta, como publicados
  hashConteudo: text("hash_conteudo").notNull(),
  fonteUrl: text("fonte_url").notNull(),
  coletadoEm: tz("coletado_em").notNull(),
}, (t) => [
  uniqueIndex("evento_uq").on(t.casa, t.idFonte),
  index("evento_inicio_idx").on(t.inicio),
]);

export const proposicao = pgTable("proposicao", {
  id: serial("id").primaryKey(),
  sigla: text("sigla").notNull(),
  numero: integer("numero").notNull(),
  ano: integer("ano").notNull(),
  idCamara: integer("id_camara"),
  idSenado: integer("id_senado"),
  casaIniciadora: text("casa_iniciadora"),
  ementa: text("ementa"),
  apelido: text("apelido"),
  situacaoCamara: text("situacao_camara"),
  situacaoSenado: text("situacao_senado"),
  dataApresentacao: date("data_apresentacao"),
  urlInteiroTeor: text("url_inteiro_teor"),
  normaGerada: text("norma_gerada"), // "Lei nº 15.527 de 06/11/2026" quando virou lei
  urlNorma: text("url_norma"),
  dataNorma: date("data_norma"),
  slug: text("slug").notNull(),
  hashConteudo: text("hash_conteudo"),
  atualizadoEm: tz("atualizado_em").notNull(),
}, (t) => [
  uniqueIndex("proposicao_uq").on(t.sigla, t.numero, t.ano),
  uniqueIndex("proposicao_slug_uq").on(t.slug),
]);

export const autoria = pgTable("autoria", {
  proposicaoId: integer("proposicao_id").notNull().references(() => proposicao.id),
  parlamentarId: integer("parlamentar_id").notNull().references(() => parlamentar.id),
  proponente: boolean("proponente").notNull().default(true),
}, (t) => [primaryKey({ columns: [t.proposicaoId, t.parlamentarId] })]);

export const tramitacao = pgTable("tramitacao", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  proposicaoId: integer("proposicao_id").notNull().references(() => proposicao.id),
  casa: text("casa").notNull(),
  dataHora: tz("data_hora").notNull(),
  sequencia: integer("sequencia").notNull(),
  orgaoSigla: text("orgao_sigla"),
  descricao: text("descricao"),
  situacao: text("situacao"),
  despacho: text("despacho"),
  url: text("url"),
}, (t) => [uniqueIndex("tramitacao_uq").on(t.proposicaoId, t.casa, t.sequencia)]);

export const votacao = pgTable("votacao", {
  id: serial("id").primaryKey(),
  casa: text("casa").notNull(),
  idFonte: text("id_fonte").notNull(),
  eventoId: integer("evento_id").references(() => evento.id),
  proposicaoId: integer("proposicao_id").references(() => proposicao.id),
  dataHora: tz("data_hora").notNull(),
  descricao: text("descricao").notNull(),
  nominal: boolean("nominal").notNull(),
  secreta: boolean("secreta").notNull().default(false),
  aprovada: boolean("aprovada"),
  placarSim: integer("placar_sim"),
  placarNao: integer("placar_nao"),
  placarAbstencao: integer("placar_abstencao"),
  placarObstrucao: integer("placar_obstrucao"),
  placarCalculado: boolean("placar_calculado").notNull().default(false),
  fonteUrl: text("fonte_url").notNull(),
  coletadoEm: tz("coletado_em").notNull(),
}, (t) => [
  uniqueIndex("votacao_uq").on(t.casa, t.idFonte),
  index("votacao_data_idx").on(t.dataHora),
]);

export const voto = pgTable("voto", {
  votacaoId: integer("votacao_id").notNull().references(() => votacao.id),
  parlamentarId: integer("parlamentar_id").notNull().references(() => parlamentar.id),
  partido: text("partido"), // partido NA DATA do voto
  tipoVoto: text("tipo_voto").notNull(),
  tipoVotoOriginal: text("tipo_voto_original").notNull(),
  registradoEm: tz("registrado_em"),
}, (t) => [
  primaryKey({ columns: [t.votacaoId, t.parlamentarId] }),
  index("voto_parlamentar_idx").on(t.parlamentarId),
]);

export const orientacao = pgTable("orientacao", {
  votacaoId: integer("votacao_id").notNull().references(() => votacao.id),
  bancada: text("bancada").notNull(),
  tipoBancada: text("tipo_bancada"),
  orientacao: text("orientacao").notNull(),
  orientacaoOriginal: text("orientacao_original").notNull(),
}, (t) => [primaryKey({ columns: [t.votacaoId, t.bancada] })]);

/** Presença por votação nominal (Senado) — situação + código oficial de comparecimento. */
export const presencaVotacao = pgTable("presenca_votacao", {
  votacaoId: integer("votacao_id").notNull().references(() => votacao.id),
  parlamentarId: integer("parlamentar_id").notNull().references(() => parlamentar.id),
  situacao: text("situacao").notNull(), // presente | ausencia_justificada | ausencia_nao_justificada
  codigoOriginal: text("codigo_original").notNull(),
  descricaoOriginal: text("descricao_original"),
}, (t) => [primaryKey({ columns: [t.votacaoId, t.parlamentarId] })]);

/** Presentes por evento (Câmara: /eventos/{id}/deputados — só lista quem esteve presente). */
export const presencaEvento = pgTable("presenca_evento", {
  eventoId: integer("evento_id").notNull().references(() => evento.id),
  parlamentarId: integer("parlamentar_id").notNull().references(() => parlamentar.id),
}, (t) => [primaryKey({ columns: [t.eventoId, t.parlamentarId] })]);

/** Totais oficiais publicados pela Câmara no perfil do deputado. */
export const presencaResumo = pgTable("presenca_resumo", {
  parlamentarId: integer("parlamentar_id").notNull().references(() => parlamentar.id),
  ano: integer("ano").notNull(),
  ambito: text("ambito").notNull(), // plenario | comissoes
  presencas: integer("presencas"),
  ausenciasJustificadas: integer("ausencias_justificadas"),
  ausenciasNaoJustificadas: integer("ausencias_nao_justificadas"),
  unidade: text("unidade").notNull(), // dias | reunioes
  fonteUrl: text("fonte_url").notNull(),
  coletadoEm: tz("coletado_em").notNull(),
}, (t) => [primaryKey({ columns: [t.parlamentarId, t.ano, t.ambito] })]);

export const despesa = pgTable("despesa", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  parlamentarId: integer("parlamentar_id").notNull().references(() => parlamentar.id),
  idFonte: text("id_fonte").notNull(), // identificador do documento na fonte
  ano: integer("ano").notNull(),
  mes: integer("mes").notNull(),
  categoria: text("categoria").notNull(),
  dataDocumento: date("data_documento"),
  valor: numeric("valor", { precision: 12, scale: 2 }).notNull(),
  fornecedorNome: text("fornecedor_nome"),
  fornecedorCnpj: text("fornecedor_cnpj"), // só CNPJ; CPF de pessoa física não é guardado
  urlDocumento: text("url_documento"),
}, (t) => [
  uniqueIndex("despesa_uq").on(t.parlamentarId, t.idFonte),
  index("despesa_parl_idx").on(t.parlamentarId, t.ano, t.mes),
]);

// ---------------- Reporte de erro pelo cidadão ----------------

export const reporteErro = pgTable("reporte_erro", {
  id: serial("id").primaryKey(),
  urlPagina: text("url_pagina").notNull(),
  descricao: text("descricao").notNull(),
  emailContato: text("email_contato"),
  status: text("status").notNull().default("aberto"),
  criadoEm: tz("criado_em").notNull().defaultNow(),
});

// ---------------- Executivo: agenda do Presidente ----------------

/** Situação de cada dia de agenda: se a página existia, o aviso de fuso (viagens) e quando foi coletada. */
export const agendaDia = pgTable("agenda_dia", {
  autoridade: text("autoridade").notNull(), // 'presidente'
  data: date("data").notNull(),
  publicada: boolean("publicada").notNull(), // false = página ainda não publicada (404)
  aviso: text("aviso"),
  fusoMin: integer("fuso_min"), // diferença do horário publicado para Brasília, em minutos
  url: text("url").notNull(),
  coletadoEm: tz("coletado_em").notNull(),
}, (t) => [primaryKey({ columns: [t.autoridade, t.data] })]);

export const agendaExecutivo = pgTable("agenda_executivo", {
  id: serial("id").primaryKey(),
  autoridade: text("autoridade").notNull(),
  data: date("data").notNull(),
  ordem: integer("ordem").notNull(),
  inicio: tz("inicio"), // convertido para Brasília
  inicioTexto: text("inicio_texto"), // como publicado ("13h00", horário local em viagens)
  horaLocal: boolean("hora_local").notNull().default(false),
  titulo: text("titulo").notNull(),
  local: text("local"),
  url: text("url"),
  coletadoEm: tz("coletado_em").notNull(),
}, (t) => [index("agenda_exec_data_idx").on(t.autoridade, t.data)]);

// ---------------- Executivo/Congresso: leis, vetos ----------------

/** Leis federais (ordinárias e complementares) publicadas, ligadas ao projeto de origem quando a fonte informa. */
export const norma = pgTable("norma", {
  codigo: integer("codigo").primaryKey(), // código da norma no Senado
  tipo: text("tipo").notNull(), // Lei | Lei Complementar
  numero: integer("numero").notNull(),
  ano: integer("ano").notNull(),
  nome: text("nome").notNull(),
  ementa: text("ementa"),
  dataAssinatura: date("data_assinatura").notNull(),
  url: text("url").notNull(),
  proposicaoId: integer("proposicao_id").references(() => proposicao.id),
  origemConsultada: boolean("origem_consultada").notNull().default(false),
  coletadoEm: tz("coletado_em").notNull(),
}, (t) => [index("norma_data_idx").on(t.dataAssinatura)]);

export type DispositivoVeto = { identificador: string | null; descricao: string; situacao: string; dataSessao: string | null };

export const veto = pgTable("veto", {
  id: serial("id").primaryKey(),
  codigoSenado: integer("codigo_senado").notNull(),
  codigoMateria: integer("codigo_materia").notNull(),
  numero: integer("numero").notNull(),
  ano: integer("ano").notNull(),
  proposicaoId: integer("proposicao_id").references(() => proposicao.id),
  total: boolean("total"),
  assunto: text("assunto"),
  ementa: text("ementa"),
  comentario: text("comentario"),
  dataPublicacao: date("data_publicacao"),
  dataRecebimento: date("data_recebimento"),
  dataSobrestacao: date("data_sobrestacao"), // a partir desta data o veto tranca a pauta do Congresso
  sobrestando: boolean("sobrestando"),
  emTramitacao: boolean("em_tramitacao"),
  urlMensagem: text("url_mensagem"), // mensagem de veto com as razões, no Planalto
  resultado: text("resultado").notNull(),
  dispositivos: jsonb("dispositivos").$type<DispositivoVeto[]>(),
  fonteUrl: text("fonte_url").notNull(),
  coletadoEm: tz("coletado_em").notNull(),
}, (t) => [uniqueIndex("veto_codigo_uq").on(t.codigoSenado), index("veto_data_idx").on(t.dataPublicacao)]);
