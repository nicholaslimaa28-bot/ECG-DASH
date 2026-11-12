// Busca unificada: parlamentares, proposições por número ou por tema.
import type { Metadata } from "next";
import Link from "next/link";
import { buscar } from "@/lib/consultas";
import { BuscaRapida } from "@/components/BuscaRapida";

export const metadata: Metadata = { title: "Busca" };
type Props = { searchParams: Promise<{ q?: string }> };

export default async function Busca({ searchParams }: Props) {
  const q = ((await searchParams).q ?? "").slice(0, 100);
  const r = q ? await buscar(q, 40) : [];
  const grupos = [
    ["parlamentar", "Parlamentares"],
    ["proposicao", "Proposições"],
  ] as const;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Busca</h1>
      <BuscaRapida inicial={q} grande />
      <p className="text-sm text-suave">Exemplos: um nome (aceita erro de digitação e falta de acento), um número como “PEC 18/2025” ou um tema como “segurança pública”.</p>
      {q && !r.length && <p>Nenhum resultado para “{q}”.</p>}
      {grupos.map(([tipo, titulo]) => {
        const itens = r.filter((x) => x.tipo === tipo);
        return itens.length ? (
          <section key={tipo}>
            <h2 className="mb-1 text-lg font-semibold">{titulo}</h2>
            <ul className="space-y-2">
              {itens.map((x) => (
                <li key={x.url}><Link href={x.url} className="font-medium">{x.titulo}</Link><span className="block text-sm text-suave">{x.detalhe}</span></li>
              ))}
            </ul>
          </section>
        ) : null;
      })}
    </div>
  );
}
