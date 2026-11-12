// Normalizadores da Câmara: funções puras que convertem o JSON da API v2 no formato do banco.
// Testadas com amostras reais em fixtures/camara.
import { deBrasilia } from "@/lib/tempo";
import { limpar, apenasCnpj, slugParlamentar, slugProposicao, limparNomeFornecedor } from "@/lib/texto";
export { limparNomeFornecedor };
import type { ItemPauta } from "@/lib/db/schema";
import * as cheerio from "cheerio";

export const API = "https://dadosabertos.camara.leg.br/api/v2";

// ---------- Deputados ----------

type DeputadoLista = {
  id: number; nome: string; siglaPartido: string; siglaUf: string; urlFoto: string; email: string | null;
};
type DeputadoDetalhe = {
  id: number; nomeCivil: string; sexo: string;
  ultimoStatus: {
    nome: string; nomeEleitoral: string; siglaPartido: string; siglaUf: string; urlFoto: string; email: string | null;
    situacao: string | null; gabinete?: { telefone?: string | null } | null;
  };
  // Atenção: a API também devolve cpf, data e município de nascimento — não são lidos (LGPD).
};

export function normalizarDeputado(lista: DeputadoLista, detalhe: DeputadoDetalhe | null, coletadoEm: Date) {
  const st = detalhe?.ultimoStatus;
  const nome = st?.nomeEleitoral ?? lista.nome;
  return {
    casa: "CD" as const,
    idFonte: lista.id,
    nomeParlamentar: nome,
    nomeCivil: detalhe?.nomeCivil ?? null,
    sexo: detalhe?.sexo ?? null,
    partido: st?.siglaPartido ?? lista.siglaPartido,
    uf: st?.siglaUf ?? lista.siglaUf,
    urlFoto: st?.urlFoto ?? lista.urlFoto,
    email: st?.email ?? lista.email,
    telefone: st?.gabinete?.telefone ? `(61) ${st.gabinete.telefone}` : null,
    emExercicio: (st?.situacao ?? "Exercício") === "Exercício",
    situacao: st?.situacao ?? null,
    urlPaginaOficial: `https://www.camara.leg.br/deputados/${lista.id}`,
    slug: slugParlamentar("CD", nome, st?.siglaUf ?? lista.siglaUf, lista.id),
    fonteUrl: `${API}/deputados/${lista.id}`,
    coletadoEm,
  };
}

// ---------- Eventos (sessões e reuniões) ----------

type EventoApi = {
  id: number; dataHoraInicio: string; dataHoraFim: string | null; situacao: string; descricaoTipo: string;
  descricao: string | null; localExterno: string | null; localCamara: { nome: string | null } | null;
  orgaos: { sigla: string; nome: string }[]; urlRegistro: string | null;
};

/** Situações publicadas pela Câmara → status do portal. */
export function statusEvento(situacao: string): string {
  const s = situacao.toLowerCase();
  if (s.startsWith("encerrada")) return "encerrada";
  if (s.startsWith("em andamento")) return "em_andamento";
  if (s.startsWith("cancelada")) return "cancelada";
  if (s.startsWith("suspensa")) return "suspensa";
  if (s.startsWith("convocada") || s.startsWith("agendada")) return "agendada";
  return "agendada";
}

export function normalizarEvento(e: EventoApi, coletadoEm: Date) {
  const tipo = e.descricaoTipo;
  const orgaos = e.orgaos.map((o) => o.sigla).join(", ");
  const nomeOrgao = e.orgaos[0]?.nome;
  const inicio = deBrasilia(e.dataHoraInicio);
  if (!inicio) throw new Error(`Evento ${e.id} sem data de início`);
  const descricao = limpar(e.descricao);
  return {
    casa: "CD" as const,
    idFonte: String(e.id),
    tipo,
    // Para presença, contam as sessões deliberativas (Ato da Mesa nº 191/2017); reuniões deliberativas de comissão à parte
    deliberativa: /deliberativ/i.test(tipo) && !/não deliberativa/i.test(tipo),
    titulo: nomeOrgao ? `${tipo} — ${nomeOrgao}` : tipo,
    descricao,
    orgaos,
    inicio,
    fim: deBrasilia(e.dataHoraFim),
    status: statusEvento(e.situacao),
    statusOriginal: e.situacao,
    local: e.localCamara?.nome ?? e.localExterno ?? null,
    linkVideo: e.urlRegistro || null,
    urlPauta: `https://www.camara.leg.br/evento-legislativo/${e.id}`,
    fonteUrl: `${API}/eventos/${e.id}`,
    coletadoEm,
  };
}

type PautaApi = {
  ordem: number | null; titulo: string; regime: string | null; situacaoItem: string | null;
  proposicao_: { siglaTipo: string; numero: number | string; ano: number | string; ementa: string | null } | null;
  proposicaoRelacionada_: { siglaTipo: string; numero: number | string; ano: number | string; ementa: string | null } | null;
};

