// Coletor de sanções, vetos, leis e medidas provisórias (API do Senado / Congresso Nacional).
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { buscarJson } from "../http";
import { executarTarefa, salvarProposicao } from "../comum";
import { hojeBrasilia } from "@/lib/tempo";
import { slugProposicao, lerIdentificacao, limpar } from "@/lib/texto";
import { API, vetosDaLista, dispositivosDoResultado, normalizarVeto, leisDaLista, normalizarMpv } from "./normalizar";

const json = <T>(url: string) => buscarJson<T>(url, { aceitar: [404], timeoutMs: 120_000 });
const anoAtual = () => Number(hojeBrasilia().slice(0, 4));

// ---------------- Vetos ----------------

export const vetos = (anos = [anoAtual() - 1, anoAtual()]) =>
  executarTarefa("senado", "vetos", async (c) => {
    for (const ano of anos) {
      const lista = await json<Record<string, never>>(`${API}/materia/vetos/${ano}.json`);
      for (const v of lista ? vetosDaLista(lista) : []) {
        // Resultado por dispositivo: só consulta de novo se o veto ainda estiver em tramitação ou nunca foi coletado
        const [antes] = await db.select({ id: s.veto.id, emTramitacao: s.veto.emTramitacao, resultado: s.veto.resultado }).from(s.veto).where(eq(s.veto.codigoSenado, Number(v.Codigo)));
        const precisaResultado = !antes || antes.emTramitacao !== false || v.Materia.EmTramitacao === "Sim";
        let dispositivos = null;
        if (precisaResultado) {
          const r = await json<Parameters<typeof dispositivosDoResultado>[0]>(`${API}/plenario/resultado/veto/materia/${v.Materia.Codigo}.json`);
          dispositivos = r ? dispositivosDoResultado(r) : null;
        }
        const n = normalizarVeto(v, dispositivos, new Date());
        const proposicaoId = await salvarProposicao({ ...n.proposicao, atualizadoEm: new Date() });
        const linha = { ...n.veto, proposicaoId, ...(dispositivos ? {} : { dispositivos: undefined, resultado: antes?.resultado ?? n.veto.resultado }) };
        const [r] = await db.insert(s.veto).values(linha).onConflictDoUpdate({ target: s.veto.codigoSenado, set: linha }).returning({ id: s.veto.id });
        if (!antes) {
          await db.insert(s.mudanca).values({ tipo: "novo_veto", entidade: "veto", entidadeId: r.id, dados: { numero: n.veto.numero, ano: n.veto.ano, total: n.veto.total } });
        } else if (antes.resultado !== linha.resultado) {
          await db.insert(s.mudanca).values({ tipo: "veto_mudou", entidade: "veto", entidadeId: r.id, dados: { antes: antes.resultado, depois: linha.resultado } });
          c.alterados++;
        }
        c.lidos++;
      }
    }
  });

// ---------------- Leis publicadas e projeto de origem ----------------

type ProcessoLista = { id: number; identificacao: string; ementa?: string; situacaoAtual?: string; casaIdentificadora?: string };

export const leis = (ano = anoAtual()) =>
  executarTarefa("senado", `leis_${ano}`, async (c) => {
    for (const tipo of ["LEI-n", "LCP"]) {
      const lista = await json<Parameters<typeof leisDaLista>[0]>(`${API}/legislacao/lista.json?tipo=${tipo}&ano=${ano}`);
      for (const l of lista ? leisDaLista(lista) : []) {
        const [antes] = await db.select({ origem: s.norma.origemConsultada }).from(s.norma).where(eq(s.norma.codigo, l.codigo));
        const { tipoFonte, ...dados } = l;
        let proposicaoId: number | null = null;
        let origemConsultada = antes?.origem ?? false;
        if (!origemConsultada) {
          // Projeto que originou a lei (sanção ou promulgação)
          const procs = await json<ProcessoLista[]>(`${API}/processo?tipoNorma=${tipoFonte === "LCP" ? "LCP" : "LEI"}&numeroNorma=${l.numero}&anoNorma=${l.ano}`);
          origemConsultada = procs !== null;
          const p = procs?.[0];
          const id = p ? lerIdentificacao(p.identificacao) : null;
          if (p && id) {
            proposicaoId = await salvarProposicao({
              ...id, idSenado: p.id, ementa: limpar(p.ementa ?? null), slug: slugProposicao(id.sigla, id.numero, id.ano),
              normaGerada: l.nome, urlNorma: l.url, dataNorma: l.dataAssinatura, atualizadoEm: new Date(),
            });
          }
        }
        const linha = { ...dados, origemConsultada, coletadoEm: new Date(), ...(proposicaoId ? { proposicaoId } : {}) };
        await db.insert(s.norma).values(linha).onConflictDoUpdate({ target: s.norma.codigo, set: linha });
        c.lidos++;
      }
    }
  });

// ---------------- Medidas provisórias ----------------

export const mpvs = (ano = anoAtual()) =>
  executarTarefa("senado", `mpvs_${ano}`, async (c) => {
    const lista = await json<Parameters<typeof normalizarMpv>[0][]>(`${API}/processo?sigla=MPV&ano=${ano}`);
    for (const p of lista ?? []) {
      const n = normalizarMpv(p, new Date());
      if (n) { await salvarProposicao(n); c.lidos++; }
    }
  });

