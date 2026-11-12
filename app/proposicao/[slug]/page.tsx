// Página de proposição: ementa, situação em cada Casa, autores, votações e tramitação.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { proposicaoPorSlug, tramitacoes, votacoesDaProposicao, autoresDaProposicao, orientacoes, vetosDaProposicao } from "@/lib/consultas";
import { VetoItem } from "@/components/Veto";
import { Termo } from "@/components/Termo";
import { formatarData, formatarHora } from "@/lib/tempo";
import { Fonte } from "@/components/Fonte";
import { Placar } from "@/components/Placar";
import { SeloCasa, rotuloVoto } from "@/components/Selos";
import { TermoSigla } from "@/components/Termo";

// ISR sob demanda: cada página é gerada na primeira visita e revalidada depois
export async function generateStaticParams() { return []; }
export const revalidate = 600;
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await proposicaoPorSlug((await params).slug);
  if (!p) return {};
  return {
    title: `${p.sigla} ${p.numero}/${p.ano}${p.apelido ? ` — ${p.apelido}` : ""}`,
    description: p.ementa?.slice(0, 200) ?? undefined,
    alternates: { canonical: `/proposicao/${p.slug}` },
  };
}

export default async function PaginaProposicao({ params }: Props) {
  const p = await proposicaoPorSlug((await params).slug);
  if (!p) notFound();
  const [tram, votos, autores, vetos] = await Promise.all([tramitacoes(p.id), votacoesDaProposicao(p.id), autoresDaProposicao(p.id), vetosDaProposicao(p.id)]);
  const orient = await orientacoes(votos.filter((v) => v.nominal).map((v) => v.id));
  const linkCamara = p.idCamara ? `https://www.camara.leg.br/propostas-legislativas/${p.idCamara}` : null;
  const linkSenado = p.idSenado ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${p.idSenado}` : null;

  return (
    <article className="space-y-6">
      <header>
        <p className="text-sm text-suave"><TermoSigla sigla={p.sigla} />{p.dataApresentacao ? ` · apresentada em ${formatarData(p.dataApresentacao)}` : ""}</p>
        <h1 className="text-2xl font-bold">{p.sigla} {p.numero}/{p.ano}{p.apelido ? <span className="font-normal"> — {p.apelido}</span> : null}</h1>
        {p.ementa && <p className="mt-2">{p.ementa}</p>}
        <p className="mt-2 text-xs text-suave">A ementa é o resumo oficial do texto. Para o conteúdo completo, leia o texto oficial.</p>
        <p className="mt-2 flex flex-wrap gap-x-4 text-sm">
          {p.urlInteiroTeor && <a href={p.urlInteiroTeor} target="_blank" rel="noopener">Texto oficial</a>}
          {linkCamara && <a href={linkCamara} target="_blank" rel="noopener">Na Câmara</a>}
          {linkSenado && <a href={linkSenado} target="_blank" rel="noopener">No Senado</a>}
        </p>
      </header>

      <section className="rounded-lg border border-borda bg-superficie p-4" aria-labelledby="sit">
        <h2 id="sit" className="mb-2 text-lg font-semibold">Situação atual</h2>
        <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]">
          {p.casaIniciadora && <><dt className="text-suave">Começou na</dt><dd>{p.casaIniciadora === "CD" ? "Câmara dos Deputados" : p.casaIniciadora === "SF" ? "Senado Federal" : p.casaIniciadora}</dd></>}
          <dt className="text-suave">Câmara</dt><dd>{p.situacaoCamara ?? "sem informação coletada"}</dd>
          <dt className="text-suave">Senado</dt><dd>{p.situacaoSenado ?? "sem informação coletada"}</dd>
        </dl>
        {autores.length > 0 && (
          <p className="mt-2 text-sm">
            Autoria: {autores.map((a, i) => (
              <span key={a.slug}>{i ? ", " : ""}<Link href={`/parlamentar/${a.slug}`}>{a.nome}</Link> ({a.partido}-{a.uf})</span>
            ))}
          </p>
        )}
        <Fonte orgao="Câmara dos Deputados e Senado Federal" url={linkCamara ?? linkSenado ?? "https://dadosabertos.camara.leg.br"} em={p.atualizadoEm} />
      </section>

      {(p.normaGerada || vetos.length > 0) && (
        <section className="rounded-lg border border-borda bg-superficie p-4" aria-labelledby="sancao">
          <h2 id="sancao" className="mb-2 text-lg font-semibold"><Termo id="sancao">Sanção</Termo> e veto</h2>
          {p.normaGerada && (
            <p className="text-sm">
              Virou <strong>{p.urlNorma ? <a href={p.urlNorma} target="_blank" rel="noopener">{p.normaGerada}</a> : p.normaGerada}</strong>
              {vetos.some((v) => v.total === false) ? ", com veto parcial." : vetos.some((v) => v.total && v.resultado.startsWith("derrubado")) ? <>, depois que o Congresso derrubou o veto total (<Termo id="promulgacao">promulgação</Termo>).</> : "."}
            </p>
          )}
          {vetos.length > 0 && (
            <ul className="mt-2 space-y-3">{vetos.map((v) => <li key={v.id} className="border-t border-borda pt-2 first:border-0 first:pt-0"><VetoItem v={v} mostrarProposicao={false} detalhar /></li>)}</ul>
          )}
          <Fonte orgao="Congresso Nacional — vetos e normas (API do Senado)" url={vetos[0]?.fonteUrl ?? "https://legis.senado.leg.br/dadosabertos"} em={vetos[0]?.coletadoEm ?? p.atualizadoEm} />
        </section>
      )}

      <section className="rounded-lg border border-borda bg-superficie p-4" aria-labelledby="vot">
        <h2 id="vot" className="mb-2 text-lg font-semibold">Votações em Plenário</h2>
        {votos.length ? (
          <ul>
            {votos.map((v) => (
              <li key={v.id} className="border-t border-borda py-2 first:border-0">
                <p className="text-sm"><SeloCasa casa={v.casa} /> <time className="tabular text-suave">{formatarData(v.dataHora)} às {formatarHora(v.dataHora)}</time></p>
                <p className="text-sm">{v.descricao}</p>
                <Placar v={v} />
                {v.nominal && <p className="text-sm"><Link href={`/votacao/${v.id}`}>Ver voto de cada parlamentar</Link></p>}
                {(orient.get(v.id) ?? []).length > 0 && (
                  <p className="text-xs text-suave">Orientações: {(orient.get(v.id) ?? []).map((o) => `${o.bancada}: ${rotuloVoto(o.orientacao)}`).join(" · ")}</p>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="text-suave">Nenhuma votação em Plenário coletada para esta proposição.</p>}
      </section>

      <section className="rounded-lg border border-borda bg-superficie p-4" aria-labelledby="tram">
        <h2 id="tram" className="mb-2 text-lg font-semibold">Tramitação</h2>
        {tram.length ? (
          <ol className="space-y-3 border-l-2 border-borda pl-4">
            {tram.slice(0, 40).map((t, i) => (
              <li key={i} className="text-sm">
                <p><SeloCasa casa={t.casa} /> <time className="tabular font-medium">{formatarData(t.dataHora)}</time> {t.orgao ? <span className="text-suave">· {t.orgao}</span> : null}</p>
                <p className="font-medium">{t.descricao}</p>
                {t.despacho && <p className="text-suave">{t.despacho}</p>}
                {t.situacao && <p className="text-xs text-suave">Situação: {t.situacao}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-suave">Tramitação detalhada ainda não coletada. Consulte a página oficial{linkCamara || linkSenado ? " nos links acima" : ""}.</p>
        )}
        {tram.length > 40 && <p className="mt-2 text-sm text-suave">Mostrando os 40 registros mais recentes de {tram.length}.</p>}
      </section>
    </article>
  );
}
