// Coletor da Câmara dos Deputados. Cada função é uma "tarefa" agendável (ver collectors/cli.ts).
import { and, eq, gte, inArray } from "drizzle-orm";
import { unzipSync, strFromU8 } from "fflate";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { buscar, buscarJson, buscarTexto, ErroHttp } from "../http";
import {
  executarTarefa, emLotes, salvarParlamentar, mapaParlamentares, salvarEvento, idEvento, salvarProposicao,
  salvarVotacao, substituirFilhos, salvarDespesas,
} from "../comum";
import {
  API, normalizarDeputado, normalizarEvento, normalizarPauta, normalizarVotacao, normalizarOrientacoes,
  normalizarProposicao, normalizarTramitacoes, normalizarDespesa, lerPresencaPerfil,
} from "./normalizar";
import { hojeBrasilia, somarDias } from "@/lib/tempo";
import { slugProposicao, limpar } from "@/lib/texto";

type Pagina<T> = { dados: T[]; links: { rel: string; href: string }[] };

/** Percorre todas as páginas de um recurso seguindo o link rel="next" (máximo de 100 itens por página). */
async function todasPaginas<T>(url: string): Promise<T[]> {
  const itens: T[] = [];
  let proxima: string | undefined = url + (url.includes("?") ? "&" : "?") + "itens=100";
  while (proxima) {
    const p: Pagina<T> | null = await buscarJson<Pagina<T>>(proxima);
    if (!p) break;
    itens.push(...p.dados);
    proxima = p.links?.find((l) => l.rel === "next")?.href;
  }
  return itens;
}

const PLENARIO = 180; // idOrgao do Plenário da Câmara

// ---------------- Cadastro de deputados (1×/dia) ----------------

export const cadastro = () => executarTarefa("camara", "cadastro_deputados", async (c) => {
  const lista = await todasPaginas<Parameters<typeof normalizarDeputado>[0]>(`${API}/deputados?ordem=ASC&ordenarPor=nome`);
  const emExercicio = new Set(lista.map((d) => d.id));
  await emLotes(lista, 3, async (d) => {
    const det = await buscarJson<{ dados: Parameters<typeof normalizarDeputado>[1] }>(`${API}/deputados/${d.id}`);
    await salvarParlamentar(normalizarDeputado(d, det?.dados ?? null, new Date()));
    c.lidos++;
  });
  // Quem saiu da lista de exercício (licença, posse de suplente, cassação) deixa de aparecer como em exercício
  const atuais = await db.select({ id: s.parlamentar.id, idFonte: s.parlamentar.idFonte }).from(s.parlamentar)
    .where(and(eq(s.parlamentar.casa, "CD"), eq(s.parlamentar.emExercicio, true)));
  const sairam = atuais.filter((p) => !emExercicio.has(p.idFonte)).map((p) => p.id);
  if (sairam.length) {
    await db.update(s.parlamentar).set({ emExercicio: false, situacao: "Fora de exercício" }).where(inArray(s.parlamentar.id, sairam));
    c.alterados += sairam.length;
  }
});

// ---------------- Agenda: eventos de ontem até daqui a 7 dias ----------------

type EventoApi = Parameters<typeof normalizarEvento>[0];

async function coletarEvento(e: EventoApi, mapa: Map<number, number>, c: { lidos: number; alterados: number }) {
  const n = normalizarEvento(e, new Date());
  // Pauta só de eventos deliberativos (sessões e reuniões que votam)
  let pauta = null;
  if (n.deliberativa && n.status !== "cancelada") {
    const p = await buscarJson<{ dados: Parameters<typeof normalizarPauta>[0] }>(`${API}/eventos/${e.id}/pauta`, { aceitar: [404] });
    pauta = p ? normalizarPauta(p.dados) : null;
  }
  const { id, mudou } = await salvarEvento({ ...n, pauta });
  c.lidos++;
  if (mudou) c.alterados++;
  // Presentes: só quando o evento terminou (a lista é definitiva)
  if (n.status === "encerrada" && n.deliberativa) {
    const pres = await buscarJson<{ dados: { id: number }[] }>(`${API}/eventos/${e.id}/deputados`, { aceitar: [404] });
    const linhas = (pres?.dados ?? []).map((d) => mapa.get(d.id)).filter((x): x is number => !!x).map((parlamentarId) => ({ eventoId: id, parlamentarId }));
    if (linhas.length) await db.insert(s.presencaEvento).values(linhas).onConflictDoNothing();
  }
  return id;
}

