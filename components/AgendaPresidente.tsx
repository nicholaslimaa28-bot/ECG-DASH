// Lista de compromissos do Presidente. Em viagens mostra o horário local publicado e o equivalente em Brasília.
import type { CompromissoAgenda, DiaAgenda } from "@/lib/consultas";
import { formatarHora } from "@/lib/tempo";
import { Fonte } from "./Fonte";

export function AgendaPresidente({ dia, compromissos, data }: { dia: DiaAgenda; compromissos: CompromissoAgenda[]; data: string }) {
  if (!dia) return <p className="text-sm text-suave">Dado indisponível no momento: a agenda deste dia ainda não foi coletada.</p>;
  if (!dia.publicada) {
    return (
      <>
        <p className="text-sm text-suave">A Presidência ainda não publicou a agenda deste dia.</p>
        <Fonte orgao="Presidência da República — Agenda do Presidente" url={dia.url.replace(/\/\d{4}-\d{2}-\d{2}$/, "")} em={dia.coletadoEm} />
      </>
    );
  }
  return (
    <>
      {dia.aviso && <p className="mb-2 rounded border border-executivo/40 p-2 text-sm"><strong>{dia.aviso}</strong>{dia.fusoMin ? " · os horários abaixo são locais; o horário de Brasília aparece ao lado." : ""}</p>}
      {compromissos.length ? (
        <ul>
          {compromissos.map((c, i) => (
            <li key={i} className="flex gap-3 border-b border-borda py-2 last:border-0">
              <div className="tabular w-20 shrink-0 text-sm">
                <span className="block font-semibold">{c.inicioTexto ?? "—"}</span>
                {c.horaLocal && c.inicio && <span className="block text-xs text-suave">{formatarHora(c.inicio)} em Brasília</span>}
              </div>
              <div className="min-w-0 text-sm">
                <p className="font-medium">{c.url ? <a href={c.url} target="_blank" rel="noopener">{c.titulo}</a> : c.titulo}</p>
                {c.local && <p className="text-suave">{c.local}</p>}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-suave">Sem compromissos oficiais publicados para {data.split("-").reverse().join("/")}.</p>}
      <Fonte orgao="Presidência da República — Agenda do Presidente" url={dia.url} em={dia.coletadoEm} />
    </>
  );
}
