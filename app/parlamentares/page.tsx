// Lista de parlamentares em exercício, com filtros (sem ranking: ordem alfabética).
import type { Metadata } from "next";
import Link from "next/link";
import { listarParlamentares, filtrosParlamentares } from "@/lib/consultas";

export const metadata: Metadata = { title: "Deputados e senadores", description: "Lista dos deputados federais e senadores em exercício, com filtro por estado e partido." };
export const revalidate = 3600;

type Props = { searchParams: Promise<{ casa?: string; uf?: string; partido?: string }> };

export default async function Parlamentares({ searchParams }: Props) {
  const sp = await searchParams;
  const casa = sp.casa === "CD" || sp.casa === "SF" ? sp.casa : undefined;
  const [lista, filtros] = await Promise.all([listarParlamentares({ casa, uf: sp.uf, partido: sp.partido }), filtrosParlamentares()]);
  const sel = "rounded border border-borda bg-superficie px-2 py-1";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Deputados e senadores em exercício</h1>
      <form className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col">Casa
          <select name="casa" defaultValue={casa ?? ""} className={sel}><option value="">Todas</option><option value="CD">Câmara</option><option value="SF">Senado</option></select>
        </label>
        <label className="flex flex-col">Estado
          <select name="uf" defaultValue={sp.uf ?? ""} className={sel}><option value="">Todos</option>{filtros.ufs.map((u) => <option key={u}>{u}</option>)}</select>
        </label>
        <label className="flex flex-col">Partido
          <select name="partido" defaultValue={sp.partido ?? ""} className={sel}><option value="">Todos</option>{filtros.partidos.map((u) => <option key={u}>{u}</option>)}</select>
        </label>
        <button className="rounded border border-borda px-3 py-1">Filtrar</button>
      </form>
      <p className="text-sm text-suave">{lista.length} parlamentares · ordem alfabética</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {lista.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded border border-borda bg-superficie p-2">
            {p.urlFoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.urlFoto} alt="" width={40} height={52} loading="lazy" className="h-13 w-10 rounded object-cover" />
            ) : null}
            <div className="min-w-0">
              <Link href={`/parlamentar/${p.slug}`} className="font-medium">{p.nome}</Link>
              <p className="text-xs text-suave">{p.casa === "CD" ? "Deputado(a)" : "Senador(a)"} · {p.partido}-{p.uf}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
