// Item da linha do tempo: horário, Casa, status, título, pauta resumida e onde assistir.
import Link from "next/link";
import type { Evento } from "@/lib/consultas";
import { formatarHora } from "@/lib/tempo";
import { CANAIS } from "@/lib/canais";
import { SeloCasa, SeloStatus } from "./Selos";
import { Termo } from "./Termo";

export function ehPlenario(e: Pick<Evento, "casa" | "orgaos" | "tipo">) {
  return (e.orgaos ?? "").split(", ").includes("PLEN") || e.orgaos?.startsWith("Plenário") || false;
}

export function EventoItem({ e, mostrarPauta = true }: { e: Evento; mostrarPauta?: boolean }) {
  const canal = CANAIS[e.casa as keyof typeof CANAIS];
  const assistir = e.linkVideo ?? (ehPlenario(e) && e.status !== "cancelada" ? canal?.url : null);
  const pauta = (e.pauta ?? []).slice(0, 3);
  return (
    <li className="border-b border-borda py-3 last:border-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <time className="tabular w-12 shrink-0 font-semibold" dateTime={e.inicio.toISOString()}>{formatarHora(e.inicio)}</time>
        <SeloCasa casa={e.casa} />
        <SeloStatus status={e.status} original={e.statusOriginal} />
        {e.deliberativa === true && <span className="text-xs text-suave"><Termo id="deliberativa">deliberativa</Termo></span>}
      </div>
      <p className="mt-1 font-medium">
        <Link href={`/sessao/${e.id}`}>{e.titulo}</Link>
      </p>
      {e.local ? <p className="text-sm text-suave">{e.local}</p> : null}
      {mostrarPauta && pauta.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-sm">
          {pauta.map((p, i) => (
            <li key={i}>
              <span className="font-medium">{p.titulo}</span>
              {p.ementa ? <span className="text-suave"> — {p.ementa.length > 160 ? p.ementa.slice(0, 157) + "…" : p.ementa}</span> : null}
            </li>
          ))}
          {(e.pauta?.length ?? 0) > 3 && <li className="list-none text-suave"><Link href={`/sessao/${e.id}`}>+ {e.pauta!.length - 3} itens na pauta</Link></li>}
        </ul>
      )}
      <p className="mt-1 flex flex-wrap gap-3 text-sm">
        {assistir && (
          <a href={assistir} target="_blank" rel="noopener" className="font-medium">
            ▶ {e.linkVideo ? "Assistir" : `Assistir na ${canal.nome}`}
          </a>
        )}
        {e.urlPauta && <a href={e.urlPauta} target="_blank" rel="noopener">Página oficial</a>}
      </p>
    </li>
  );
}
