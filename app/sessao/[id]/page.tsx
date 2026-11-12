// Página de sessão/reunião: pauta, votações, presentes e vídeo.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { evento, votacoesDoEvento } from "@/lib/consultas";
import { formatarData, formatarHora } from "@/lib/tempo";
import { CANAIS, CASAS } from "@/lib/canais";
import { Fonte } from "@/components/Fonte";
import { Placar } from "@/components/Placar";
import { SeloCasa, SeloStatus } from "@/components/Selos";
import { slugProposicao } from "@/lib/texto";
import { ehPlenario } from "@/components/EventoItem";

// ISR sob demanda: cada página é gerada na primeira visita e revalidada depois
export async function generateStaticParams() { return []; }
export const revalidate = 120;
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = Number((await params).id);
  const e = Number.isInteger(id) ? await evento(id) : null;
  return e ? { title: `${e.titulo} — ${formatarData(e.inicio)}` } : {};
}

export default async function PaginaSessao({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const e = await evento(id);
  if (!e) notFound();
  const votos = await votacoesDoEvento(e.id);
  const presentes = await sql<{ nome: string; slug: string; partido: string | null; uf: string | null }[]>`
    SELECT p.nome_parlamentar AS nome, p.slug, p.partido, p.uf FROM presenca_evento pe JOIN parlamentar p ON p.id = pe.parlamentar_id
    WHERE pe.evento_id = ${e.id} ORDER BY lower(f_unaccent(p.nome_parlamentar))`;
  const canal = CANAIS[e.casa as keyof typeof CANAIS];
  // Proposições da pauta que já existem no banco viram links internos
  const slugs = (e.pauta ?? []).flatMap((i) => (i.proposicao ? [slugProposicao(i.proposicao.sigla, i.proposicao.numero, i.proposicao.ano)] : []));
  const existentes = new Set(slugs.length ? (await sql<{ slug: string }[]>`SELECT slug FROM proposicao WHERE slug IN ${sql(slugs)}`).map((r) => r.slug) : []);

  return (
    <article className="space-y-6">
      <header>
        <p className="flex flex-wrap items-center gap-2 text-sm"><SeloCasa casa={e.casa} /> <SeloStatus status={e.status} original={e.statusOriginal} /> <span className="text-suave">{e.tipo}</span></p>
        <h1 className="mt-1 text-2xl font-bold">{e.titulo}</h1>
        <p className="tabular">{formatarData(e.inicio, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}, {formatarHora(e.inicio)}{e.fim ? ` às ${formatarHora(e.fim)}` : ""}</p>
        {e.local && <p className="text-suave">{e.local}</p>}
        {e.descricao && <p className="mt-2 whitespace-pre-line text-sm">{e.descricao}</p>}
        <p className="mt-2 flex flex-wrap gap-x-4 text-sm">
          {e.linkVideo ? <a href={e.linkVideo} target="_blank" rel="noopener" className="font-medium">▶ Assistir</a>
            : ehPlenario(e) && canal ? <a href={canal.url} target="_blank" rel="noopener">▶ {canal.nome}</a> : null}
          {e.urlPauta && <a href={e.urlPauta} target="_blank" rel="noopener">Página oficial ({CASAS[e.casa]?.curto ?? e.casa})</a>}
        </p>
      </header>

      <section className="rounded-lg border border-borda bg-superficie p-4" aria-labelledby="pauta">
        <h2 id="pauta" className="mb-2 text-lg font-semibold">Pauta</h2>
        {e.pauta?.length ? (
          <ol className="space-y-2 text-sm">
            {e.pauta.map((i, n) => {
              const slug = i.proposicao ? slugProposicao(i.proposicao.sigla, i.proposicao.numero, i.proposicao.ano) : null;
              return (
                <li key={n}>
                  <span className="font-medium">{slug && existentes.has(slug) ? <Link href={`/proposicao/${slug}`}>{i.titulo}</Link> : i.titulo}</span>
                  {i.regime ? <span className="text-suave"> · {i.regime}</span> : null}
                  {i.ementa && <span className="block text-suave">{i.ementa}</span>}
                  {i.situacao && <span className="block text-xs">Situação: {i.situacao}</span>}
                </li>
              );
            })}
          </ol>
        ) : <p className="text-suave">Pauta não publicada nos dados abertos para este evento. Veja a página oficial.</p>}
      </section>

      <section className="rounded-lg border border-borda bg-superficie p-4" aria-labelledby="vot">
        <h2 id="vot" className="mb-2 text-lg font-semibold">Votações</h2>
        {votos.length ? (
          <ul>
            {votos.map((v) => (
              <li key={v.id} className="border-t border-borda py-2 first:border-0 text-sm">
                <p className="tabular text-suave">{formatarHora(v.dataHora)}</p>
                {v.proposicao && <p className="font-medium"><Link href={`/proposicao/${v.proposicao.slug}`}>{v.proposicao.sigla} {v.proposicao.numero}/{v.proposicao.ano}</Link></p>}
                <p>{v.descricao}</p>
                <Placar v={v} />
                {v.nominal && <Link href={`/votacao/${v.id}`}>Ver voto de cada parlamentar</Link>}
              </li>
            ))}
          </ul>
        ) : <p className="text-suave">Nenhuma votação de Plenário registrada neste evento.</p>}
      </section>

      {e.casa === "CD" && (
        <section className="rounded-lg border border-borda bg-superficie p-4" aria-labelledby="pres">
          <h2 id="pres" className="mb-2 text-lg font-semibold">Presentes {presentes.length ? `(${presentes.length})` : ""}</h2>
          {presentes.length ? (
            <details>
              <summary className="cursor-pointer text-sm">Ver lista de deputados presentes</summary>
              <ul className="mt-2 columns-1 text-sm sm:columns-2 md:columns-3">
                {presentes.map((p) => <li key={p.slug}><Link href={`/parlamentar/${p.slug}`}>{p.nome}</Link> <span className="text-suave">{p.partido}-{p.uf}</span></li>)}
              </ul>
            </details>
          ) : <p className="text-suave">{e.status === "encerrada" ? "Lista de presença não publicada para este evento." : "A lista de presença é coletada quando o evento termina."}</p>}
          <p className="mt-2 text-xs text-suave">A Câmara publica apenas quem registrou presença; ausências e justificativas estão na página de cada deputado.</p>
        </section>
      )}
      <Fonte orgao={CASAS[e.casa]?.nome ?? e.casa} url={e.fonteUrl} em={e.coletadoEm} />
    </article>
  );
}
