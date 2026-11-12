// Peças compartilhadas pelos coletores: registro de execução (/status), upserts e detecção de mudanças.
import { and, eq, sql as dsql } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { brutosDaExecucao, hashDe } from "./http";

export type Contador = { lidos: number; alterados: number };

/**
 * Executa uma tarefa de coleta registrando início, fim, contagens e erro.
 * Atualiza o contador de falhas seguidas da fonte (o /status alerta a partir de 3).
 */
export async function executarTarefa(fonteId: string, tarefa: string, fn: (c: Contador) => Promise<void>) {
  const [reg] = await db.insert(s.coleta).values({ fonteId, tarefa, iniciadoEm: new Date(), status: "rodando" }).returning({ id: s.coleta.id });
  const c: Contador = { lidos: 0, alterados: 0 };
  const inicioBrutos = brutosDaExecucao.length;
  let status = "ok";
  let erro: string | null = null;
  try {
    await fn(c);
  } catch (e) {
    status = c.lidos > 0 ? "parcial" : "erro";
    erro = e instanceof Error ? `${e.message}\n${e.stack ?? ""}`.slice(0, 4000) : String(e);
    console.error(`[${fonteId}/${tarefa}]`, e);
  }
  // Referências às respostas brutas desta tarefa
  const novos = brutosDaExecucao.slice(inicioBrutos);
  for (let i = 0; i < novos.length; i += 500) {
    await db.insert(s.bruto).values(novos.slice(i, i + 500).map((b) => ({
      coletaId: reg.id, url: b.url, statusHttp: b.status, sha256: b.sha256, armazenamento: b.arquivo, coletadoEm: b.coletadoEm,
    })));
  }
  await db.update(s.coleta).set({ terminadoEm: new Date(), status, itensLidos: c.lidos, itensAlterados: c.alterados, erro }).where(eq(s.coleta.id, reg.id));
  if (status === "ok") await db.update(s.fonte).set({ falhasSeguidas: 0 }).where(eq(s.fonte.id, fonteId));
  else await db.update(s.fonte).set({ falhasSeguidas: dsql`${s.fonte.falhasSeguidas} + 1` }).where(eq(s.fonte.id, fonteId));
  console.log(`[${fonteId}/${tarefa}] ${status}: ${c.lidos} lidos, ${c.alterados} alterados`);
  return status;
}

/** Executa `fn` sobre os itens com no máximo `n` em paralelo (o ritmo por servidor continua limitado em http.ts). */
export async function emLotes<T>(itens: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, itens.length) }, async () => {
    while (i < itens.length) await fn(itens[i++]);
  }));
}

// ---------------- Parlamentares ----------------

type NovoParlamentar = typeof s.parlamentar.$inferInsert;

export async function salvarParlamentar(p: NovoParlamentar): Promise<number> {
  const [r] = await db.insert(s.parlamentar).values(p)
    .onConflictDoUpdate({ target: [s.parlamentar.casa, s.parlamentar.idFonte], set: { ...p } })
    .returning({ id: s.parlamentar.id });
  return r.id;
}

/** Mapa idFonte → id interno dos parlamentares de uma Casa. */
export async function mapaParlamentares(casa: "CD" | "SF"): Promise<Map<number, number>> {
  const linhas = await db.select({ id: s.parlamentar.id, idFonte: s.parlamentar.idFonte }).from(s.parlamentar).where(eq(s.parlamentar.casa, casa));
  return new Map(linhas.map((l) => [l.idFonte, l.id]));
}

// ---------------- Eventos ----------------

type NovoEvento = Omit<typeof s.evento.$inferInsert, "hashConteudo">;

/** Grava o evento e registra mudança de status/horário (novo_evento | evento_mudou). Devolve o id e se mudou. */
export async function salvarEvento(e: NovoEvento): Promise<{ id: number; mudou: boolean }> {
  const conteudo = { inicio: e.inicio, status: e.status, titulo: e.titulo, pauta: e.pauta ?? null, local: e.local };
  const hash = hashDe(conteudo);
  const [antes] = await db.select({ id: s.evento.id, hash: s.evento.hashConteudo, status: s.evento.status, inicio: s.evento.inicio, pauta: s.evento.pauta })
    .from(s.evento).where(and(eq(s.evento.casa, e.casa), eq(s.evento.idFonte, e.idFonte)));
  // Não apagar a pauta já coletada quando a nova coleta não a trouxe
  const valores = { ...e, pauta: e.pauta ?? antes?.pauta ?? null, hashConteudo: hash };
  const [r] = await db.insert(s.evento).values(valores)
    .onConflictDoUpdate({ target: [s.evento.casa, s.evento.idFonte], set: valores })
    .returning({ id: s.evento.id });
  if (!antes) {
    await db.insert(s.mudanca).values({ tipo: "novo_evento", entidade: "evento", entidadeId: r.id, dados: { status: e.status, inicio: e.inicio } });
    return { id: r.id, mudou: true };
  }
  if (antes.hash !== hash) {
    if (antes.status !== e.status || antes.inicio.getTime() !== e.inicio.getTime()) {
      await db.insert(s.mudanca).values({
        tipo: "evento_mudou", entidade: "evento", entidadeId: r.id,
        dados: { antes: { status: antes.status, inicio: antes.inicio }, depois: { status: e.status, inicio: e.inicio } },
      });
    }
    return { id: r.id, mudou: true };
  }
  return { id: r.id, mudou: false };
}

