// Sanções, vetos, leis e medidas provisórias — dados do Congresso Nacional publicados pela API do Senado.
import { comoLista, limpar, lerIdentificacao, slugProposicao } from "@/lib/texto";
import { dataBrParaIso } from "@/lib/tempo";

export const API = "https://legis.senado.leg.br/dadosabertos";

const simNao = (v: string | undefined | null) => (v == null ? null : v.trim().toLowerCase() === "sim");

// ---------------- Normas (leis) ----------------

type NormaGeradaApi = {
  NomeNorma: string; UrlNorma?: string; CodigoNorma?: string; NumeroNorma?: string; AnoNorma?: string;
  DataAssinatura?: string; DataPublicacao?: string; DescricaoVeiculoPublicacao?: string;
};

/** Norma gerada por uma matéria (lei sancionada ou promulgada), como vem na lista de vetos. */
export function normaGerada(n: NormaGeradaApi | undefined | null) {
  if (!n?.NomeNorma) return null;
  return {
    normaGerada: n.NomeNorma,
    urlNorma: n.UrlNorma ?? null,
    dataNorma: n.DataAssinatura ?? null,
  };
}

type DocumentoLegislacao = { id: string; tipo: string; numero: string; normaNome: string; ementa?: string; dataassinatura: string };

export function leisDaLista(json: { ListaDocumento?: { documentos?: { documento?: DocumentoLegislacao | DocumentoLegislacao[] } } }) {
  return comoLista(json.ListaDocumento?.documentos?.documento).map((d) => {
    const data = dataBrParaIso(d.dataassinatura);
    return {
      codigo: Number(d.id),
      tipo: d.tipo === "LCP" ? "Lei Complementar" : "Lei",
      tipoFonte: d.tipo,
      numero: Number(d.numero),
      ano: Number(data.slice(0, 4)),
      nome: d.normaNome,
      ementa: limpar(d.ementa ?? null),
      dataAssinatura: data,
      // Texto integral no portal normas.leg.br (URN LexML)
      url: `https://normas.leg.br/?urn=urn:lex:br:federal:${d.tipo === "LCP" ? "lei.complementar" : "lei"}:${data};${Number(d.numero)}`,
    };
  });
}

// ---------------- Vetos ----------------

type MateriaApi = { Codigo: string; Sigla: string; Numero: string; Ano: string; EmTramitacao?: string; Ementa?: string; NormaGerada?: NormaGeradaApi };
export type VetoApi = {
  Codigo: string; Materia: MateriaApi; MateriaVetada: MateriaApi;
  Mensagem?: { UrlPlanalto?: string }; Total?: string; Assunto?: string; Comentario?: string;
  DataPublicacao?: string; DataRecebimentoCongresso?: string; DataSobrestacaoPauta?: string; SobrestandoPauta?: string;
};
type DispositivoApi = { Identificador?: string; Descricao?: string; Situacao?: string; DataSessao?: string };

export function vetosDaLista(json: Record<string, { Vetos?: { Veto?: VetoApi | VetoApi[] } }>): VetoApi[] {
  // A lista anual vem em "ListaVetosAnoCN"; a de encerrados, em "VetosTramitacaoEncerradaCN"
  const raiz = Object.values(json).find((v) => v && typeof v === "object" && "Vetos" in v);
  return comoLista(raiz?.Vetos?.Veto);
}

export type Dispositivo = { identificador: string | null; descricao: string; situacao: string; dataSessao: string | null };

export function dispositivosDoResultado(json: { ResultadoVetoMateriaCN?: { Veto?: { Dispositivos?: { Dispositivo?: DispositivoApi | DispositivoApi[] } } } }): Dispositivo[] {
  return comoLista(json.ResultadoVetoMateriaCN?.Veto?.Dispositivos?.Dispositivo).map((d) => ({
    identificador: d.Identificador ?? null,
    descricao: limpar(d.Descricao) ?? "Dispositivo",
    situacao: d.Situacao ?? "Não informado",
    dataSessao: d.DataSessao ?? null,
  }));
}

