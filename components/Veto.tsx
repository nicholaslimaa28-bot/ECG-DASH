// Resumo de um veto presidencial e da deliberação do Congresso sobre ele.
import Link from "next/link";
import type { VetoResumo } from "@/lib/consultas";
import { formatarData } from "@/lib/tempo";
import { ROTULO_RESULTADO_VETO } from "@/collectors/congresso/normalizar";
import { Termo } from "./Termo";

export function VetoItem({ v, mostrarProposicao = true, detalhar = false }: { v: VetoResumo; mostrarProposicao?: boolean; detalhar?: boolean }) {
  const disp = v.dispositivos ?? [];
  const contagem = disp.reduce<Record<string, number>>((a, d) => ((a[d.situacao] = (a[d.situacao] ?? 0) + 1), a), {});
  return (
    <div className="text-sm">
      <p>
        <strong>Veto {v.total ? <Termo id="veto">total</Termo> : <Termo id="vetoParcial">parcial</Termo>} nº {v.numero}/{v.ano}</strong>
        {mostrarProposicao && v.proposicao && <> · <Link href={`/proposicao/${v.proposicao.slug}`}>{v.proposicao.sigla} {v.proposicao.numero}/{v.proposicao.ano}</Link></>}
        {v.dataPublicacao && <span className="text-suave"> · publicado em {formatarData(v.dataPublicacao)}</span>}
      </p>
      {v.assunto && <p>{v.assunto}</p>}
      {v.comentario && <p className="text-suave">{v.comentario}</p>}
      <p className="mt-1"><span className="font-medium">{ROTULO_RESULTADO_VETO[v.resultado] ?? v.resultado}</span>
        {disp.length > 1 && <span className="text-suave"> · {Object.entries(contagem).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(", ")} (de {disp.length} trechos)</span>}
      </p>
      {v.emTramitacao && v.dataSobrestacao && (
        <p className="text-suave">
          {v.sobrestando ? <Termo id="sobrestamento">Trancando a pauta do Congresso</Termo> : <>Passa a <Termo id="sobrestamento">trancar a pauta</Termo> em {formatarData(v.dataSobrestacao)}</>}
        </p>
      )}
      {detalhar && disp.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer">Trechos vetados ({disp.length})</summary>
          <ul className="mt-1 list-disc pl-5">
            {disp.map((d, i) => <li key={i}>{d.descricao} — <strong>{d.situacao}</strong>{d.dataSessao ? ` (sessão de ${formatarData(d.dataSessao)})` : ""}</li>)}
          </ul>
        </details>
      )}
      {v.urlMensagem && <p><a href={v.urlMensagem} target="_blank" rel="noopener">Razões do veto (mensagem da Presidência)</a></p>}
    </div>
  );
}
