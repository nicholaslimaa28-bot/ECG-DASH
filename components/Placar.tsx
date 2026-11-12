// Placar de votação em texto e barra proporcional (a barra é decorativa; os números estão no texto).
import type { Votacao } from "@/lib/consultas";

export function Placar({ v }: { v: Pick<Votacao, "placarSim" | "placarNao" | "placarAbstencao" | "placarObstrucao" | "nominal" | "secreta" | "aprovada" | "placarCalculado"> }) {
  const resultado = v.aprovada == null ? null : v.aprovada ? "Aprovado" : "Rejeitado";
  if (!v.nominal) {
    return (
      <p className="text-sm text-suave">
        {resultado ? <strong className="text-texto">{resultado}</strong> : null} {v.secreta ? "· votação secreta (votos individuais não são publicados)" : "· votação simbólica (sem registro individual de votos)"}
      </p>
    );
  }
  const sim = v.placarSim ?? 0, nao = v.placarNao ?? 0, abs = v.placarAbstencao ?? 0, obs = v.placarObstrucao ?? 0;
  const total = sim + nao + abs + obs || 1;
  return (
    <div>
      <p className="tabular text-sm">
        {resultado ? <strong>{resultado}</strong> : null}
        {resultado ? " · " : ""}Sim <strong>{sim}</strong> · Não <strong>{nao}</strong> · Abstenção <strong>{abs}</strong>
        {obs ? <> · Obstrução <strong>{obs}</strong></> : null}
        {v.placarCalculado ? <span className="text-suave"> (soma dos votos publicados)</span> : null}
      </p>
      <div aria-hidden className="mt-1 flex h-2 w-full overflow-hidden rounded bg-borda">
        <div style={{ width: `${(sim / total) * 100}%` }} className="bg-texto/80" />
        <div style={{ width: `${(nao / total) * 100}%` }} className="bg-texto/40" />
        <div style={{ width: `${((abs + obs) / total) * 100}%` }} className="bg-texto/15" />
      </div>
    </div>
  );
}
