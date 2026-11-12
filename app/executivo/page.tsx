// Executivo: agenda do Presidente por dia (Fase 2A). Diário Oficial e vetos entram nas próximas partes.
import type { Metadata } from "next";
import Link from "next/link";
import { agendaPresidente, diasComAgenda, leisRecentes, vetosRecentes, vetosPendentes, mpvsRecentes, ultimaColeta } from "@/lib/consultas";
import { VetoItem } from "@/components/Veto";
import { Fonte } from "@/components/Fonte";
import { Termo } from "@/components/Termo";
import { hojeBrasilia, formatarData, somarDias } from "@/lib/tempo";
import { AgendaPresidente } from "@/components/AgendaPresidente";
import { SeloPoder } from "@/components/Selos";
import { CANAIS } from "@/lib/canais";

export const metadata: Metadata = { title: "Executivo — agenda do Presidente", description: "Agenda oficial do Presidente da República, dia a dia, com horário de Brasília." };
type Props = { searchParams: Promise<{ data?: string }> };

export default async function Executivo({ searchParams }: Props) {
  const sp = await searchParams;
  const data = sp.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : hojeBrasilia();
  const desde = somarDias(hojeBrasilia(), -30);
  const [{ dia, compromissos }, dias, leis, vetos, pendentes, mpvs, colLeis, colVetos] = await Promise.all([
    agendaPresidente(data), diasComAgenda(14), leisRecentes(desde, 40), vetosRecentes(desde, 30), vetosPendentes(), mpvsRecentes(desde, 20),
    ultimaColeta("senado", `leis_${hojeBrasilia().slice(0, 4)}`), ultimaColeta("senado", "vetos"),
  ]);
  const secao = "rounded-lg border border-borda bg-superficie p-4";
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><SeloPoder poder="executivo" /><h1 className="text-2xl font-bold">Agenda do Presidente da República</h1></div>
      <p className="text-suave">{formatarData(data, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      <nav aria-label="Outros dias" className="text-sm">
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
          {dias.map((d) => (
            <li key={d}>{d === data ? <strong aria-current="page">{d.slice(8)}/{d.slice(5, 7)}</strong> : <Link href={`/executivo?data=${d}`}>{d.slice(8)}/{d.slice(5, 7)}</Link>}</li>
          ))}
        </ul>
      </nav>
      <section className="rounded-lg border border-borda bg-superficie p-4">
        <AgendaPresidente dia={dia} compromissos={compromissos} data={data} />
        <p className="mt-2 text-sm"><a href={CANAIS.GOV.url} target="_blank" rel="noopener">Assistir à {CANAIS.GOV.nome}</a></p>
      </section>
      <section id="leis" className={secao}>
        <h2 className="mb-2 text-lg font-semibold">Leis sancionadas ou promulgadas — últimos 30 dias ({leis.length})</h2>
        {leis.length ? (
          <ul className="space-y-2 text-sm">
            {leis.map((l) => (
              <li key={l.nome} className="border-t border-borda pt-2 first:border-0 first:pt-0">
                <a href={l.url} target="_blank" rel="noopener" className="font-medium">{l.nome}</a>
                {l.proposicao && <> · origem: <Link href={`/proposicao/${l.proposicao.slug}`}>{l.proposicao.sigla} {l.proposicao.numero}/{l.proposicao.ano}</Link></>}
                {l.vetoParcial && <span className="text-suave"> · com <Termo id="vetoParcial">veto parcial</Termo></span>}
                {l.ementa && <span className="block text-suave">{l.ementa}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-suave">Nenhuma lei publicada nos últimos 30 dias, segundo a fonte.</p>}
        <Fonte orgao="Senado Federal — Legislação Federal" url="https://legis.senado.leg.br/dadosabertos/legislacao/lista" em={colLeis} />
      </section>

      <section id="vetos" className={secao}>
        <h2 className="mb-2 text-lg font-semibold"><Termo id="veto">Vetos</Termo> publicados — últimos 30 dias ({vetos.length})</h2>
        {vetos.length ? <ul className="space-y-3">{vetos.map((v) => <li key={v.id} className="border-t border-borda pt-2 first:border-0 first:pt-0"><VetoItem v={v} /></li>)}</ul>
          : <p className="text-sm text-suave">Nenhum veto publicado nos últimos 30 dias.</p>}
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-medium">Todos os vetos aguardando o Congresso ({pendentes.length})</summary>
          <ul className="mt-2 space-y-3">{pendentes.map((v) => <li key={v.id} className="border-t border-borda pt-2 first:border-0 first:pt-0"><VetoItem v={v} /></li>)}</ul>
        </details>
        <Fonte orgao="Congresso Nacional — vetos (API do Senado)" url="https://legis.senado.leg.br/dadosabertos/materia/vetos" em={colVetos} />
      </section>

      <section id="mpv" className={secao}>
        <h2 className="mb-2 text-lg font-semibold"><Termo id="mpv">Medidas provisórias</Termo> editadas — últimos 30 dias ({mpvs.length})</h2>
        {mpvs.length ? (
          <ul className="space-y-2 text-sm">
            {mpvs.map((m) => (
              <li key={m.slug} className="border-t border-borda pt-2 first:border-0 first:pt-0">
                <Link href={`/proposicao/${m.slug}`} className="font-medium">MPV {m.numero}/{m.ano}</Link>
                <span className="text-suave"> · {formatarData(m.data)}{m.situacao ? ` · ${m.situacao}` : ""}</span>
                {m.ementa && <span className="block text-suave">{m.ementa}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-suave">Nenhuma medida provisória editada nos últimos 30 dias.</p>}
        <p className="mt-2 text-xs text-suave">Uma MP vale por até 120 dias; se o Congresso não a aprovar nesse prazo, perde a eficácia.</p>
      </section>

      <p className="text-sm text-suave">
        A agenda é publicada pela própria Presidência e pode ser alterada ao longo do dia. A agenda do Vice-Presidente e dos ministros fica no sistema e-Agendas da CGU e será incluída numa próxima etapa.
      </p>
    </div>
  );
}
