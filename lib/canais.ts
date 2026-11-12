// Canais oficiais de transmissão ao vivo (revisar manualmente de tempos em tempos).
export const CANAIS = {
  CD: { nome: "TV Câmara", url: "https://www.camara.leg.br/tv" },
  SF: { nome: "TV Senado", url: "https://www12.senado.leg.br/tv" },
  CN: { nome: "TV Senado", url: "https://www12.senado.leg.br/tv" },
  // TV Justiça: domínio não verificado deste ambiente (fora da lista de hosts liberados) — conferir antes de publicar
  STF: { nome: "TV Justiça", url: "https://www.tvjustica.jus.br" },
  // Transmissões ao vivo da Presidência (página oficial verificada em 12/11/2026)
  GOV: { nome: "transmissão do Planalto", url: "https://www.gov.br/planalto/pt-br/acompanhe-o-planalto/transmissoes-ao-vivo" },
} as const;

export const CASAS: Record<string, { nome: string; curto: string }> = {
  CD: { nome: "Câmara dos Deputados", curto: "Câmara" },
  SF: { nome: "Senado Federal", curto: "Senado" },
  CN: { nome: "Congresso Nacional", curto: "Congresso" },
};

export const FONTES: Record<string, { orgao: string; url: string }> = {
  camara: { orgao: "Câmara dos Deputados — Dados Abertos", url: "https://dadosabertos.camara.leg.br" },
  senado: { orgao: "Senado Federal — Dados Abertos", url: "https://legis.senado.leg.br/dadosabertos" },
};
