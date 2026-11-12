// Status das coletas: última execução bem-sucedida de cada tarefa e falhas recentes.
import type { Metadata } from "next";
import { statusFontes } from "@/lib/consultas";
import { formatarData, formatarHora } from "@/lib/tempo";

export const metadata: Metadata = { title: "Status das coletas" };
export const revalidate = 60;

const quando = (d: Date | null) => (d ? `${formatarData(d, { day: "2-digit", month: "2-digit" })} ${formatarHora(d)}` : "nunca");

export default async function Status() {
  const { fontes, tarefas, falhas } = await statusFontes();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Status das coletas</h1>
      <p className="text-suave">Quando uma fonte oficial falha, o site mostra “dado indisponível” em vez de estimar. Esta página mostra o estado de cada coleta.</p>
      {fontes.map((f) => (
        <section key={f.id} className="rounded-lg border border-borda bg-superficie p-4">
          <h2 className="text-lg font-semibold">{f.nome}</h2>
          <p className="text-sm text-suave"><a href={f.urlBase} target="_blank" rel="noopener">{f.urlBase}</a></p>
          {f.falhasSeguidas >= 3 && <p role="alert" className="mt-2 font-semibold text-erro">Atenção: {f.falhasSeguidas} falhas seguidas nesta fonte.</p>}
          <table className="tabular mt-2 w-full text-sm">
            <thead><tr className="text-left"><th>Tarefa</th><th>Última com sucesso</th><th>Última execução</th><th>Itens</th></tr></thead>
            <tbody>
              {tarefas.filter((t) => t.fonteId === f.id).map((t) => (
                <tr key={t.tarefa} className="border-t border-borda">
                  <td className="py-1">{t.tarefa}</td>
                  <td>{quando(t.ultimaOk)}</td>
                  <td className={t.ultimoStatus === "ok" ? "" : "text-erro"}>{quando(t.ultima)} · {t.ultimoStatus}</td>
                  <td>{t.itens ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <section>
        <h2 className="text-lg font-semibold">Falhas recentes</h2>
        {falhas.length ? (
          <ul className="space-y-2 text-sm">
            {falhas.map((f, i) => (
              <li key={i}><strong>{f.fonteId}/{f.tarefa}</strong> · {quando(f.iniciadoEm)}<pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-xs text-suave">{f.erro?.split("\n")[0]}</pre></li>
            ))}
          </ul>
        ) : <p className="text-suave">Nenhuma falha registrada.</p>}
      </section>
    </div>
  );
}
