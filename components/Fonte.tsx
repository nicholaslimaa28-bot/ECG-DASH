// Rodapé obrigatório de cada bloco: órgão de origem, link oficial e horário da coleta.
import { formatarHora, formatarData } from "@/lib/tempo";

export function Fonte({ orgao, url, em, observacao }: { orgao: string; url: string; em: Date | null; observacao?: string }) {
  return (
    <p className="mt-3 text-xs text-suave">
      Fonte:{" "}
      <a href={url} rel="noopener" target="_blank">
        {orgao}
      </a>
      {em ? (
        <>
          {" "}· atualizado às {formatarHora(em)} de {formatarData(em, { day: "2-digit", month: "2-digit" })}
        </>
      ) : (
        " · horário da coleta indisponível"
      )}
      {observacao ? <> · {observacao}</> : null}
    </p>
  );
}