export async function idEvento(casa: string, idFonte: string): Promise<number | null> {
  const [r] = await db.select({ id: s.evento.id }).from(s.evento).where(and(eq(s.evento.casa, casa), eq(s.evento.idFonte, idFonte)));
  return r?.id ?? null;
}

// ---------------- Proposições (uma linha para as duas Casas) ----------------

type DadosProposicao = { sigla: string; numero: number; ano: number; slug: string; atualizadoEm: Date } & Partial<typeof s.proposicao.$inferInsert>;

/**
 * Cria ou completa a proposição pela chave (sigla, número, ano). Campos nulos não apagam o que a outra Casa já informou.
 * Registra `mudou_status` quando a situação em alguma Casa muda.
 */
export async function salvarProposicao(p: DadosProposicao): Promise<number> {
  const [antes] = await db.select().from(s.proposicao)
    .where(and(eq(s.proposicao.sigla, p.sigla), eq(s.proposicao.numero, p.numero), eq(s.proposicao.ano, p.ano)));
  const limpo = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== null && v !== undefined)) as DadosProposicao;
  if (!antes) {
    const [r] = await db.insert(s.proposicao).values(limpo).onConflictDoNothing().returning({ id: s.proposicao.id });
    if (r) return r.id;
    return salvarProposicao(p); // corrida com outra inserção: tenta de novo como atualização
  }
  await db.update(s.proposicao).set(limpo).where(eq(s.proposicao.id, antes.id));
  if (limpo.normaGerada && !antes.normaGerada) {
    await db.insert(s.mudanca).values({ tipo: "virou_norma", entidade: "proposicao", entidadeId: antes.id, dados: { norma: limpo.normaGerada } });
  }
  for (const campo of ["situacaoCamara", "situacaoSenado"] as const) {
    if (limpo[campo] && antes[campo] && limpo[campo] !== antes[campo]) {
      await db.insert(s.mudanca).values({
        tipo: "mudou_status", entidade: "proposicao", entidadeId: antes.id,
        dados: { casa: campo === "situacaoCamara" ? "CD" : "SF", antes: antes[campo], depois: limpo[campo] },
      });
    }
  }
  return antes.id;
}

// ---------------- Votações ----------------

type NovaVotacao = typeof s.votacao.$inferInsert;

export async function salvarVotacao(v: NovaVotacao): Promise<{ id: number; nova: boolean }> {
  const [antes] = await db.select({ id: s.votacao.id }).from(s.votacao).where(and(eq(s.votacao.casa, v.casa), eq(s.votacao.idFonte, v.idFonte)));
  const [r] = await db.insert(s.votacao).values(v)
    .onConflictDoUpdate({ target: [s.votacao.casa, s.votacao.idFonte], set: v })
    .returning({ id: s.votacao.id });
  if (!antes) {
    await db.insert(s.mudanca).values({ tipo: "nova_votacao", entidade: "votacao", entidadeId: r.id, dados: { casa: v.casa, aprovada: v.aprovada, descricao: v.descricao } });
  }
  return { id: r.id, nova: !antes };
}

/** Substitui os votos/orientações de uma votação (a fonte é a referência completa). */
export async function substituirFilhos(votacaoId: number, votos: (typeof s.voto.$inferInsert)[], orient: (typeof s.orientacao.$inferInsert)[]) {
  // Tudo numa transação: a página nunca vê a votação "sem votos" no meio da atualização
  await db.transaction(async (tx) => {
    await tx.delete(s.voto).where(eq(s.voto.votacaoId, votacaoId));
    await tx.delete(s.orientacao).where(eq(s.orientacao.votacaoId, votacaoId));
    for (let i = 0; i < votos.length; i += 200) await tx.insert(s.voto).values(votos.slice(i, i + 200)).onConflictDoNothing();
    if (orient.length) await tx.insert(s.orientacao).values(orient).onConflictDoNothing();
  });
}

// ---------------- Despesas ----------------

export async function salvarDespesas(todas: (typeof s.despesa.$inferInsert)[]) {
  // Um upsert não pode tocar a mesma linha duas vezes no mesmo comando: fica a última ocorrência
  const linhas = [...new Map(todas.map((l) => [`${l.parlamentarId}|${l.idFonte}`, l])).values()];
  for (let i = 0; i < linhas.length; i += 1000) {
    await db.insert(s.despesa).values(linhas.slice(i, i + 1000)).onConflictDoUpdate({
      target: [s.despesa.parlamentarId, s.despesa.idFonte],
      set: {
        valor: dsql`excluded.valor`, categoria: dsql`excluded.categoria`, fornecedorNome: dsql`excluded.fornecedor_nome`,
        fornecedorCnpj: dsql`excluded.fornecedor_cnpj`, dataDocumento: dsql`excluded.data_documento`, urlDocumento: dsql`excluded.url_documento`,
      },
    });
  }
}
