// Home — "Hoje nos Três Poderes"
import Link from "next/link";
import { eventosEntre, votacoesEntre, orientacoes, ultimaColeta, agendaPresidente, type Votacao, type Orientacao } from "@/lib/consultas";
import { AgendaPresidente } from "@/components/AgendaPresidente";
import { hojeBrasilia, somarDias, formatarData, formatarHora } from "@/lib/tempo";
import { EventoItem, ehPlenario } from "@/components/EventoItem";
import { Fonte } from "@/components/Fonte";
import { Placar } from "@/components/Placar";
import { SeloCasa, SeloPoder, rotuloVoto } from "@/components/Selos";
import { Termo } from "@/components/Termo";
import { CANAIS } from "@/lib/canais";

export const revalidate = 120; // ISR: refeita no máximo a cada 2 minutos

function Secao({ titulo, poder, children }: { titulo: string; poder: "legislativo" | "executivo" | "judiciario"; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-borda bg-superficie p-4" aria-label={titulo}>
      <div className="mb-2 flex items-center gap-2">
        <SeloPoder poder={poder} />
        <h2 className="text-lg font-semibold">{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

function Orientacoes({ lista }: { lista: Orientacao[] }) {
  if (!lista.length) return null;
  // Governo e lideranças primeiro; partidos em ordem alfabética
  const ordenada = [...lista].sort((a, b) => (a.tipoBancada === "governo" ? -1 : b.tipoBancada === "governo" ? 1 : a.bancada.localeCompare(b.bancada)));
  return (
    <details className="mt-1 text-sm">
      <summary className="cursor-pointer text-suave">Como as bancadas orientaram ({lista.length})</summary>
      <p className="mt-1 text-xs text-suave"><Termo id="orientacao">O que é orientação de bancada?</Termo></p>
      <ul className="mt-1 grid grid-cols-2 gap-x-4 sm:grid-cols-3">
        {ordenada.map((o) => (
          <li key={o.bancada} className="flex justify-between gap-2 border-b border-borda/60 py-0.5">
            <span>{o.bancada}</span>
            <span className="font-medium">{rotuloVoto(o.orientacao)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function VotacaoItem({ v, orient }: { v: Votacao; orient: Orientacao[] }) {
  return (
    <li className="border-b border-borda py-3 last:border-0">
      <div className="flex flex-wrap items-baseline gap-2 text-sm">
        <SeloCasa casa={v.casa} />
        <time className="tabular text-suave" dateTime={v.dataHora.toISOString()}>
          {formatarData(v.dataHora, { day: "2-digit", month: "2-digit" })} às {formatarHora(v.dataHora)}
        </time>
      </div>
      {v.proposicao && (
        <p className="mt-1 font-medium">
          <Link href={`/proposicao/${v.proposicao.slug}`}>
            {v.proposicao.sigla} {v.proposicao.numero}/{v.proposicao.ano}
          </Link>
          {v.proposicao.apelido ? <span> — {v.proposicao.apelido}</span> : null}
        </p>
      )}
      <p className="text-sm">{v.descricao}</p>
      <div className="mt-1"><Placar v={v} /></div>
      <Orientacoes lista={orient} />
    </li>
  );
}

export default async function Hoje() {
  const hoje = hojeBrasilia();
  const amanha = somarDias(hoje, 1);
  const [eventos, proximos, votosHoje, votosRecentes, colCam, colSen, colVotCam, colVotSen, agendaPres] = await Promise.all([
    eventosEntre(hoje, amanha),
    eventosEntre(amanha, somarDias(hoje, 8)),
    votacoesEntre(hoje, amanha),
    votacoesEntre(somarDias(hoje, -7), hoje),
    ultimaColeta("camara", "agenda"), ultimaColeta("senado", "agenda"),
    ultimaColeta("camara", "votacoes"), ultimaColeta("senado", "votacoes"),
    agendaPresidente(hoje),
  ]);
  const plenarios = eventos.filter(ehPlenario);
  const comissoes = eventos.filter((e) => !ehPlenario(e));
  const votacoes = votosHoje.length ? votosHoje : votosRecentes.slice(0, 6);
  const orient = await orientacoes(votacoes.filter((v) => v.nominal).map((v) => v.id));
  const proximosPlenarios = proximos.filter((e) => ehPlenario(e) && e.status !== "cancelada");
  const maisAntiga = (a: Date | null, b: Date | null) => (a && b ? (a < b ? a : b) : a ?? b);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hoje nos Três Poderes</h1>
        <p className="text-suave">
          {formatarData(new Date(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · horário de Brasília
        </p>
      </div>

      <Secao titulo="Plenários hoje" poder="legislativo">
        {plenarios.length ? (
          <ul>{plenarios.map((e) => <EventoItem key={e.id} e={e} />)}</ul>
        ) : (
          <p className="text-suave">Nenhuma sessão de Plenário da Câmara, do Senado ou do Congresso registrada para hoje.</p>
        )}
        {comissoes.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer font-medium">Comissões, audiências e outros eventos hoje ({comissoes.length})</summary>
            <ul className="mt-2">{comissoes.map((e) => <EventoItem key={e.id} e={e} mostrarPauta={false} />)}</ul>
          </details>
        )}
        <Fonte orgao="Câmara dos Deputados e Senado Federal — Dados Abertos" url="https://dadosabertos.camara.leg.br" em={maisAntiga(colCam, colSen)} />
      </Secao>

      <Secao titulo={votosHoje.length ? "Votado hoje" : "Votações dos últimos dias"} poder="legislativo">
        {!votosHoje.length && <p className="text-sm text-suave">Nenhuma votação registrada hoje até agora. Abaixo, as mais recentes da última semana.</p>}
        {votacoes.length ? (
          <ul>{votacoes.map((v) => <VotacaoItem key={v.id} v={v} orient={orient.get(v.id) ?? []} />)}</ul>
        ) : (
          <p className="text-suave">Nenhuma votação registrada na última semana.</p>
        )}
        <p className="mt-2 text-xs text-suave">
          <Termo id="votacaoNominal">Votação nominal</Termo> registra o voto de cada parlamentar; na <Termo id="votacaoSimbolica">simbólica</Termo>, não há registro individual.
        </p>
        <Fonte orgao="Câmara dos Deputados e Senado Federal — Dados Abertos" url="https://legis.senado.leg.br/dadosabertos" em={maisAntiga(colVotCam, colVotSen)} />
      </Secao>

      <div className="grid gap-6 md:grid-cols-2">
        <Secao titulo="Agenda do Presidente hoje" poder="executivo">
          <AgendaPresidente dia={agendaPres.dia} compromissos={agendaPres.compromissos} data={hoje} />
          <p className="mt-2 text-sm">
            <Link href="/executivo">Outros dias</Link> · <a href={CANAIS.GOV.url} target="_blank" rel="noopener">Assistir à {CANAIS.GOV.nome}</a> ·{" "}
            <a href="https://www.in.gov.br/leiturajornal" target="_blank" rel="noopener">Diário Oficial de hoje</a>
          </p>
        </Secao>
        <Secao titulo="Supremo Tribunal Federal" poder="judiciario">
          <p className="text-sm">Dado indisponível no momento: o portal do STF não permite a coleta automática a partir dos nossos servidores. Veja a pauta na fonte oficial.</p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            <li><a href="https://portal.stf.jus.br/pauta/" target="_blank" rel="noopener">Pauta oficial do STF</a></li>
            <li><a href={CANAIS.STF.url} target="_blank" rel="noopener">Assistir na {CANAIS.STF.nome}</a></li>
          </ul>
        </Secao>
      </div>

      <Secao titulo="Próximos dias nos Plenários" poder="legislativo">
        {proximosPlenarios.length ? (
          <ul>
            {proximosPlenarios.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-2 border-b border-borda py-2 text-sm last:border-0">
                <time className="tabular w-32 shrink-0 font-medium" dateTime={e.inicio.toISOString()}>
                  {formatarData(e.inicio, { weekday: "short", day: "2-digit", month: "2-digit" })} {formatarHora(e.inicio)}
                </time>
                <SeloCasa casa={e.casa} />
                <Link href={`/sessao/${e.id}`}>{e.titulo}</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-suave">Nenhuma sessão de Plenário publicada para os próximos 7 dias até agora.</p>
        )}
        <Fonte orgao="Câmara dos Deputados e Senado Federal — Dados Abertos" url="https://legis.senado.leg.br/dadosabertos" em={maisAntiga(colCam, colSen)} />
      </Secao>
    </div>
  );
}
