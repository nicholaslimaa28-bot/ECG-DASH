// Página do parlamentar (deputado ou senador): presença, votos, proposições, gastos e agenda.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  parlamentarPorSlug, presencaResumo, presencaSenadoPorMes, motivosAusenciaSenado, votosDoParlamentar,
  proposicoesDoAutor, totalProposicoesDoAutor, despesasPorCategoria, despesasPorMes, licencasRecentes, eventosPresentes,
  ultimaColeta, type Parlamentar,
} from "@/lib/consultas";
import { hojeBrasilia, formatarData } from "@/lib/tempo";
import { Fonte } from "@/components/Fonte";
import { Termo, TermoSigla } from "@/components/Termo";
import { rotuloVoto } from "@/components/Selos";

export const revalidate = 600;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ tema?: string; ano?: string }> };

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const reais = (v: string | number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (a: number, total: number) => (total ? `${((a / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—");

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await parlamentarPorSlug((await params).slug);
  if (!p) return {};
  const cargo = p.casa === "CD" ? "Deputado(a) federal" : "Senador(a)";
  return {
    title: `${p.nome} (${p.partido}-${p.uf})`,
    description: `${cargo} ${p.nome} (${p.partido}-${p.uf}): presença, votos, proposições e gastos da cota parlamentar, com dados oficiais.`,
    alternates: { canonical: `/parlamentar/${p.slug}` },
  };
}

function Bloco({ id, titulo, children }: { id: string; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-t`} className="rounded-lg border border-borda bg-superficie p-4">
      <h2 id={`${id}-t`} className="mb-2 text-lg font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

async function PresencaCamara({ p, ano }: { p: Parlamentar; ano: number }) {
  const resumo = (await presencaResumo(p.id)).filter((r) => r.ano === ano);
  if (!resumo.length) return <p className="text-suave">Dado indisponível no momento.</p>;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {resumo.map((r) => {
          const total = (r.presencas ?? 0) + (r.ausenciasJustificadas ?? 0) + (r.ausenciasNaoJustificadas ?? 0);
          return (
            <div key={r.ambito}>
              <h3 className="font-medium">{r.ambito === "plenario" ? "Plenário (sessões deliberativas)" : "Comissões"}</h3>
              <dl className="tabular mt-1 grid grid-cols-[1fr_auto_auto] gap-x-3 text-sm">
                <dt>Presente</dt><dd className="text-right font-semibold">{r.presencas ?? "—"} {r.unidade === "dias" ? "dias" : "reuniões"}</dd><dd className="text-right text-suave">{pct(r.presencas ?? 0, total)}</dd>
                <dt><Termo id="ausenciaJustificada">Ausência justificada</Termo></dt><dd className="text-right font-semibold">{r.ausenciasJustificadas ?? "—"}</dd><dd className="text-right text-suave">{pct(r.ausenciasJustificadas ?? 0, total)}</dd>
                <dt>Ausência não justificada</dt><dd className="text-right font-semibold">{r.ausenciasNaoJustificadas ?? "—"}</dd><dd className="text-right text-suave">{pct(r.ausenciasNaoJustificadas ?? 0, total)}</dd>
              </dl>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-suave">
        Números oficiais publicados pela Câmara para {ano}. No Plenário, contam os dias com <Termo id="deliberativa">sessão deliberativa</Termo> (Ato da Mesa nº 191/2017);
        sessões solenes e de debates não entram. Faltas por missão oficial, licença médica ou atividade parlamentar autorizada são justificadas.{" "}
        <Link href="/metodologia#presenca">Como calculamos</Link>.
      </p>
      <Fonte orgao="Câmara dos Deputados — perfil do deputado" url={resumo[0].fonteUrl} em={resumo[0].coletadoEm} />
    </>
  );
}

async function PresencaSenado({ p, ano }: { p: Parlamentar; ano: number }) {
  const [meses, motivos, licencas, col] = await Promise.all([
    presencaSenadoPorMes(p.id, ano), motivosAusenciaSenado(p.id, ano), licencasRecentes(p.id, 8), ultimaColeta("senado", "votacoes"),
  ]);
  const soma = meses.reduce((a, m) => ({ presente: a.presente + m.presente, justificada: a.justificada + m.justificada, naoJustificada: a.naoJustificada + m.naoJustificada, total: a.total + m.total }), { presente: 0, justificada: 0, naoJustificada: 0, total: 0 });
  return (
    <>
      {soma.total === 0 ? (
        <p className="text-suave">Nenhuma votação nominal de {ano} coletada até agora para este(a) senador(a).</p>
      ) : (
        <>
          <dl className="tabular grid max-w-md grid-cols-[1fr_auto_auto] gap-x-3 text-sm">
            <dt>Presente</dt><dd className="text-right font-semibold">{soma.presente}</dd><dd className="text-right text-suave">{pct(soma.presente, soma.total)}</dd>
            <dt><Termo id="ausenciaJustificada">Ausência justificada</Termo></dt><dd className="text-right font-semibold">{soma.justificada}</dd><dd className="text-right text-suave">{pct(soma.justificada, soma.total)}</dd>
            <dt>Ausência não justificada</dt><dd className="text-right font-semibold">{soma.naoJustificada}</dd><dd className="text-right text-suave">{pct(soma.naoJustificada, soma.total)}</dd>
            <dt className="text-suave">Votações nominais</dt><dd className="text-right">{soma.total}</dd><dd />
          </dl>
          <table className="tabular mt-3 w-full max-w-md text-sm">
            <caption className="text-left text-suave">Por mês ({ano})</caption>
            <thead><tr className="text-left"><th>Mês</th><th className="text-right">Presente</th><th className="text-right">Justif.</th><th className="text-right">Não justif.</th></tr></thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.mes} className="border-t border-borda"><td>{MESES[m.mes - 1]}</td><td className="text-right">{m.presente}</td><td className="text-right">{m.justificada}</td><td className="text-right">{m.naoJustificada}</td></tr>
              ))}
            </tbody>
          </table>
          {motivos.length > 0 && (
            <p className="mt-2 text-sm">
              Motivos registrados: {motivos.map((m) => `${m.descricao ?? m.codigo} (${m.vezes})`).join(" · ")}
            </p>
          )}
        </>
      )}
      <p className="mt-3 text-sm text-suave">
        O Senado registra o comparecimento <strong>em cada votação nominal</strong> (não por sessão). Cada linha conta uma votação.
        Licenças, missões e atividade parlamentar são ausências justificadas; &ldquo;não compareceu&rdquo; é ausência não justificada. <Link href="/metodologia#presenca">Como calculamos</Link>.
      </p>
      {licencas.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer">Licenças oficiais recentes</summary>
          <ul className="mt-1 list-disc pl-5">
            {licencas.map((l, i) => <li key={i}>{formatarData(l.inicio)}{l.fim && l.fim !== l.inicio ? ` a ${formatarData(l.fim)}` : ""} — {l.tipo}</li>)}
          </ul>
        </details>
      )}
      <Fonte orgao="Senado Federal — votações nominais" url="https://legis.senado.leg.br/dadosabertos/votacao" em={col} />
    </>
  );
}

