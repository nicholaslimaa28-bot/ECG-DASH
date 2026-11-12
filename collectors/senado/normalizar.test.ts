import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  normalizarSenador, normalizarLicencas, sessoesDaAgenda, normalizarSessao, reunioesDaAgenda, normalizarReuniao,
  classificarVotoSenado, normalizarVotacaoSenado, normalizarProcesso, normalizarCeaps, statusSessao,
} from "./normalizar";

const fx = (nome: string) => JSON.parse(readFileSync(`fixtures/senado/${nome}.json`, "utf8"));
const agora = new Date("2026-11-12T12:00:00Z");

describe("senadores", () => {
  it("normaliza a lista atual", () => {
    const p = fx("lista").ListaParlamentarEmExercicio.Parlamentares.Parlamentar[0];
    const s = normalizarSenador(p, true, agora);
    expect(s).toMatchObject({ casa: "SF", idFonte: 5672, nomeParlamentar: "Alan Rick", uf: "AC", partido: "REPUBLICANOS" });
    expect(s.urlFoto).toMatch(/^https:\/\//);
    expect(s.slug).toBe("alan-rick-ac-s5672");
    expect(s.telefone).toBe("(61) 3303-6333");
  });

  it("lê licenças (lista ou objeto único)", () => {
    const l = normalizarLicencas(fx("licencas"));
    expect(l[0]).toMatchObject({ inicio: "2026-10-08", tipoSigla: "LICENCA_ATIVIDADE_PARLAMENTAR" });
    const unica = normalizarLicencas({ LicencaParlamentar: { Parlamentar: { Licencas: { Licenca: { Codigo: "1", DataInicio: "2026-01-01" } } } } });
    expect(unica).toHaveLength(1);
  });
});

describe("agenda", () => {
  it("normaliza sessões do Plenário do Senado e do Congresso", () => {
    const sessoes = sessoesDaAgenda(fx("agenda_plen"));
    const cn = normalizarSessao(sessoes[0], agora);
    expect(cn.casa).toBe("CN");
    expect(cn.deliberativa).toBe(false); // sessão solene
    expect(cn.inicio.toISOString()).toBe("2026-11-11T13:00:00.000Z");
    const sf = normalizarSessao(sessoes[1], agora);
    expect(sf.casa).toBe("SF");
    expect(sf.deliberativa).toBe(true);
    expect(sf.status).toBe("suspensa");
    expect(sf.pauta![0].proposicao).toEqual({ sigla: "PLP", numero: 230, ano: 2025 });
  });

  it("aceita hora sem zero à esquerda", () => {
    const sessao = { ...sessoesDaAgenda(fx("agenda_plen"))[1], Hora: "9:00" };
    expect(normalizarSessao(sessao, agora).inicio.toISOString()).toBe("2026-11-11T12:00:00.000Z");
  });

  it.each([["Em andamento", "em_andamento"], ["Encerrada", "encerrada"], ["Não Realizada", "cancelada"], ["Agendada", "agendada"], [undefined, "agendada"]])(
    "situação %s → %s", (s, e) => expect(statusSessao(s)).toBe(e));

  it("normaliza reunião de comissão cancelada", () => {
    const r = normalizarReuniao(reunioesDaAgenda(fx("agenda_com"))[0], agora);
    expect(r).toMatchObject({ casa: "CN", status: "cancelada", orgaos: "CMCVM", idFonte: "reuniao-15032" });
  });
});

describe("votações e presença", () => {
  it.each([
    ["Sim", "sim", "presente"], ["Não", "nao", "presente"], ["Abstenção", "abstencao", "presente"],
    ["P-NRV", "presente_sem_voto", "presente"], ["Presidente (art. 51 RISF)", "presidente", "presente"],
    ["MIS", "ausente", "ausencia_justificada"], ["AP", "ausente", "ausencia_justificada"], ["L2", "ausente", "ausencia_justificada"],
    ["NCom", "ausente", "ausencia_nao_justificada"],
  ])("%s → %s / %s", (sigla, voto, presenca) => expect(classificarVotoSenado(sigla)).toEqual({ tipoVoto: voto, presenca }));

  it("usa o placar oficial da orientação de bancada", () => {
    const v = fx("votacao")[0];
    const o = fx("orient").votacoes.find((x: { sequencialVotacao: number }) => x.sequencialVotacao === v.sequencialVotacao);
    const n = normalizarVotacaoSenado(v, o, agora);
    expect(n.votacao).toMatchObject({ placarSim: 38, placarNao: 36, placarAbstencao: 1, placarCalculado: false, aprovada: true, nominal: true });
    expect(n.proposicao).toMatchObject({ sigla: "PEC", numero: 18, ano: 2025 });
    expect(n.orientacoes.find((x) => x.bancada === "Republicanos")).toMatchObject({ tipoBancada: "partido", orientacao: "nao", orientacaoOriginal: "NÃO" });
    expect(n.votos[0].presenca).toBe("presente");
  });

  it("sem orientação, soma os votos", () => {
    const v = fx("votacao")[0];
    const n = normalizarVotacaoSenado(v, undefined, agora);
    expect(n.votacao.placarCalculado).toBe(true);
    expect(n.votacao.placarSim).toBe(v.votos.filter((x: { siglaVotoParlamentar: string }) => x.siglaVotoParlamentar === "Sim").length);
  });
});

describe("processos", () => {
  it("lê a identificação e a situação", () => {
    const p = normalizarProcesso(fx("processo_lista")[0], agora)!;
    expect(p).toMatchObject({ sigla: "PEC", numero: 18, ano: 2025, apelido: "PEC da Segurança Pública", slug: "pec-18-2025", situacaoSenado: "Aprovada" });
  });
});

describe("despesas CEAPS", () => {
  it("normaliza valor e só guarda CNPJ", () => {
    const d = normalizarCeaps(fx("ceaps")[0]);
    expect(d.valor).toBe("2880.81");
    expect(d.fornecedorCnpj).toBe("10358691000153");
    const pf = normalizarCeaps({ ...fx("ceaps")[0], cpfCnpj: "123.456.789-01", fornecedor: "FULANO 12345678901" });
    expect(pf.fornecedorCnpj).toBeNull();
    expect(pf.fornecedorNome).toBe("FULANO");
  });
});