export const agenda = (de = somarDias(hojeBrasilia(), -1), ate = somarDias(hojeBrasilia(), 7)) =>
  executarTarefa("camara", "agenda", async (c) => {
    const mapa = await mapaParlamentares("CD");
    const eventos = await todasPaginas<EventoApi>(`${API}/eventos?dataInicio=${de}&dataFim=${ate}&ordem=ASC&ordenarPor=dataHoraInicio`);
    await emLotes(eventos, 2, async (e) => { await coletarEvento(e, mapa, c); });
  });

// ---------------- Votações do Plenário ----------------

async function coletarProposicao(idCamara: number) {
  const p = await buscarJson<{ dados: Parameters<typeof normalizarProposicao>[0] }>(`${API}/proposicoes/${idCamara}`, { aceitar: [404] });
  if (!p) return null;
  const id = await salvarProposicao(normalizarProposicao(p.dados, new Date()));
  const tram = await buscarJson<{ dados: Parameters<typeof normalizarTramitacoes>[0] }>(`${API}/proposicoes/${idCamara}/tramitacoes`, { aceitar: [404] });
  const linhas = normalizarTramitacoes(tram?.dados ?? []).map((t) => ({ ...t, proposicaoId: id }));
  for (let i = 0; i < linhas.length; i += 500) {
    await db.insert(s.tramitacao).values(linhas.slice(i, i + 500)).onConflictDoNothing();
  }
  return id;
}

export const votacoes = (de = somarDias(hojeBrasilia(), -3), ate = hojeBrasilia()) =>
  executarTarefa("camara", "votacoes", async (c) => {
    const mapa = await mapaParlamentares("CD");
    const lista = await todasPaginas<{ id: string }>(`${API}/votacoes?idOrgao=${PLENARIO}&dataInicio=${de}&dataFim=${ate}&ordem=ASC&ordenarPor=dataHoraRegistro`);
    const proposicoesVistas = new Map<number, number | null>();
    await emLotes(lista, 2, async ({ id: idVot }) => {
      const det = await buscarJson<{ dados: Parameters<typeof normalizarVotacao>[0] }>(`${API}/votacoes/${idVot}`, { aceitar: [404] });
      if (!det) return;
      // 404 em /votos = votação simbólica, sem registro nominal
      const votos = (await buscarJson<{ dados: Parameters<typeof normalizarVotacao>[1] }>(`${API}/votacoes/${idVot}/votos`, { aceitar: [404] }))?.dados ?? [];
      const n = normalizarVotacao(det.dados, votos, new Date());

      let eventoId: number | null = null;
      if (n.idEventoFonte) {
        eventoId = await idEvento("CD", n.idEventoFonte);
        if (!eventoId) {
          const ev = await buscarJson<{ dados: EventoApi }>(`${API}/eventos/${n.idEventoFonte}`, { aceitar: [404] });
          if (ev) eventoId = await coletarEvento(ev.dados, mapa, { lidos: 0, alterados: 0 });
        }
      }
      let proposicaoId: number | null = null;
      if (n.proposicao) {
        if (!proposicoesVistas.has(n.proposicao.idCamara)) proposicoesVistas.set(n.proposicao.idCamara, await coletarProposicao(n.proposicao.idCamara));
        proposicaoId = proposicoesVistas.get(n.proposicao.idCamara) ?? null;
      }
      const { id } = await salvarVotacao({ ...n.votacao, eventoId, proposicaoId });
      const orient = n.votacao.nominal
        ? normalizarOrientacoes((await buscarJson<{ dados: Parameters<typeof normalizarOrientacoes>[0] }>(`${API}/votacoes/${idVot}/orientacoes`, { aceitar: [404] }))?.dados ?? [])
        : [];
      const linhasVoto = n.votos.flatMap((v) => {
        const parlamentarId = mapa.get(v.idDeputado);
        return parlamentarId ? [{ votacaoId: id, parlamentarId, partido: v.partido, tipoVoto: v.tipoVoto, tipoVotoOriginal: v.tipoVotoOriginal, registradoEm: v.registradoEm }] : [];
      });
      await substituirFilhos(id, linhasVoto, orient.map((o) => ({ ...o, votacaoId: id })));
      c.lidos++;
    });
  });

// ---------------- Despesas: arquivo anual da cota parlamentar ----------------