export default async function PaginaParlamentar({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const p = await parlamentarPorSlug(slug);
  if (!p) notFound();
  const anoAtual = Number(hojeBrasilia().slice(0, 4));
  const ano = sp.ano && /^\d{4}$/.test(sp.ano) ? Number(sp.ano) : anoAtual;
  const tema = sp.tema?.slice(0, 80);
  const fonteCasa = p.casa === "CD" ? "camara" : "senado";

  const [votos, props, totalProps, categorias, meses, eventos, colVot, colDesp, colAut] = await Promise.all([
    votosDoParlamentar(p.id, 40, tema), proposicoesDoAutor(p.id, 25), totalProposicoesDoAutor(p.id),
    despesasPorCategoria(p.id, ano), despesasPorMes(p.id, ano), p.casa === "CD" ? eventosPresentes(p.id, 8) : Promise.resolve([]),
    ultimaColeta(fonteCasa, "votacoes"), ultimaColeta(fonteCasa, `despesas_${ano}`), ultimaColeta(fonteCasa, "autoria"),
  ]);
  const totalGasto = categorias.reduce((a, c) => a + Number(c.total), 0);
  const maxMes = Math.max(1, ...meses.map((m) => Number(m.total)));
  const cargo = p.casa === "CD" ? "Deputado(a) federal" : "Senador(a)";

  return (
    <article className="space-y-6">
      <header className="flex flex-wrap items-start gap-4">
        {p.urlFoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.urlFoto} alt={`Foto oficial de ${p.nome}`} width={96} height={128} loading="eager" className="h-32 w-24 rounded object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-suave">{cargo}{p.emExercicio ? "" : ` · ${p.situacao ?? "fora de exercício"}`}</p>
          <h1 className="text-2xl font-bold">{p.nome}</h1>
          <p>{p.partido ?? "Sem partido"} · {p.uf}</p>
          {p.nomeCivil && p.nomeCivil !== p.nome && <p className="text-sm text-suave">Nome civil: {p.nomeCivil}</p>}
          <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
            {p.email && <a href={`mailto:${p.email}`}>{p.email}</a>}
            {p.telefone && <span>Tel. {p.telefone}</span>}
            {p.urlPaginaOficial && <a href={p.urlPaginaOficial} target="_blank" rel="noopener">Página oficial</a>}
          </p>
        </div>
        <nav aria-label="Seções desta página" className="w-full text-sm">
          <ul className="flex flex-wrap gap-x-4">
            <li><a href="#presenca">Presença</a></li><li><a href="#votos">Votos</a></li>
            <li><a href="#proposicoes">Proposições</a></li><li><a href="#gastos">Gastos</a></li>
            {p.casa === "CD" && <li><a href="#agenda">Agenda</a></li>}
          </ul>
        </nav>
      </header>

      <Bloco id="presenca" titulo={`Presença em ${ano}`}>
        {p.casa === "CD" ? <PresencaCamara p={p} ano={ano} /> : <PresencaSenado p={p} ano={ano} />}
      </Bloco>

      <Bloco id="votos" titulo="Votos em votações nominais">
        <form className="mb-3 flex gap-2" action={`/parlamentar/${p.slug}#votos`}>
          <label htmlFor="tema" className="sr-only">Filtrar votos por tema</label>
          <input id="tema" name="tema" defaultValue={tema} placeholder="Filtrar por tema (ex.: saúde, imposto)" className="flex-1 rounded border border-borda bg-fundo px-2 py-1 text-sm" />
          <button className="rounded border border-borda px-3 py-1 text-sm">Filtrar</button>
        </form>
        {votos.length ? (
          // Lista em cartões: legível no celular sem rolagem horizontal
          <ul>
            {votos.map((v) => {
              const comparavel = v.orientacaoPartido && ["sim", "nao"].includes(v.orientacaoPartido) && ["sim", "nao"].includes(v.tipoVoto);
              return (
                <li key={v.votacaoId} className="border-t border-borda py-2 text-sm first:border-0">
                  <p>
                    <time className="tabular text-suave">{formatarData(v.dataHora)}</time>{" "}
                    {v.proposicao && <Link href={`/proposicao/${v.proposicao.slug}`} className="font-medium">{v.proposicao.sigla} {v.proposicao.numero}/{v.proposicao.ano}</Link>}
                  </p>
                  <p className="text-suave">{v.descricao.length > 160 ? v.descricao.slice(0, 157) + "…" : v.descricao}</p>
                  <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-0.5">
                    <div><dt className="inline">Voto: </dt><dd className="inline font-semibold">{v.tipoVoto === "presidente" ? <Termo id="art17">Presidindo</Termo> : rotuloVoto(v.tipoVoto)}</dd></div>
                    <div><dt className="inline"><Termo id="orientacao">Orientação do partido</Termo> ({v.partido ?? "—"}): </dt><dd className="inline">{v.orientacaoPartido ? rotuloVoto(v.orientacaoPartido) : v.haOrientacaoDeBloco ? <span className="text-suave">dada pelo bloco partidário (<Link href={`/votacao/${v.votacaoId}`}>ver</Link>)</span> : <span className="text-suave">não publicada</span>}</dd></div>
                    {comparavel && <div><dd>{v.tipoVoto === v.orientacaoPartido ? "Votou com o partido" : "Votou diferente do partido"}</dd></div>}
                  </dl>
                  <Link href={`/votacao/${v.votacaoId}`} className="text-xs">Ver todos os votos</Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-suave">{tema ? `Nenhum voto nominal encontrado com “${tema}”.` : "Nenhum voto nominal coletado até agora."}</p>
        )}
        <p className="mt-2 text-xs text-suave">
          Só aparecem <Termo id="votacaoNominal">votações nominais</Termo>. O partido considerado é o da data do voto. &ldquo;Votou diferente&rdquo; compara apenas votos Sim/Não com orientações Sim/Não.
        </p>
        <Fonte orgao={p.casa === "CD" ? "Câmara dos Deputados — votações" : "Senado Federal — votações"} url={p.casa === "CD" ? "https://dadosabertos.camara.leg.br/swagger/api.html" : "https://legis.senado.leg.br/dadosabertos"} em={colVot} />
      </Bloco>

      <Bloco id="proposicoes" titulo={`Proposições de autoria (${totalProps} desde 2023)`}>
        {props.length ? (
          <ul className="space-y-2 text-sm">
            {props.map((x) => (
              <li key={x.slug}>
                <Link href={`/proposicao/${x.slug}`} className="font-medium"><TermoSigla sigla={x.sigla} /> {x.numero}/{x.ano}</Link>
                {x.situacao ? <span className="text-suave"> · {x.situacao}</span> : null}
                {x.ementa ? <span className="block text-suave">{x.ementa.length > 200 ? x.ementa.slice(0, 197) + "…" : x.ementa}</span> : null}
              </li>
            ))}
          </ul>
        ) : <p className="text-suave">Nenhuma proposição de autoria coletada (tipos PL, PLP, PEC, PDL{p.casa === "CD" ? " e MPV" : ""}).</p>}
        <p className="mt-2 text-xs text-suave">Inclui autoria e coautoria registradas pela Casa. Requerimentos e indicações não entram nesta lista.</p>
        <Fonte orgao={p.casa === "CD" ? "Câmara dos Deputados — proposições" : "Senado Federal — processos legislativos"} url={p.casa === "CD" ? "https://dadosabertos.camara.leg.br" : "https://legis.senado.leg.br/dadosabertos"} em={colAut} />
      </Bloco>

      <Bloco id="gastos" titulo={`Gastos da cota parlamentar em ${ano}`}>
        <p className="mb-2 text-sm text-suave"><Termo id="cota">O que é a cota parlamentar?</Termo> Valores reembolsados, como publicados pela Casa.</p>
        {categorias.length ? (
          <>
            <p className="tabular text-lg font-semibold">{reais(totalGasto)} <span className="text-sm font-normal text-suave">em {categorias.reduce((a, c) => a + c.documentos, 0)} documentos</span></p>
            <table className="tabular mt-2 w-full text-sm">
              <caption className="sr-only">Gastos por categoria</caption>
              <thead><tr className="text-left"><th>Categoria</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {categorias.map((c) => (
                  <tr key={c.categoria} className="border-t border-borda"><td className="py-1 pr-2">{c.categoria}</td><td className="text-right whitespace-nowrap">{reais(c.total)}</td></tr>
                ))}
              </tbody>
            </table>
            <h3 className="mt-4 font-medium">Por mês</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {meses.map((m) => (
                <li key={m.mes} className="grid grid-cols-[3rem_1fr_7rem] items-center gap-2">
                  <span>{MESES[m.mes - 1]}</span>
                  <span aria-hidden className="h-2 rounded bg-texto/30" style={{ width: `${(Number(m.total) / maxMes) * 100}%` }} />
                  <span className="tabular text-right">{reais(m.total)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-suave">Valores negativos são estornos ou compensações publicados pela própria Casa. A cota tem teto mensal diferente por estado.</p>
          </>
        ) : <p className="text-suave">Nenhum gasto publicado para {ano} até agora.</p>}
        <p className="mt-2 text-sm">
          {[anoAtual - 1, anoAtual].filter((a) => a !== ano).map((a) => <Link key={a} href={`/parlamentar/${p.slug}?ano=${a}#gastos`}>Ver {a}</Link>)}
        </p>
        <Fonte
          orgao={p.casa === "CD" ? "Câmara dos Deputados — Cota para o Exercício da Atividade Parlamentar" : "Senado Federal — CEAPS"}
          url={p.casa === "CD" ? "https://www.camara.leg.br/transparencia/gastos-parlamentares" : "https://adm.senado.gov.br/adm-dadosabertos/swagger-ui/index.html"}
          em={colDesp}
        />
      </Bloco>

      {p.casa === "CD" && (
        <Bloco id="agenda" titulo="Sessões deliberativas recentes em que esteve presente">
          {eventos.length ? (
            <ul className="text-sm">
              {eventos.map((e) => (
                <li key={e.id} className="border-t border-borda py-1 first:border-0">
                  <time className="tabular mr-2">{formatarData(e.inicio)}</time><Link href={`/sessao/${e.id}`}>{e.titulo}</Link>
                </li>
              ))}
            </ul>
          ) : <p className="text-suave">Nenhum registro coletado até agora.</p>}
          <Fonte orgao="Câmara dos Deputados — presença em eventos" url="https://dadosabertos.camara.leg.br" em={await ultimaColeta("camara", "agenda")} />
        </Bloco>
      )}
    </article>
  );
}
