// Pequenos selos de status e de Poder. A cor nunca é a única informação: sempre há texto.
const ROTULO_STATUS: Record<string, string> = {
  agendada: "Agendada", em_andamento: "Em andamento", encerrada: "Encerrada", cancelada: "Cancelada", suspensa: "Suspensa",
};

export function SeloStatus({ status, original }: { status: string; original?: string | null }) {
  const cor =
    status === "em_andamento" ? "border-ok text-ok" :
    status === "cancelada" ? "border-erro text-erro" :
    status === "suspensa" ? "border-alerta text-alerta" : "border-borda text-suave";
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium ${cor}`} title={original ?? undefined}>
      {status === "em_andamento" && <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-ok" />}
      {ROTULO_STATUS[status] ?? status}
    </span>
  );
}

export function SeloCasa({ casa }: { casa: string }) {
  const nome = casa === "CD" ? "Câmara" : casa === "SF" ? "Senado" : casa === "CN" ? "Congresso" : casa;
  return <span className="rounded bg-legislativo/10 px-1.5 py-0.5 text-xs font-semibold text-legislativo">{nome}</span>;
}

export function SeloPoder({ poder }: { poder: "legislativo" | "executivo" | "judiciario" }) {
  const cfg = {
    legislativo: ["Legislativo", "text-legislativo border-legislativo"],
    executivo: ["Executivo", "text-executivo border-executivo"],
    judiciario: ["Judiciário", "text-judiciario border-judiciario"],
  }[poder];
  return <span className={`rounded border px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide ${cfg[1]}`}>{cfg[0]}</span>;
}

const ROTULO_VOTO: Record<string, string> = {
  sim: "Sim", nao: "Não", abstencao: "Abstenção", obstrucao: "Obstrução", presidente: "Presidindo",
  presente_sem_voto: "Presente, sem voto", ausente: "Ausente", liberado: "Liberado", outro: "Outro",
};
export const rotuloVoto = (v: string | null | undefined) => (v ? ROTULO_VOTO[v] ?? v : "—");
