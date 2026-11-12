import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { lerAgenda, lerFuso, descobrirUrlAgenda, AGENDA_PADRAO } from "./normalizar";

const fx = (dia: string) => readFileSync(`fixtures/planalto/agenda_presidente_${dia}.html`, "utf8");

describe("agenda do Presidente", () => {
  it("lê um dia em Brasília", () => {
    const a = lerAgenda(fx("2026-11-05"), "2026-11-05");
    expect(a.fusoMin).toBeNull();
    expect(a.compromissos).toHaveLength(3);
    expect(a.compromissos[0]).toMatchObject({ inicioTexto: "09h00", horaLocal: false, local: "Palácio do Planalto" });
    expect(a.compromissos[0].inicio!.toISOString()).toBe("2026-11-05T12:00:00.000Z"); // 9h em Brasília
    expect(a.compromissos[0].url).not.toMatch(/vcal_view$/);
  });

  it("ignora avisos ocultos do portal", () => {
    const html = `<dl class="portalMessage info" id="kssPortalMessage" style="display:none"><dt>Info</dt></dl>` + fx("2026-11-05");
    expect(lerAgenda(html, "2026-11-05").aviso).toBeNull();
  });

  it("converte horário local de viagem usando o aviso de fuso", () => {
    const a = lerAgenda(fx("2026-11-12"), "2026-11-12");
    expect(a.aviso).toMatch(/Antália/);
    expect(a.fusoMin).toBe(360);
    const c = a.compromissos[0];
    expect(c.inicioTexto).toBe("13h00");
    expect(c.horaLocal).toBe(true);
    // 13h em Antália (Brasília +6h) = 7h em Brasília = 10h UTC
    expect(c.inicio!.toISOString()).toBe("2026-11-12T10:00:00.000Z");
  });

  it.each([
    ["(Fuso horário: +6h em relação a Brasília)", 360],
    ["Fuso horário: -1h em relação a Brasília", -60],
    ["Fuso horário: +8h30 em relação a Brasília", 510],
    ["Nova Délhi (Fuso horário: + 8h 30min em relação a Brasília)", 510],
    ["Sem informação de fuso", null],
  ])("lerFuso(%s) = %s", (t, esperado) => expect(lerFuso(t)).toBe(esperado));

  it("descobre a URL da agenda na página do Planalto", () => {
    expect(descobrirUrlAgenda(`<a href="${AGENDA_PADRAO}">Agenda</a>`)).toBe(AGENDA_PADRAO);
    const nova = "https://www.gov.br/planalto/pt-br/acompanhe-o-planalto/agenda-do-presidente-da-republica-fulano/agenda-do-presidente-da-republica";
    expect(descobrirUrlAgenda(`<a href="${nova}">`)).toBe(nova);
    expect(descobrirUrlAgenda("<html></html>")).toBeNull();
  });
});
