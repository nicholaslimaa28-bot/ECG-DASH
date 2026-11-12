// Coletor do Senado Federal e do Congresso Nacional.
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { buscarJson } from "../http";
import {
  executarTarefa, emLotes, salvarParlamentar, mapaParlamentares, salvarEvento, idEvento, salvarProposicao,
  salvarVotacao, substituirFilhos, salvarDespesas,
} from "../comum";
import {
  API, API_ADM, normalizarSenador, normalizarLicencas, sessoesDaAgenda, normalizarSessao, reunioesDaAgenda,
  normalizarReuniao, normalizarVotacaoSenado, normalizarProcesso, normalizarCeaps,
} from "./normalizar";
import { hojeBrasilia, somarDias } from "@/lib/tempo";

const json = <T>(url: string) => buscarJson<T>(url.includes("?") || url.endsWith(".json") ? url : `${url}.json`, { aceitar: [404] });
const compacta = (iso: string) => iso.replace(/-/g, "");

// ---------------- Cadastro de senadores e licenças (1×/dia) ----------------

type ListaAtual = { ListaParlamentarEmExercicio: { Parlamentares: { Parlamentar: Parameters<typeof normalizarSenador>[0][] } } };
type Afastados = { AfastamentoAtual: { Parlamentares?: { Parlamentar: Parameters<typeof normalizarSenador>[0] | Parameters<typeof normalizarSenador>[0][] } } };

export const cadastro = () => executarTarefa("senado", "cadastro_senadores", async (c) => {
  const agora = new Date();
  const atual = await json<ListaAtual>(`${API}/senador/lista/atual`);
  if (!atual) throw new Error("Lista de senadores indisponível");
  const emExercicio = atual.ListaParlamentarEmExercicio.Parlamentares.Parlamentar;
  const ids = new Set<number>();
  for (const p of emExercicio) {
    const id = await salvarParlamentar(normalizarSenador(p, true, agora));
    ids.add(id);
    c.lidos++;
  }
  const afast = await json<Afastados>(`${API}/senador/afastados`);
  const lista = afast?.AfastamentoAtual.Parlamentares?.Parlamentar;
  for (const p of Array.isArray(lista) ? lista : lista ? [lista] : []) {
    ids.add(await salvarParlamentar(normalizarSenador(p, false, agora)));
    c.lidos++;
  }
  // Quem não aparece em nenhuma das duas listas não está mais no mandato atual
  const todos = await db.select({ id: s.parlamentar.id }).from(s.parlamentar).where(and(eq(s.parlamentar.casa, "SF"), eq(s.parlamentar.emExercicio, true)));
  const fora = todos.map((t) => t.id).filter((id) => !ids.has(id));
  if (fora.length) await db.update(s.parlamentar).set({ emExercicio: false, situacao: "Fora do mandato" }).where(inArray(s.parlamentar.id, fora));

  // Licenças oficiais (missões, saúde etc.) — usadas no contexto da presença
  const mapa = await mapaParlamentares("SF");
  await emLotes([...mapa.entries()], 2, async ([cod, parlamentarId]) => {
    const l = await json<Parameters<typeof normalizarLicencas>[0]>(`${API}/senador/${cod}/licencas`);
    if (!l) return;
    for (const lic of normalizarLicencas(l)) {
      const linha = { ...lic, parlamentarId, fonteUrl: `${API}/senador/${cod}/licencas`, coletadoEm: agora };
      await db.insert(s.licenca).values(linha).onConflictDoUpdate({ target: [s.licenca.parlamentarId, s.licenca.codigoFonte], set: linha });
    }
  });
});

// ---------------- Agenda do Plenário (SF e CN) e das comissões ----------------

export const agenda = (de = somarDias(hojeBrasilia(), -1), ate = somarDias(hojeBrasilia(), 7)) =>
  executarTarefa("senado", "agenda", async (c) => {
    for (let dia = de; dia <= ate; dia = somarDias(dia, 1)) {
      const a = await json<Parameters<typeof sessoesDaAgenda>[0]>(`${API}/plenario/agenda/dia/${compacta(dia)}`);
      for (const sessao of a ? sessoesDaAgenda(a) : []) {
        const { mudou } = await salvarEvento(normalizarSessao(sessao, new Date()));
        c.lidos++;
        if (mudou) c.alterados++;
      }
    }
    const r = await json<Parameters<typeof reunioesDaAgenda>[0]>(`${API}/comissao/agenda/${compacta(de)}/${compacta(ate)}`);
    for (const reuniao of r ? reunioesDaAgenda(r) : []) {
      const { mudou } = await salvarEvento(normalizarReuniao(reuniao, new Date()));
      c.lidos++;
      if (mudou) c.alterados++;
    }
  });

// ---------------- Votações nominais, orientação de bancada e presença ----------------

type VotacaoApi = Parameters<typeof normalizarVotacaoSenado>[0];
type Orientacoes = { votacoes: NonNullable<Parameters<typeof normalizarVotacaoSenado>[1]>[] };

async function coletarProcesso(sigla: string, numero: number, ano: number) {
  const lista = await json<Parameters<typeof normalizarProcesso>[0][]>(`${API}/processo?sigla=${sigla}&numero=${numero}&ano=${ano}`);
  const p = lista?.[0];
  const n = p ? normalizarProcesso(p, new Date()) : null;
  return n ? salvarProposicao(n) : null;
}

