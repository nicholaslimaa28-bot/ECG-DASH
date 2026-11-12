// Normalizadores do Senado Federal / Congresso Nacional: funções puras, testadas com fixtures/senado.
import { deBrasilia } from "@/lib/tempo";
import { limpar, comoLista, apenasCnpj, slugParlamentar, slugProposicao, lerIdentificacao, limparNomeFornecedor } from "@/lib/texto";
import type { ItemPauta } from "@/lib/db/schema";

export const API = "https://legis.senado.leg.br/dadosabertos";
export const API_ADM = "https://adm.senado.gov.br/adm-dadosabertos/api/v1";

// ---------- Senadores ----------

type Ident = {
  CodigoParlamentar: string; NomeParlamentar: string; NomeCompletoParlamentar?: string; SexoParlamentar?: string;
  UrlFotoParlamentar?: string; UrlPaginaParlamentar?: string; EmailParlamentar?: string; SiglaPartidoParlamentar?: string;
  UfParlamentar?: string; Telefones?: { Telefone: { NumeroTelefone: string } | { NumeroTelefone: string }[] };
};
type ParlamentarLista = { IdentificacaoParlamentar: Ident; Mandato?: { UfParlamentar?: string } };

/** A fonte publica as fotos em http://; o mesmo caminho funciona em https (evita conteúdo misto). */
const https = (u?: string) => (u ? u.replace(/^http:\/\//, "https://") : null);

export function normalizarSenador(p: ParlamentarLista, emExercicio: boolean, coletadoEm: Date) {
  const i = p.IdentificacaoParlamentar;
  const id = Number(i.CodigoParlamentar);
  const uf = i.UfParlamentar ?? p.Mandato?.UfParlamentar ?? null;
  const tel = comoLista(i.Telefones?.Telefone)[0]?.NumeroTelefone;
  return {
    casa: "SF" as const,
    idFonte: id,
    nomeParlamentar: i.NomeParlamentar,
    nomeCivil: i.NomeCompletoParlamentar ?? null,
    sexo: i.SexoParlamentar ?? null,
    partido: i.SiglaPartidoParlamentar ?? null,
    uf,
    urlFoto: https(i.UrlFotoParlamentar),
    email: i.EmailParlamentar ?? null,
    telefone: tel ? `(61) ${tel.replace(/^(\d{4})(\d{4})$/, "$1-$2")}` : null,
    emExercicio,
    situacao: emExercicio ? "Exercício" : "Afastado",
    urlPaginaOficial: https(i.UrlPaginaParlamentar) ?? `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${id}`,
    slug: slugParlamentar("SF", i.NomeParlamentar, uf, id),
    fonteUrl: `${API}/senador/${id}`,
    coletadoEm,
  };
}

type LicencaApi = {
  Codigo: string; DataInicio: string; DataFim?: string | null; SiglaTipoAfastamento?: string; DescricaoTipoAfastamento?: string;
};

export function normalizarLicencas(json: { LicencaParlamentar?: { Parlamentar?: { Licencas?: { Licenca?: LicencaApi | LicencaApi[] } } } }) {
  return comoLista(json.LicencaParlamentar?.Parlamentar?.Licencas?.Licenca).map((l) => ({
    codigoFonte: Number(l.Codigo),
    inicio: l.DataInicio,
    fim: l.DataFim ?? null,
    tipoSigla: l.SiglaTipoAfastamento ?? null,
    tipoDescricao: l.DescricaoTipoAfastamento ?? null,
  }));
}

// ---------- Agenda do Plenário (Senado e Congresso) ----------

type MateriaPauta = {
  CodigoMateria?: string; SiglaMateria?: string; NumeroMateria?: string; AnoMateria?: string;
  DescricaoIdentificacaoMateria?: string; Ementa?: string; SituacaoItem?: string; OrdemPauta?: string; NumeroSequencia?: string;
};
type SessaoApi = {
  Data: string; Hora?: string; TipoSessao: string; NumeroSessao?: string; LocalSessao?: string; CodigoSessao: string;
  Casa: string; SituacaoSessao?: string; Evento?: { DescricaoEvento?: string; DescricaoTipoEvento?: string };
  Materias?: { Materia: MateriaPauta | MateriaPauta[] };
};

export function statusSessao(situacao: string | undefined): string {
  const s = (situacao ?? "").toLowerCase();
  if (s.includes("encerrad") || (s.includes("realizada") && !s.includes("não"))) return "encerrada";
  if (s.includes("andamento") || s.includes("aberta")) return "em_andamento";
  if (s.includes("suspens")) return "suspensa";
  if (s.includes("cancel") || s.includes("não realizada") || s.includes("adiad")) return "cancelada";
  return "agendada";
}

function tituloCaixaAlta(s: string): string {
  // "SESSÃO DELIBERATIVA ORDINÁRIA " → "Sessão Deliberativa Ordinária"
  return s.trim().toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()).replace(/\b(De|Do|Da|Em|E)\b/g, (c) => c.toLowerCase());
}

export function normalizarSessao(s: SessaoApi, coletadoEm: Date) {
  const tipo = tituloCaixaAlta(s.TipoSessao);
  const casa = s.Casa === "CN" ? "CN" : "SF";
  // A hora vem sem zero à esquerda ("9:00"); sem hora definida, usamos 00:00
  const [h, m] = (s.Hora?.match(/^(\d{1,2}):(\d{2})/)?.slice(1) ?? ["0", "00"]);
  const inicio = deBrasilia(`${s.Data}T${h.padStart(2, "0")}:${m}`)!;
  const pauta: ItemPauta[] = comoLista(s.Materias?.Materia).map((m, i) => {
    const ident = m.DescricaoIdentificacaoMateria ?? `${m.SiglaMateria} ${Number(m.NumeroMateria)}/${m.AnoMateria}`;
    return {
      ordem: Number(m.NumeroSequencia ?? m.OrdemPauta ?? i + 1),
      titulo: ident,
      proposicao: lerIdentificacao(ident),
      ementa: limpar(m.Ementa),
      situacao: limpar(m.SituacaoItem),
      regime: null,
    };
  });
  return {
    casa,
    idFonte: s.CodigoSessao,
    tipo,
    deliberativa: /deliberativa/i.test(s.TipoSessao) && !/não deliberativa/i.test(s.TipoSessao),
    titulo: `${s.NumeroSessao ? s.NumeroSessao.trim().replace("SESSÃO", "Sessão") + " — " : ""}${tipo}${casa === "CN" ? " (Congresso Nacional)" : ""}`,
    descricao: limpar(s.Evento?.DescricaoEvento),
    orgaos: casa === "CN" ? "Plenário do Congresso" : "Plenário do Senado",
    inicio,
    fim: null,
    status: statusSessao(s.SituacaoSessao),
    statusOriginal: s.SituacaoSessao ?? null,
    local: s.LocalSessao ?? null,
    linkVideo: null, // vídeos por trecho só existem depois da sessão (taquigrafia); ao vivo: TV Senado
    urlPauta: `https://www25.senado.leg.br/web/atividade/sessao-plenaria/-/pauta/${s.CodigoSessao}`,
    pauta,
    fonteUrl: `${API}/plenario/agenda/dia/${s.Data.replace(/-/g, "")}`,
    coletadoEm,
  };
}

export function sessoesDaAgenda(json: { AgendaPlenario?: { Sessoes?: { Sessao?: SessaoApi | SessaoApi[] } } }): SessaoApi[] {
  return comoLista(json.AgendaPlenario?.Sessoes?.Sessao);
}

// ---------- Reuniões de comissão ----------

type ReuniaoApi = {
  codigo: string; titulo?: string; descricao?: string; dataInicio: string; status?: string; situacao?: string;
  realizada?: string; local?: string; colegiadoCriador?: { sigla?: string; nome?: string; siglaCasa?: string };
  tipo?: { descricao?: string };
};

export function reunioesDaAgenda(json: { AgendaReuniao?: { reunioes?: { reuniao?: ReuniaoApi | ReuniaoApi[] } } }): ReuniaoApi[] {
  return comoLista(json.AgendaReuniao?.reunioes?.reuniao);
}

export function normalizarReuniao(r: ReuniaoApi, coletadoEm: Date) {
  const casa = r.colegiadoCriador?.siglaCasa === "CN" ? "CN" : "SF";
  const st = (r.status ?? "").toLowerCase();
  let status = "agendada";
  if (st.includes("cancel") || st.includes("adiad")) status = "cancelada";
  else if (st.includes("encerr") || r.realizada === "true" || st.includes("realizada")) status = "encerrada";
  else if (st.includes("andamento") || st.includes("aberta")) status = "em_andamento";
  else if (st.includes("suspens")) status = "suspensa";
  const tipo = r.tipo?.descricao ?? "Reunião";
  return {
    casa,
    idFonte: `reuniao-${r.codigo}`,
    tipo: `${tipo} de comissão`,
    deliberativa: null,
    titulo: `${limpar(r.titulo) ?? tipo} — ${r.colegiadoCriador?.nome ?? "Comissão"}`,
    descricao: null,
    orgaos: r.colegiadoCriador?.sigla ?? null,
    inicio: deBrasilia(r.dataInicio)!,
    fim: null,
    status,
    statusOriginal: r.status ?? r.situacao ?? null,
    local: r.local ?? null,
    linkVideo: null,
    urlPauta: `https://legis.senado.leg.br/comissoes/reuniao?reuniao=${r.codigo}`,
    pauta: null,
    fonteUrl: `${API}/comissao/agenda/${r.dataInicio.slice(0, 10).replace(/-/g, "")}`,
    coletadoEm,
  };
}

// ---------- Votações nominais e presença ----------

type VotoApi = {
  codigoParlamentar: number; nomeParlamentar: string; siglaPartidoParlamentar: string | null;
  siglaVotoParlamentar: string; descricaoVotoParlamentar: string | null;
};
type VotacaoApi = {
  codigoSessaoVotacao: number; codigoSessao: number; sequencialVotacao: number; dataSessao: string;
  descricaoVotacao: string; resultadoVotacao: string | null; votacaoSecreta: string;
  sigla: string | null; numero: string | null; ano: number | null; identificacao: string | null; idProcesso: number | null;
  codigoMateria: number | null; ementa: string | null; casaSessao: string;
  totalVotosSim: number | null; totalVotosNao: number | null; totalVotosAbstencao: number | null;
  votos: VotoApi[];
};
type OrientacaoVotacao = {
  sequencialVotacao: number; dataInicioVotacao: string | null;
  qtdVotosSim: number | null; qtdVotosNao: number | null; qtdVotosAbstencao: number | null; qtdObstrucoes: number | null;
  orientacoesLideranca: { partido: string; voto: string }[] | null;
};

/**
 * Classifica o código de comparecimento do Senado (tabela /plenario/lista/tiposComparecimento).
 * Votos e "presente sem voto" contam como presença; licenças, missões e atividade parlamentar
 * são ausências justificadas; "NCom" (não compareceu) é ausência não justificada.
 */
export function classificarVotoSenado(sigla: string): { tipoVoto: string; presenca: string } {
  const s = sigla.trim();
  const l = s.toLowerCase();
  if (l === "sim") return { tipoVoto: "sim", presenca: "presente" };
  if (l === "não" || l === "nao") return { tipoVoto: "nao", presenca: "presente" };
  if (l.startsWith("absten")) return { tipoVoto: "abstencao", presenca: "presente" };
  if (l.startsWith("obstru")) return { tipoVoto: "obstrucao", presenca: "presente" };
  if (l.startsWith("presidente")) return { tipoVoto: "presidente", presenca: "presente" };
  if (s === "P-NRV" || s === "P-OD") return { tipoVoto: "presente_sem_voto", presenca: "presente" };
  if (s === "NCom") return { tipoVoto: "ausente", presenca: "ausencia_nao_justificada" };
  // Demais códigos oficiais: AP, MIS, L1–L7, LAP, LAF, LC, LS, AUS, GR, EP...
  return { tipoVoto: "ausente", presenca: "ausencia_justificada" };
}

export function normalizarOrientacaoSenado(v: string): string {
  const l = v.trim().toLowerCase();
  if (l === "sim") return "sim";
  if (l === "não" || l === "nao") return "nao";
  if (l.startsWith("liber")) return "liberado";
  if (l.startsWith("obstru")) return "obstrucao";
  if (l.startsWith("absten")) return "abstencao";
  return l;
}

export function normalizarVotacaoSenado(v: VotacaoApi, orient: OrientacaoVotacao | undefined, coletadoEm: Date) {
  const secreta = v.votacaoSecreta === "S";
  const votos = v.votos ?? [];
  const contar = (t: string) => votos.filter((x) => classificarVotoSenado(x.siglaVotoParlamentar).tipoVoto === t).length;
  // Placar oficial vem de orientacaoBancada; se faltar, somamos os votos individuais
  const oficial = orient && orient.qtdVotosSim != null;
  const proposicao = v.sigla && v.numero && v.ano ? { sigla: v.sigla, numero: Number(v.numero), ano: v.ano, idSenado: v.idProcesso, ementa: limpar(v.ementa) } : null;
  return {
    votacao: {
      casa: v.casaSessao === "CN" ? "CN" : "SF",
      idFonte: String(v.codigoSessaoVotacao),
      dataHora: deBrasilia(orient?.dataInicioVotacao) ?? deBrasilia(v.dataSessao)!,
      descricao: limpar(v.descricaoVotacao) ?? "",
      nominal: !secreta && votos.length > 0,
      secreta,
      aprovada: v.resultadoVotacao === "A" ? true : v.resultadoVotacao === "R" ? false : null,
      placarSim: oficial ? orient!.qtdVotosSim : v.totalVotosSim ?? (votos.length ? contar("sim") : null),
      placarNao: oficial ? orient!.qtdVotosNao : v.totalVotosNao ?? (votos.length ? contar("nao") : null),
      placarAbstencao: oficial ? orient!.qtdVotosAbstencao : v.totalVotosAbstencao ?? (votos.length ? contar("abstencao") : null),
      placarObstrucao: oficial ? orient!.qtdObstrucoes : null,
      placarCalculado: !oficial && v.totalVotosSim == null,
      fonteUrl: `${API}/votacao?codigoSessao=${v.codigoSessao}`,
      coletadoEm,
    },
    idSessaoFonte: String(v.codigoSessao),
    proposicao,
    votos: votos.map((x) => {
      const c = classificarVotoSenado(x.siglaVotoParlamentar);
      return {
        codigoParlamentar: x.codigoParlamentar,
        nome: x.nomeParlamentar,
        partido: x.siglaPartidoParlamentar,
        tipoVoto: c.tipoVoto,
        tipoVotoOriginal: x.siglaVotoParlamentar,
        presenca: c.presenca,
        descricaoOriginal: x.descricaoVotoParlamentar,
      };
    }),
    orientacoes: (orient?.orientacoesLideranca ?? []).map((o) => ({
      bancada: o.partido,
      tipoBancada: o.partido.toLowerCase() === "governo" ? "governo" : ["maioria", "minoria", "oposição", "oposicao"].includes(o.partido.toLowerCase()) ? "lideranca" : "partido",
      orientacao: normalizarOrientacaoSenado(o.voto),
      orientacaoOriginal: o.voto,
    })),
  };
}

// ---------- Processos (proposições) ----------

type ProcessoApi = {
  id: number; identificacao: string; apelido?: string | null; ementa?: string | null; situacaoAtual?: string | null;
  siglaCasaIniciadora?: string | null; casaIdentificadora?: string | null; dataApresentacao?: string | null;
  urlDocumento?: string | null; conteudo?: { ementa?: string | null } | null; documento?: { url?: string | null } | null;
  dataInicioEfetivo?: string | null;
};

export function normalizarProcesso(p: ProcessoApi, agora: Date) {
  const ident = lerIdentificacao(p.identificacao);
  if (!ident) return null;
  return {
    ...ident,
    idSenado: p.id,
    casaIniciadora: p.siglaCasaIniciadora ?? null,
    ementa: limpar(p.ementa ?? p.conteudo?.ementa ?? null),
    apelido: limpar(p.apelido ?? null),
    situacaoSenado: p.situacaoAtual ? tituloCaixaAlta(p.situacaoAtual.replace(/_/g, " ")) : null,
    dataApresentacao: (p.dataApresentacao ?? p.dataInicioEfetivo)?.slice(0, 10) ?? null,
    urlInteiroTeor: p.urlDocumento ?? p.documento?.url ?? null,
    slug: slugProposicao(ident.sigla, ident.numero, ident.ano),
    atualizadoEm: agora,
  };
}

// ---------- Despesas (CEAPS) ----------

type CeapsApi = {
  id: number; ano: number; mes: number; codSenador: number; tipoDespesa: string | null; cpfCnpj: string | null;
  fornecedor: string | null; data: string | null; valorReembolsado: number;
  // 'detalhamento' traz nomes de passageiros (inclusive assessores) — não é guardado
};

export function normalizarCeaps(d: CeapsApi) {
  return {
    codSenador: d.codSenador,
    idFonte: String(d.id),
    ano: d.ano,
    mes: d.mes,
    categoria: limpar(d.tipoDespesa) ?? "Não informada",
    dataDocumento: d.data?.slice(0, 10) || null,
    valor: Number(d.valorReembolsado).toFixed(2),
    fornecedorNome: limparNomeFornecedor(d.fornecedor),
    fornecedorCnpj: apenasCnpj(d.cpfCnpj),
    urlDocumento: null,
  };
}
