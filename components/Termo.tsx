// Termo técnico com explicação em linguagem simples.
// A dica aparece ao passar o mouse, ao focar com o teclado (Tab) ou ao tocar no celular.
// Não é um link, para poder ser usada dentro de links; o glossário completo fica em /glossario.
import { GLOSSARIO } from "@/lib/glossario";

export function Termo({ id, children }: { id: keyof typeof GLOSSARIO; children?: React.ReactNode }) {
  const g = GLOSSARIO[id];
  return (
    <span className="group relative inline">
      <abbr title={g.definicao} tabIndex={0} aria-describedby={`dica-${id}`} className="cursor-help">
        {children ?? g.termo}
      </abbr>
      <span
        id={`dica-${id}`} role="tooltip"
        className="absolute bottom-full left-0 z-30 mb-1 hidden w-64 max-w-[80vw] rounded border border-borda bg-superficie p-2 text-xs font-normal text-texto shadow-lg group-focus-within:block group-hover:block"
      >
        <strong className="block">{g.termo}</strong>{g.definicao}
      </span>
    </span>
  );
}

/** Mapeia a sigla de uma proposição para o verbete do glossário, se houver. */
export function TermoSigla({ sigla }: { sigla: string }) {
  const id = sigla.toLowerCase();
  return id in GLOSSARIO ? <Termo id={id as keyof typeof GLOSSARIO}>{sigla}</Termo> : <>{sigla}</>;
}