export const despesas = (ano = Number(hojeBrasilia().slice(0, 4))) =>
  executarTarefa("camara", `despesas_${ano}`, async (c) => {
    const mapa = await mapaParlamentares("CD");
    const r = await buscar(`https://www.camara.leg.br/cotas/Ano-${ano}.json.zip`, { accept: "application/zip", timeoutMs: 300_000 });
    const arquivos = unzipSync(new Uint8Array(r.corpo));
    const nome = Object.keys(arquivos).find((n) => n.endsWith(".json"));
    if (!nome) throw new Error("ZIP da cota sem arquivo JSON");
    const { dados } = JSON.parse(strFromU8(arquivos[nome])) as { dados: Parameters<typeof normalizarDespesa>[0][] };
    const linhas = dados.flatMap((d) => {
      const n = normalizarDespesa(d);
      const parlamentarId = n ? mapa.get(n.idDeputado) : undefined;
      if (!n || !parlamentarId) return [];
      const { idDeputado: _, ...resto } = n;
      return [{ ...resto, parlamentarId }];
    });
    c.lidos = linhas.length;
    await salvarDespesas(linhas);
  });

// ---------------- Presença: totais oficiais do perfil (robots.txt permite) ----------------

export const presenca = (ano = Number(hojeBrasilia().slice(0, 4))) =>
  executarTarefa("camara", `presenca_${ano}`, async (c) => {
    const deps = await db.select({ id: s.parlamentar.id, idFonte: s.parlamentar.idFonte }).from(s.parlamentar)
      .where(and(eq(s.parlamentar.casa, "CD"), eq(s.parlamentar.emExercicio, true)));
    let falhas = 0;
    await emLotes(deps, 1, async (d) => {
      const url = `https://www.camara.leg.br/deputados/${d.idFonte}?ano=${ano}`;
      try {
        const p = lerPresencaPerfil(await buscarTexto(url));
        const agora = new Date();
        for (const [ambito, v] of Object.entries(p)) {
          if (!v) continue;
          const linha = { parlamentarId: d.id, ano, ambito, ...v, unidade: ambito === "plenario" ? "dias" : "reunioes", fonteUrl: url, coletadoEm: agora };
          await db.insert(s.presencaResumo).values(linha).onConflictDoUpdate({
            target: [s.presencaResumo.parlamentarId, s.presencaResumo.ano, s.presencaResumo.ambito], set: linha,
          });
        }
        c.lidos++;
      } catch (e) {
        if (++falhas > 20) throw e; // muitas falhas: aborta e marca a coleta como parcial
      }
    });
  });

// ---------------- Autoria de proposições principais desde o início da legislatura ----------------

const TIPOS_AUTORIA = ["PL", "PLP", "PEC", "PDL", "MPV"];

export const autoria = (desde = "2023-02-01") =>
  executarTarefa("camara", "autoria", async (c) => {
    const deps = await db.select({ id: s.parlamentar.id, idFonte: s.parlamentar.idFonte }).from(s.parlamentar)
      .where(and(eq(s.parlamentar.casa, "CD"), eq(s.parlamentar.emExercicio, true)));
    const tipos = TIPOS_AUTORIA.map((t) => `siglaTipo=${t}`).join("&");
    await emLotes(deps, 2, async (d) => {
      type P = { id: number; siglaTipo: string; numero: number; ano: number; ementa: string };
      const props = await todasPaginas<P>(`${API}/proposicoes?idDeputadoAutor=${d.idFonte}&${tipos}&dataApresentacaoInicio=${desde}&ordem=DESC&ordenarPor=id`);
      for (const p of props) {
        const proposicaoId = await salvarProposicao({
          sigla: p.siglaTipo, numero: p.numero, ano: p.ano, idCamara: p.id, ementa: limpar(p.ementa),
          slug: slugProposicao(p.siglaTipo, p.numero, p.ano), atualizadoEm: new Date(),
        });
        await db.insert(s.autoria).values({ proposicaoId, parlamentarId: d.id }).onConflictDoNothing();
        c.lidos++;
      }
    });
  });

/** Atualiza situação e tramitação das proposições que mudaram recentemente (seguidas pelo portal). */
export const tramitacoesRecentes = (dias = 2) =>
  executarTarefa("camara", "tramitacoes_recentes", async (c) => {
    const desde = somarDias(hojeBrasilia(), -dias);
    // A API filtra por data da última tramitação; só proposições que já conhecemos são atualizadas
    const lista = await todasPaginas<{ id: number }>(`${API}/proposicoes?dataInicio=${desde}&${TIPOS_AUTORIA.map((t) => `siglaTipo=${t}`).join("&")}`);
    const conhecidas = new Set(
      (await db.select({ idCamara: s.proposicao.idCamara }).from(s.proposicao).where(gte(s.proposicao.idCamara, 0))).map((p) => p.idCamara),
    );
    await emLotes(lista.filter((p) => conhecidas.has(p.id)), 2, async (p) => {
      try { await coletarProposicao(p.id); c.lidos++; } catch (e) { if (!(e instanceof ErroHttp)) throw e; }
    });
  });