export function normalizarPauta(itens: PautaApi[]): ItemPauta[] {
  return itens.map((i) => {
    // Requerimentos (ex.: de urgência) apontam para o projeto em proposicaoRelacionada_
    const p = i.proposicao_;
    return {
      ordem: i.ordem,
      titulo: i.titulo,
      proposicao: p ? { sigla: p.siglaTipo, numero: Number(p.numero), ano: Number(p.ano) } : null,
      ementa: limpar(p?.ementa ?? i.proposicaoRelacionada_?.ementa ?? null),
      situacao: limpar(i.situacaoItem),
      regime: i.regime,
    };
  });
}

// ---------- Votações ----------

type VotacaoApi = {
  id: string; data: string; dataHoraRegistro: string | null; descricao: string; aprovacao: number | null;
  idEvento?: number | null; uriEvento?: string | null;
  proposicoesAfetadas?: { id: number; siglaTipo: string; numero: number; ano: number; ementa: string | null }[];
};
type VotoApi = { tipoVoto: string; dataRegistroVoto: string | null; deputado_: { id: number; siglaPartido: string | null } };
type OrientacaoApi = { orientacaoVoto: string; codTipoLideranca: string; siglaPartidoBloco: string };

/** tipoVoto da Câmara → valor normalizado. Desconhecidos ficam como 'outro' para revisão. */
export function normalizarTipoVoto(t: string): string {
  const s = t.trim().toLowerCase();
  if (s === "sim") return "sim";
  if (s === "não" || s === "nao") return "nao";
  if (s.startsWith("absten")) return "abstencao";
  if (s.startsWith("obstru")) return "obstrucao";
  if (s.startsWith("artigo 17") || s.startsWith("art. 17")) return "presidente";
  return "outro";
}

export function normalizarOrientacao(o: string): string {
  const s = o.trim().toLowerCase();
  if (s === "sim") return "sim";
  if (s === "não" || s === "nao") return "nao";
  if (s.startsWith("liber")) return "liberado";
  if (s.startsWith("obstru")) return "obstrucao";
  if (s.startsWith("absten")) return "abstencao";
  return s;
}

export function tipoBancada(o: OrientacaoApi): string {
  const n = o.siglaPartidoBloco.toLowerCase();
  if (n === "governo") return "governo";
  if (["maioria", "minoria", "oposição", "oposicao"].includes(n)) return "lideranca";
  return o.codTipoLideranca === "B" ? "bloco" : "partido";
}

export function normalizarVotacao(v: VotacaoApi, votos: VotoApi[], coletadoEm: Date) {
  const contagem = { sim: 0, nao: 0, abstencao: 0, obstrucao: 0 } as Record<string, number>;
  for (const x of votos) {
    const t = normalizarTipoVoto(x.tipoVoto);
    if (t in contagem) contagem[t]++;
  }
  const nominal = votos.length > 0;
  const idEvento = v.idEvento ?? (v.uriEvento ? Number(v.uriEvento.split("/").pop()) : null);
  return {
    votacao: {
      casa: "CD" as const,
      idFonte: v.id,
      dataHora: deBrasilia(v.dataHoraRegistro) ?? deBrasilia(v.data)!,
      descricao: limpar(v.descricao) ?? "",
      nominal,
      secreta: false,
      aprovada: v.aprovacao == null ? null : v.aprovacao === 1,
      // A Câmara não publica o placar à parte: somamos os votos individuais
      placarSim: nominal ? contagem.sim : null,
      placarNao: nominal ? contagem.nao : null,
      placarAbstencao: nominal ? contagem.abstencao : null,
      placarObstrucao: nominal ? contagem.obstrucao : null,
      placarCalculado: nominal,
      fonteUrl: `${API}/votacoes/${v.id}`,
      coletadoEm,
    },
    idEventoFonte: idEvento ? String(idEvento) : null,
    proposicao: v.proposicoesAfetadas?.[0]
      ? { idCamara: v.proposicoesAfetadas[0].id, sigla: v.proposicoesAfetadas[0].siglaTipo, numero: v.proposicoesAfetadas[0].numero, ano: v.proposicoesAfetadas[0].ano }
      : null,
    votos: votos.map((x) => ({
      idDeputado: x.deputado_.id,
      partido: x.deputado_.siglaPartido,
      tipoVoto: normalizarTipoVoto(x.tipoVoto),
      tipoVotoOriginal: x.tipoVoto,
      registradoEm: deBrasilia(x.dataRegistroVoto),
    })),
  };
}

export function normalizarOrientacoes(lista: OrientacaoApi[]) {
  return lista.map((o) => ({
    bancada: o.siglaPartidoBloco,
    tipoBancada: tipoBancada(o),
    orientacao: normalizarOrientacao(o.orientacaoVoto),
    orientacaoOriginal: o.orientacaoVoto,
  }));
}