export const votacoes = (de = somarDias(hojeBrasilia(), -3), ate = hojeBrasilia()) =>
  executarTarefa("senado", "votacoes", async (c) => {
    const mapa = await mapaParlamentares("SF");
    const lista = (await json<VotacaoApi[]>(`${API}/votacao?dataInicio=${de}&dataFim=${ate}`)) ?? [];
    const orient = (await json<Orientacoes>(`${API}/plenario/votacao/orientacaoBancada/${compacta(de)}/${compacta(ate)}`))?.votacoes ?? [];
    const porSequencial = new Map(orient.map((o) => [o.sequencialVotacao, o]));
    const processos = new Map<string, number | null>();
    const agendasVistas = new Set<string>();

    for (const v of lista) {
      const n = normalizarVotacaoSenado(v, porSequencial.get(v.sequencialVotacao), new Date());
      let proposicaoId: number | null = null;
      if (n.proposicao) {
        const chave = `${n.proposicao.sigla}-${n.proposicao.numero}-${n.proposicao.ano}`;
        if (!processos.has(chave)) processos.set(chave, await coletarProcesso(n.proposicao.sigla, n.proposicao.numero, n.proposicao.ano));
        proposicaoId = processos.get(chave) ?? null;
      }
      let eventoId = await idEvento(n.votacao.casa, n.idSessaoFonte);
      if (!eventoId && !agendasVistas.has(v.dataSessao)) {
        // Sessão fora da janela da agenda: busca a agenda daquele dia para ligar a votação à sessão
        agendasVistas.add(v.dataSessao);
        const a = await json<Parameters<typeof sessoesDaAgenda>[0]>(`${API}/plenario/agenda/dia/${compacta(v.dataSessao)}`);
        for (const sessao of a ? sessoesDaAgenda(a) : []) await salvarEvento(normalizarSessao(sessao, new Date()));
        eventoId = await idEvento(n.votacao.casa, n.idSessaoFonte);
      }
      const { id } = await salvarVotacao({ ...n.votacao, eventoId, proposicaoId });

      const votos = n.votos.flatMap((x) => {
        const parlamentarId = mapa.get(x.codigoParlamentar);
        return parlamentarId ? [{ ...x, parlamentarId }] : [];
      });
      await substituirFilhos(
        id,
        votos.map((x) => ({ votacaoId: id, parlamentarId: x.parlamentarId, partido: x.partido, tipoVoto: x.tipoVoto, tipoVotoOriginal: x.tipoVotoOriginal, registradoEm: null })),
        n.orientacoes.map((o) => ({ ...o, votacaoId: id })),
      );
      // Presença por votação nominal, com o código oficial de comparecimento
      await db.delete(s.presencaVotacao).where(eq(s.presencaVotacao.votacaoId, id));
      if (votos.length) {
        await db.insert(s.presencaVotacao).values(votos.map((x) => ({
          votacaoId: id, parlamentarId: x.parlamentarId, situacao: x.presenca, codigoOriginal: x.tipoVotoOriginal, descricaoOriginal: x.descricaoOriginal,
        }))).onConflictDoNothing();
      }
      c.lidos++;
    }
  });

// ---------------- Despesas: CEAPS (API administrativa do Senado) ----------------

export const despesas = (ano = Number(hojeBrasilia().slice(0, 4))) =>
  executarTarefa("senado", `despesas_${ano}`, async (c) => {
    const mapa = await mapaParlamentares("SF");
    const dados = await buscarJson<Parameters<typeof normalizarCeaps>[0][]>(`${API_ADM}/senadores/despesas_ceaps/${ano}`, { timeoutMs: 300_000 });
    const linhas = (dados ?? []).flatMap((d) => {
      const parlamentarId = mapa.get(d.codSenador);
      if (!parlamentarId) return [];
      const { codSenador: _, ...resto } = normalizarCeaps(d);
      return [{ ...resto, parlamentarId }];
    });
    c.lidos = linhas.length;
    await salvarDespesas(linhas);
  });

// ---------------- Autoria de senadores na legislatura atual ----------------

const TIPOS_AUTORIA = ["PL", "PLP", "PEC", "PDL"];

export const autoria = (desde = "2023-02-01") =>
  executarTarefa("senado", "autoria", async (c) => {
    const mapa = await mapaParlamentares("SF");
    const ativos = await db.select({ idFonte: s.parlamentar.idFonte }).from(s.parlamentar).where(and(eq(s.parlamentar.casa, "SF"), eq(s.parlamentar.emExercicio, true)));
    await emLotes(ativos, 2, async ({ idFonte }) => {
      const parlamentarId = mapa.get(idFonte)!;
      for (const sigla of TIPOS_AUTORIA) {
        const lista = await json<Parameters<typeof normalizarProcesso>[0][]>(
          `${API}/processo?codigoParlamentarAutor=${idFonte}&sigla=${sigla}&dataInicioApresentacao=${desde}`,
        );
        for (const p of lista ?? []) {
          const n = normalizarProcesso(p, new Date());
          if (!n) continue;
          const proposicaoId = await salvarProposicao(n);
          await db.insert(s.autoria).values({ proposicaoId, parlamentarId }).onConflictDoNothing();
          c.lidos++;
        }
      }
    });
  });
