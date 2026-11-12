// Executivo: agenda do Presidente por dia (Fase 2A). Diário Oficial e vetos entram nas próximas partes.
import type { Metadata } from "next";
import Link from "next/link";
import { agendaPresidente, diasComAgenda } from "@/lib/consultas";
import { hojeBrasilia, formatarData } from "@/lib/tempo";
import { AgendaPresidente } from "@/components/AgendaPresidente";
import { SeloPoder } from "@/components/Selos";
import { CANAIS } from "@/lib/canais";

export const metadata: Metadata = { title: "Executivo — agenda do Presidente", description: "Agenda oficial do Presidente da República, dia a dia, com horário de Brasília." };
type Props = { searchParams: Promise<{ data?: string }> };

export default async function Executivo({ searchParams }: Props) {
  const sp = await searchParams;
  const data = sp.data && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : hojeBrasilia();
  const [{ dia, compromissos }, dias] = await Promise.all([agendaPresidente(data), diasComAgenda(14)]);
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
      <p className="text-sm text-suave">
        A agenda é publicada pela própria Presidência e pode ser alterada ao longo do dia. A agenda do Vice-Presidente e dos ministros fica no sistema e-Agendas da CGU e será incluída numa próxima etapa.
      </p>
    </div>
  );
}
