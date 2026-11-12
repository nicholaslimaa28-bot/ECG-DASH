// Normalizador da agenda do Presidente da República (página do Planalto em gov.br).
// Não há API: lemos o HTML, que o robots.txt do gov.br permite coletar.
import * as cheerio from "cheerio";
import { deBrasilia } from "@/lib/tempo";
import { limpar } from "@/lib/texto";

export const PAGINA_ACOMPANHE = "https://www.gov.br/planalto/pt-br/acompanhe-o-planalto";
/** Caminho conhecido em 11/2026. Ele contém o nome do presidente e pode mudar com a posse de 1º/01/2027. */
export const AGENDA_PADRAO = `${PAGINA_ACOMPANHE}/agenda-do-presidente-da-republica-lula/agenda-do-presidente-da-republica`;

/**
 * Descobre a URL da agenda a partir da página "Acompanhe o Planalto", para não depender do nome
 * do presidente fixado no código. Devolve null se o link não for encontrado.
 */
export function descobrirUrlAgenda(html: string): string | null {
  const m = html.match(/href="(https:\/\/www\.gov\.br\/planalto\/pt-br\/acompanhe-o-planalto\/agenda-do-presidente-da-republica[^"/]*\/agenda-do-presidente-da-republica)"/);
  return m ? m[1] : null;
}

/**
 * Lê o aviso de fuso publicado em viagens, ex.: "Antália (Turquia) (Fuso horário: +6h em relação a Brasília)".
 * Devolve o deslocamento em minutos em relação a Brasília (+360 nesse exemplo).
 */
export function lerFuso(aviso: string | null): number | null {
  if (!aviso) return null;
  const m = aviso.match(/fuso hor[aá]rio:?\s*([+\-−–])\s*(\d{1,2})\s*h(?:\s*(\d{2})\s*(?:min)?)?/i);
  if (!m) return null;
  const sinal = m[1] === "+" ? 1 : -1;
  return sinal * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

export type Compromisso = {
  inicio: Date | null;     // horário convertido para Brasília (null se não houver horário)
  inicioTexto: string | null; // como publicado: "13h00"
  horaLocal: boolean;      // true quando o horário publicado é do local da viagem
  titulo: string;
  local: string | null;
  url: string | null;
};

/**
 * Converte a página de um dia em compromissos.
 * Em viagens, o Planalto publica o horário LOCAL e um aviso com a diferença para Brasília;
 * o link de calendário (vcal) trata esse horário como se fosse de Brasília — por isso não o usamos.
 */
export function lerAgenda(html: string, dia: string): { aviso: string | null; fusoMin: number | null; compromissos: Compromisso[] } {
  const $ = cheerio.load(html);
  // Avisos do portal: ignoramos o aviso padrão de "javascript desativado"
  // e os modelos ocultos do portal (style="display:none")
  const avisos = $(".portalMessage.info").filter((_, el) => !/display\s*:\s*none/i.test($(el).attr("style") ?? ""))
    .map((_, el) => limpar($(el).text())).get().filter((t): t is string => !!t && !/javascript/i.test(t));
  const aviso = avisos.find((a) => /fuso/i.test(a)) ?? avisos[0] ?? null;
  const fusoMin = lerFuso(aviso);

  const compromissos: Compromisso[] = [];
  $("ul.list-compromissos > li.item-compromisso-wrapper").each((_, li) => {
    const titulo = limpar($(li).find(".compromisso-titulo").text());
    if (!titulo) return;
    const texto = limpar($(li).find("time.compromisso-inicio").text());
    const m = texto?.match(/^(\d{1,2})\s*h\s*(\d{2})?/i);
    let inicio: Date | null = null;
    if (m) {
      const base = deBrasilia(`${dia}T${m[1].padStart(2, "0")}:${m[2] ?? "00"}`);
      // Horário local da viagem → Brasília: subtrai a diferença publicada
      inicio = base && fusoMin != null ? new Date(base.getTime() - fusoMin * 60_000) : base;
    }
    const href = $(li).find("a.vcal").attr("href") ?? null;
    compromissos.push({
      inicio,
      inicioTexto: texto,
      horaLocal: fusoMin != null && fusoMin !== 0,
      titulo,
      local: limpar($(li).find(".compromisso-local").text()),
      url: href ? href.replace(/\/vcal_view$/, "") : null,
    });
  });
  return { aviso, fusoMin, compromissos };
}
