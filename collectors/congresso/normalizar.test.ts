import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { vetosDaLista, dispositivosDoResultado, resultadoVeto, normalizarVeto, leisDaLista, normalizarMpv } from "./normalizar";

const fx = (n: string) => JSON.parse(readFileSync(`fixtures/congresso/${n}.json`, "utf8"));
const agora = new Date("2026-11-12T12:00:00Z");

describe("vetos", () => {
  it("lê a lista anual e liga à matéria vetada e à lei gerada", () => {
    const vetos = vetosDaLista(fx("vetos_2026"));
    const n = normalizarVeto(vetos[0], dispositivosDoResultado(fx("resultado_veto_176246")), agora);
    expect(n.veto).toMatchObject({ numero: 56, ano: 2026, total: false, emTramitacao: true, resultado: "aguardando", dataSobrestacao: "2026-12-09" });
    expect(n.veto.urlMensagem).toMatch(/planalto\.gov\.br/);
    expect(n.proposicao).toMatchObject({ sigla: "MPV", numero: 1370, ano: 2026, normaGerada: "Lei nº 15.527 de 06/11/2026", dataNorma: "2026-11-06" });
  });

  it("veto total derrubado: a lei foi promulgada mesmo com veto total", () => {
    const vetos = vetosDaLista(fx("vetos_2026"));
    const enc = vetos.find((v) => v.Materia.Codigo === "172342")!;
    const n = normalizarVeto(enc, dispositivosDoResultado(fx("resultado_veto_172342")), agora);
    expect(n.veto).toMatchObject({ total: true, emTramitacao: false, resultado: "derrubado" });
    expect(n.veto.dispositivos![0]).toMatchObject({ situacao: "Rejeitado", dataSessao: "2026-04-30" });
    expect(n.proposicao).toMatchObject({ sigla: "PL", numero: 2162, ano: 2023, normaGerada: "Lei nº 15.402 de 08/05/2026" });
  });

  const d = (situacao: string) => ({ identificador: null, descricao: "x", situacao, dataSessao: null });
  it.each([
    [true, [d("Não Apreciado")], "aguardando"],
    [true, [d("Mantido"), d("Não Apreciado")], "em_deliberacao"],
    [false, [d("Mantido"), d("Mantido")], "mantido"],
    [false, [d("Rejeitado")], "derrubado"],
    [false, [d("Mantido"), d("Rejeitado")], "derrubado_em_parte"],
    [false, [], "encerrado"],
  ] as const)("emTramitacao=%s → %s", (em, disp, esperado) => expect(resultadoVeto(em, [...disp])).toBe(esperado));
});

describe("leis e MPs", () => {
  it("lê leis com link para o texto integral", () => {
    const l = leisDaLista(fx("leis_2026"))[0];
    expect(l).toMatchObject({ tipo: "Lei", numero: 15528, ano: 2026, dataAssinatura: "2026-11-11", nome: "Lei nº 15.528 de 11/11/2026" });
    expect(l.url).toBe("https://normas.leg.br/?urn=urn:lex:br:federal:lei:2026-11-11;15528");
  });

  it("normaliza medida provisória", () => {
    const m = normalizarMpv(fx("mpv_2026")[1], agora)!;
    expect(m).toMatchObject({ sigla: "MPV", numero: 1334, ano: 2026, situacaoSenado: "Transformada em norma jurídica", dataApresentacao: "2026-01-22", slug: "mpv-1334-2026" });
  });

  it("acha o projeto de origem de uma lei", () => {
    const p = fx("processo_por_norma_15528")[0];
    expect(p.identificacao).toBe("PL 5649/2026");
  });
});
