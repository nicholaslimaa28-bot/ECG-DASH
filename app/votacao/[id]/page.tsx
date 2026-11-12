// Votação nominal: voto de cada parlamentar, com a orientação das bancadas.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { orientacoes, votosDaVotacao, type Votacao } from "@/lib/consultas";
import { formatarData, formatarHora } from "@/lib/tempo";
import { Fonte } from "@/components/Fonte";
import { Placar } from "@/components/Placar";
import { SeloCasa, rotuloVoto } from "@/components/Selos";

// ISR sob demanda: cada página é gerada na primeira visita e revalidada depois
export async function generateStaticParams() { return []; }
export const revalidate = 600;
type Props = { params: Promise<{ id: string }> };

async function votacao(id: number): Promise<Votacao | null> {
  const [v] = await sql<Votacao[]>`
    SELECT v.id, v.casa, v.data_hora AS "dataHora", v.descricao, v.nominal, v.secreta, v.aprovada, v.placar_sim AS "placarSim", v.placar_nao AS "placarNao",
      v.placar_abstencao AS "placarAbstencao", v.placar_obstrucao AS "placarObstrucao", v.placar_calculado AS "placarCalculado",
      v.fonte_url AS "fonteUrl", v.coletado_em AS "coletadoEm", v.evento_id AS "eventoId",
      CASE WHEN p.id IS NULL THEN NULL ELSE json_build_object('sigla', p.sigla, 'numero', p.numero, 'ano', p.ano, 'slug', p.slug, 'ementa', p.ementa, 'apelido', p.apelido) END AS proposicao
    FROM votacao v LEFT JOIN proposicao p ON p.id = v.proposicao_id WHERE v.id = ${id}`;
  return v ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const v = await votacao(Number((await params).id));
  return v ? { title: `Votação de ${formatarData(v.dataHora)}${v.proposicao ? ` — ${v.proposicao.sigla} ${v.proposicao.numero}/${v.proposicao.ano}` : ""}` } : {};
}

export default async function PaginaVotacao({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const v = await votacao(id);
  if (!v) notFound();
  const [votos, orient] = await Promise.all([votosDaVotacao(v.id), orientacoes([v.id])]);
  const porPartido = new Map<string, typeof votos>();
  for (const x of votos) porPartido.set(x.partido ?? "Sem partido", [...(porPartido.get(x.partido ?? "Sem partido") ?? []), x]);
  const partidos = [...porPartido.keys()].sort((a, b) => a.localeCompare(b));

  return (
    <article className="space-y-6">
      <header>
        <p className="text-sm"><SeloCasa casa={v.casa} /> <time className="tabular text-suave">{formatarData(v.dataHora)} às {formatarHora(v.dataHora)}</time></p>
        {v.proposicao && <h1 className="text-2xl font-bold"><Link href={`/proposicao/${v.proposicao.slug}`}>{v.proposicao.sigla} {v.proposicao.numero}/{v.proposicao.ano}</Link>{v.proposicao.apelido ? ` — ${v.proposicao.apelido}` : ""}</h1>}
        <p className="mt-1">{v.descricao}</p>
        <div className="mt-2"><Placar v={v} /></div>
        {v.eventoId && <p className="mt-1 text-sm"><Link href={`/sessao/${v.eventoId}`}>Ver a sessão</Link></p>}
      </header>

      {(orient.get(v.id) ?? []).length > 0 && (
        <section className="rounded-lg border border-borda bg-superficie p-4">
          <h2 className="mb-2 text-lg font-semibold">Orientação das bancadas</h2>
          <ul className="grid grid-cols-2 gap-x-4 text-sm sm:grid-cols-4">
            {(orient.get(v.id) ?? []).map((o) => <li key={o.bancada} className="flex justify-between border-b border-borda/60 py-0.5"><span>{o.bancada}</span><strong>{rotuloVoto(o.orientacao)}</strong></li>)}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-borda bg-superficie p-4">
        <h2 className="mb-2 text-lg font-semibold">Votos ({votos.length})</h2>
        {votos.length ? partidos.map((partido) => (
          <details key={partido} className="border-t border-borda py-1 first:border-0">
            <summary className="cursor-pointer text-sm font-medium">{partido} ({porPartido.get(partido)!.length})</summary>
            <ul className="columns-1 py-1 text-sm sm:columns-2">
              {porPartido.get(partido)!.map((x) => (
                <li key={x.slug}><Link href={`/parlamentar/${x.slug}`}>{x.nome}</Link> <span className="text-suave">({x.uf})</span>: <strong>{rotuloVoto(x.tipoVoto)}</strong>{x.tipoVoto === "ausente" ? <span className="text-suave"> — {x.tipoVotoOriginal}</span> : null}</li>
              ))}
            </ul>
          </details>
        )) : <p className="text-suave">Votos individuais não publicados para esta votação.</p>}
        {v.casa === "CD" && <p className="mt-2 text-xs text-suave">A Câmara publica só quem votou; quem não aparece não registrou voto (o motivo não é informado aqui).</p>}
      </section>
      <Fonte orgao={v.casa === "CD" ? "Câmara dos Deputados — votações" : "Senado Federal — votações nominais"} url={v.fonteUrl} em={v.coletadoEm} />
    </article>
  );
}