// ---------- Proposições ----------

type ProposicaoApi = {
  id: number; siglaTipo: string; numero: number; ano: number; ementa: string | null; dataApresentacao: string | null;
  urlInteiroTeor: string | null; statusProposicao: { descricaoSituacao: string | null } | null;
};
type TramitacaoApi = {
  dataHora: string; sequencia: number; siglaOrgao: string | null; descricaoTramitacao: string | null;
  descricaoSituacao: string | null; despacho: string | null; url: string | null;
};

export function normalizarProposicao(p: ProposicaoApi, agora: Date) {
  return {
    sigla: p.siglaTipo,
    numero: p.numero,
    ano: p.ano,
    idCamara: p.id,
    ementa: limpar(p.ementa),
    situacaoCamara: p.statusProposicao?.descricaoSituacao ?? null,
    dataApresentacao: p.dataApresentacao?.slice(0, 10) ?? null,
    urlInteiroTeor: p.urlInteiroTeor,
    slug: slugProposicao(p.siglaTipo, p.numero, p.ano),
    atualizadoEm: agora,
  };
}

export function normalizarTramitacoes(lista: TramitacaoApi[]) {
  return lista
    .filter((t) => t.dataHora && t.sequencia != null)
    .map((t) => ({
      casa: "CD",
      dataHora: deBrasilia(t.dataHora)!,
      sequencia: t.sequencia,
      orgaoSigla: t.siglaOrgao,
      descricao: limpar(t.descricaoTramitacao),
      situacao: limpar(t.descricaoSituacao),
      despacho: limpar(t.despacho),
      url: t.url,
    }));
}

// ---------- Despesas (arquivo anual da cota parlamentar) ----------

type DespesaArquivo = {
  idDeputado?: number; idDocumento: number; parcela?: number | string | null; ano: number; mes: number; descricao: string; dataEmissao: string | null;
  valorLiquido: string | number; fornecedor: string | null; cnpjCPF: string | null; urlDocumento: string | null;
};

/** Retorna null para linhas que não são de deputado (lideranças, por exemplo). */
export function normalizarDespesa(d: DespesaArquivo) {
  if (!d.idDeputado) return null;
  return {
    idDeputado: d.idDeputado,
    // Documentos parcelados repetem o idDocumento: a parcela entra na chave
    idFonte: `${d.idDocumento}-${Number(d.parcela ?? 0)}`,
    ano: d.ano,
    mes: d.mes,
    categoria: limpar(d.descricao) ?? "Não informada",
    dataDocumento: d.dataEmissao?.slice(0, 10) || null, // às vezes vem ""
    valor: Number(d.valorLiquido).toFixed(2),
    fornecedorNome: limparNomeFornecedor(d.fornecedor),
    fornecedorCnpj: apenasCnpj(d.cnpjCPF),
    urlDocumento: d.urlDocumento,
  };
}

// ---------- Presença (perfil público do deputado) ----------

/**
 * Lê os totais de presença do perfil https://www.camara.leg.br/deputados/{id}?ano=AAAA
 * (página permitida pelo robots.txt). Cada bloco `section.presencas__section` traz
 * presenças / ausências justificadas / não justificadas — em dias (plenário) ou reuniões (comissões).
 */
export function lerPresencaPerfil(html: string) {
  const $ = cheerio.load(html);
  const resultado: Record<"plenario" | "comissoes", { presencas: number | null; ausenciasJustificadas: number | null; ausenciasNaoJustificadas: number | null } | null> = {
    plenario: null,
    comissoes: null,
  };
  $("section.presencas__section").each((_, sec) => {
    const titulo = $(sec).find(".presencas__section-heading a").first().text().replace(/\s+/g, " ").trim().toLowerCase();
    const ambito = titulo.includes("plenário") ? "plenario" : titulo.includes("comiss") ? "comissoes" : null;
    if (!ambito) return;
    const valores: Record<string, number | null> = {};
    $(sec).find("li.presencas__data").each((_, li) => {
      const rotulo = $(li).find(".presencas__label").text().replace(/\s+/g, " ").trim().toLowerCase();
      const m = $(li).find(".presencas__qtd").text().match(/(\d+)/);
      valores[rotulo] = m ? Number(m[1]) : null;
    });
    const pegar = (prefixo: string) => {
      const k = Object.keys(valores).find((r) => r.startsWith(prefixo));
      return k ? valores[k] : null;
    };
    resultado[ambito] = {
      presencas: pegar("presenças"),
      ausenciasJustificadas: pegar("ausências justificadas"),
      ausenciasNaoJustificadas: pegar("ausências não justificadas"),
    };
  });
  return resultado;
}
