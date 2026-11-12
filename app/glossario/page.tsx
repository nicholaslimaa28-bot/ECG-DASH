import type { Metadata } from "next";
import { GLOSSARIO } from "@/lib/glossario";

export const metadata: Metadata = { title: "Glossário", description: "Termos do Legislativo explicados em linguagem simples." };

export default function Glossario() {
  const itens = Object.entries(GLOSSARIO).sort((a, b) => a[1].termo.localeCompare(b[1].termo));
  return (
    <article className="max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Glossário</h1>
      <dl className="space-y-4">
        {itens.map(([id, g]) => (
          <div key={id} id={id} className="scroll-mt-4"><dt className="font-semibold">{g.termo}</dt><dd>{g.definicao}</dd></div>
        ))}
      </dl>
    </article>
  );
}
