import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  normalizarDeputado, normalizarEvento, normalizarPauta, normalizarVotacao, normalizarOrientacoes,
  normalizarProposicao, normalizarTramitacoes, normalizarDespesa, limparNomeFornecedor, lerPresencaPerfil,
  statusEvento, normalizarTipoVoto,
} from "./normalizar";

const fx = (nome: string) => JSON.parse(readFileSync(`fixtures/camara/${nome}.json`, "utf8")).dados;
const agora = new Date("2026-11-12T12:00:00Z");

describe("deputados", () => {
  it("usa o último status e nunca lê o CPF", () => {
    const lista = fx("deputados")[0];
    const det = fx("dep_det");
    const d = normalizarDeputado(lista, det, agora);
    expect(d.idFonte).toBe(204379);
    expect(d.nomeParlamentar).toBe("Acácio Favacho");
    expect(d.uf).toBe("AP");
    expect(d.slug).toBe("acacio-favacho-ap-d204379");
    expect(JSON.stringify(d)).not.toMatch(/cpf/i);
  });
});

describe("eventos", () => {
  it("converte horário de Brasília e mapeia a situação", () => {
    const e = normalizarEvento(fx("eventos_hoje")[1], agora);
    expect(e.inicio.toISOString()).toBe("2026-11-11T13:43:00.000Z"); // 10:43 em Brasília
    expect(e.status).toBe("encerrada");
    expect(e.orgaos).toBe("CTRAB");
    expect(e.deliberativa).toBe(true);
  });

  it("reconhece sessão não deliberativa", () => {
    const e = normalizarEvento({ ...fx("eventos_hoje")[1], descricaoTipo: "Sessão Não Deliberativa Solene" }, agora);
    expect(e.deliberativa).toBe(false);
  });

  it("guarda o link do vídeo da sessão", () => {
    const e = normalizarEvento(fx("evento_det"), agora);
    expect(e.linkVideo).toMatch(/youtube\.com/);
  });

  it.each([
    ["Encerrada (Final)", "encerrada"], ["Encerrada (Termo)", "encerrada"], ["Cancelada", "cancelada"],
    ["Convocada", "agendada"], ["Em Andamento", "em_andamento"], ["Suspensa", "suspensa"],
  ])("status %s → %s", (orig, esperado) => expect(statusEvento(orig)).toBe(esperado));

  it("normaliza a pauta", () => {
    const p = normalizarPauta(fx("evento_pauta"));
    expect(p[0].titulo).toBe("REQ 2965/2026");
    expect(p[0].proposicao).toEqual({ sigla: "REQ", numero: 2965, ano: 2026 });
  });
});

describe("votações", () => {
  it("calcula o placar a partir dos votos nominais", () => {
    const v = normalizarVotacao(fx("votacao_det"), fx("votacao_votos"), agora);
    // A amostra tem 3 votos (reduzida); o placar é a soma deles
    const sims = fx("votacao_votos").filter((x: { tipoVoto: string }) => x.tipoVoto === "Sim").length;
    expect(v.votacao.nominal).toBe(true);
    expect(v.votacao.placarSim).toBe(sims);
    expect(v.votacao.placarCalculado).toBe(true);
    expect(v.votacao.aprovada).toBe(true);
    expect(v.proposicao).toMatchObject({ sigla: "PEC", numero: 221, ano: 2019 });
    expect(v.idEventoFonte).not.toBeNull();
  });

  it("votação simbólica não tem placar", () => {
    const v = normalizarVotacao(fx("votacoes")[0], [], agora);
    expect(v.votacao.nominal).toBe(false);
    expect(v.votacao.placarSim).toBeNull();
  });

  it("mapeia tipos de voto", () => {
    expect(normalizarTipoVoto("Artigo 17")).toBe("presidente");
    expect(normalizarTipoVoto("Obstrução")).toBe("obstrucao");
    expect(normalizarTipoVoto("Abstenção")).toBe("abstencao");
  });

  it("classifica orientações", () => {
    const o = normalizarOrientacoes(fx("votacao_orient"));
    expect(o[0]).toMatchObject({ bancada: "Maioria", tipoBancada: "lideranca", orientacao: "sim" });
    expect(o[1]).toMatchObject({ bancada: "AVANTE", tipoBancada: "partido" });
  });
});

describe("proposições", () => {
  it("normaliza proposição e tramitação", () => {
    const p = normalizarProposicao(fx("prop_det"), agora);
    expect(p.slug).toBe("pl-2475-2025");
    expect(p.situacaoCamara).toBe("Aguardando Envio ao Senado Federal");
    const t = normalizarTramitacoes(fx("prop_tram"));
    expect(t.length).toBeGreaterThan(0);
    expect(t[0].dataHora).toBeInstanceOf(Date);
  });
});

describe("despesas", () => {
  it("ignora linhas de liderança e só guarda CNPJ", () => {
    expect(normalizarDespesa({ idDocumento: 1, ano: 2026, mes: 1, descricao: "X", dataEmissao: null, valorLiquido: "10", fornecedor: "A", cnpjCPF: "", urlDocumento: null })).toBeNull();
    const d = normalizarDespesa({
      idDeputado: 204379, idDocumento: 8077914, ano: 2026, mes: 3, descricao: "MANUTENÇÃO DE ESCRITÓRIO",
      dataEmissao: "2026-03-26T00:00:00", valorLiquido: "954.3", fornecedor: "EDVALDO FRANCISCO DE OLIVEIRA 49191160120",
      cnpjCPF: "123.456.789-01", urlDocumento: null,
    })!;
    expect(d.valor).toBe("954.30");
    expect(d.idFonte).toBe("8077914-0");
    expect(d.fornecedorCnpj).toBeNull();
    expect(d.fornecedorNome).toBe("EDVALDO FRANCISCO DE OLIVEIRA");
  });

  it("aceita data de emissão vazia", () => {
    const d = normalizarDespesa({ idDeputado: 1, idDocumento: 2, parcela: 1, ano: 2026, mes: 1, descricao: "X", dataEmissao: "", valorLiquido: "1", fornecedor: null, cnpjCPF: null, urlDocumento: null })!;
    expect(d.dataDocumento).toBeNull();
    expect(d.idFonte).toBe("2-1");
  });

  it("remove CPF do nome do fornecedor", () => {
    expect(limparNomeFornecedor("JOAO 123.456.789-01 ME")).toBe("JOAO ME");
  });
});

describe("presença (perfil)", () => {
  it("lê totais oficiais de plenário e comissões", () => {
    const html = readFileSync("fixtures/camara/perfil_presenca_204379_2026.html", "utf8");
    const p = lerPresencaPerfil(html);
    expect(p.plenario).toEqual({ presencas: 63, ausenciasJustificadas: 0, ausenciasNaoJustificadas: 16 });
    expect(p.comissoes).toEqual({ presencas: 12, ausenciasJustificadas: 0, ausenciasNaoJustificadas: 44 });
  });

  it("devolve null quando o bloco não existe", () => {
    expect(lerPresencaPerfil("<html></html>")).toEqual({ plenario: null, comissoes: null });
  });
});