/**
 * Resume a deliberação do Congresso sobre o veto a partir da situação de cada dispositivo:
 * "Mantido" = veto mantido; "Rejeitado" = veto derrubado (o trecho volta a valer); "Não Apreciado" = pendente.
 */
export function resultadoVeto(emTramitacao: boolean | null, dispositivos: Dispositivo[]): string {
  const sit = dispositivos.map((d) => d.situacao.toLowerCase());
  const derrubados = sit.filter((s) => s.startsWith("rejeit")).length;
  const mantidos = sit.filter((s) => s.startsWith("mantid")).length;
  const pendentes = sit.length - derrubados - mantidos;
  if (derrubados && !mantidos && !pendentes) return "derrubado";
  if (mantidos && !derrubados && !pendentes) return "mantido";
  if (derrubados && (mantidos || !emTramitacao)) return "derrubado_em_parte";
  if (emTramitacao !== false) return derrubados || mantidos ? "em_deliberacao" : "aguardando";
  return mantidos ? "mantido" : "encerrado";
}

/** Converte sigla de matéria vetada para a usada nas proposições (mesma numeração nas duas Casas desde 2019). */
function proposicaoDaMateria(m: MateriaApi) {
  return { sigla: m.Sigla, numero: Number(m.Numero), ano: Number(m.Ano), slug: slugProposicao(m.Sigla, Number(m.Numero), Number(m.Ano)) };
}

export function normalizarVeto(v: VetoApi, dispositivos: Dispositivo[] | null, coletadoEm: Date) {
  const emTramitacao = simNao(v.Materia.EmTramitacao);
  return {
    veto: {
      codigoSenado: Number(v.Codigo),
      codigoMateria: Number(v.Materia.Codigo),
      numero: Number(v.Materia.Numero),
      ano: Number(v.Materia.Ano),
      total: simNao(v.Total),
      assunto: limpar(v.Assunto ?? null),
      ementa: limpar(v.Materia.Ementa ?? null),
      comentario: limpar(v.Comentario ?? null),
      dataPublicacao: v.DataPublicacao ?? null,
      dataRecebimento: v.DataRecebimentoCongresso ?? null,
      dataSobrestacao: v.DataSobrestacaoPauta ?? null,
      sobrestando: simNao(v.SobrestandoPauta),
      emTramitacao,
      urlMensagem: v.Mensagem?.UrlPlanalto ?? null,
      resultado: dispositivos ? resultadoVeto(emTramitacao, dispositivos) : emTramitacao ? "aguardando" : "encerrado",
      dispositivos,
      fonteUrl: `${API}/plenario/resultado/veto/materia/${v.Materia.Codigo}`,
      coletadoEm,
    },
    proposicao: { ...proposicaoDaMateria(v.MateriaVetada), ementa: limpar(v.MateriaVetada.Ementa ?? null), ...normaGerada(v.MateriaVetada.NormaGerada) },
  };
}

// ---------------- Medidas provisórias ----------------

type ProcessoLista = { id: number; identificacao: string; ementa?: string; situacaoAtual?: string; dataApresentacao?: string; urlDocumento?: string };

export function normalizarMpv(p: ProcessoLista, agora: Date) {
  const id = lerIdentificacao(p.identificacao);
  if (!id) return null;
  return {
    ...id,
    idSenado: p.id,
    casaIniciadora: "CN",
    ementa: limpar(p.ementa ?? null),
    situacaoSenado: p.situacaoAtual ? p.situacaoAtual.charAt(0) + p.situacaoAtual.slice(1).toLowerCase() : null,
    dataApresentacao: p.dataApresentacao?.slice(0, 10) ?? null, // data de edição da MP
    urlInteiroTeor: p.urlDocumento ?? null,
    slug: slugProposicao(id.sigla, id.numero, id.ano),
    atualizadoEm: agora,
  };
}

export const ROTULO_RESULTADO_VETO: Record<string, string> = {
  aguardando: "Aguardando deliberação do Congresso",
  em_deliberacao: "Em deliberação no Congresso",
  mantido: "Veto mantido pelo Congresso",
  derrubado: "Veto derrubado pelo Congresso",
  derrubado_em_parte: "Veto derrubado em parte pelo Congresso",
  encerrado: "Tramitação encerrada",
};
