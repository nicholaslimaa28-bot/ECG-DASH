"use client";
// Barra de busca com autocompletar (parlamentar, proposição). Funciona sem JavaScript via /busca?q=.
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Item = { tipo: string; titulo: string; detalhe: string; url: string };

export function BuscaRapida({ inicial = "", grande = false }: { inicial?: string; grande?: boolean }) {
  const [q, setQ] = useState(inicial);
  const [itens, setItens] = useState<Item[]>([]);
  const [ativo, setAtivo] = useState(-1);
  const [aberto, setAberto] = useState(false);
  const router = useRouter();
  const idLista = useId();
  const controle = useRef<AbortController | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setItens([]); return; }
    const t = setTimeout(async () => {
      controle.current?.abort();
      controle.current = new AbortController();
      try {
        const r = await fetch(`/api/busca?q=${encodeURIComponent(q)}&limite=8`, { signal: controle.current.signal });
        if (r.ok) { setItens(await r.json()); setAtivo(-1); setAberto(true); }
      } catch { /* requisição cancelada */ }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <form action="/busca" role="search" className="relative w-full"
      onSubmit={(e) => { if (ativo >= 0 && itens[ativo]) { e.preventDefault(); router.push(itens[ativo].url); setAberto(false); } }}>
      <label htmlFor={`${idLista}-campo`} className="sr-only">Buscar parlamentar, proposição ou tema</label>
      <input
        id={`${idLista}-campo`} name="q" value={q} autoComplete="off" type="search"
        placeholder="Busque um parlamentar, “PL 2475/2025” ou um tema"
        className={`w-full rounded border border-borda bg-superficie px-3 ${grande ? "py-3 text-lg" : "py-1.5"}`}
        role="combobox" aria-expanded={aberto && itens.length > 0} aria-controls={idLista} aria-autocomplete="list"
        aria-activedescendant={ativo >= 0 ? `${idLista}-${ativo}` : undefined}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onFocus={() => itens.length && setAberto(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((a) => Math.min(itens.length - 1, a + 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((a) => Math.max(-1, a - 1)); }
          if (e.key === "Escape") setAberto(false);
        }}
      />
      {aberto && itens.length > 0 && (
        <ul id={idLista} role="listbox" className="absolute z-20 mt-1 max-h-96 w-full overflow-auto rounded border border-borda bg-superficie shadow-lg">
          {itens.map((it, i) => (
            <li key={it.url} id={`${idLista}-${i}`} role="option" aria-selected={i === ativo}
              className={`cursor-pointer px-3 py-2 ${i === ativo ? "bg-borda/50" : ""}`}
              onMouseDown={() => router.push(it.url)}>
              <span className="block text-sm font-medium">{it.titulo}</span>
              <span className="block truncate text-xs text-suave">{it.tipo === "parlamentar" ? "" : "Proposição · "}{it.detalhe}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
