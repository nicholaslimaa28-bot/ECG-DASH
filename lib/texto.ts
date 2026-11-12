// Utilidades de texto compartilhadas entre coletores e páginas.

export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function slugify(s: string): string {
  return semAcento(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function slugParlamentar(casa: "CD" | "SF", nome: string, uf: string | null, idFonte: number): string {
  // O id oficial no fim garante unicidade (há homônimos) e permite a URL sobreviver a troca de nome
  return `${slugify(nome)}-${(uf ?? "").toLowerCase()}-${casa === "CD" ? "d" : "s"}${idFonte}`.replace(/--+/g, "-");
}

export function slugProposicao(sigla: string, numero: number, ano: number): string {
  return `${slugify(sigla)}-${numero}-${ano}`;
}

/** Limpa quebras de linha e espaços repetidos vindos das fontes. */
export function limpar(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
  return t.length ? t : null;
}

/** Na conversão XML→JSON do Senado, listas com um único item chegam como objeto. */
export function comoLista<T>(v: T | T[] | null | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Só aceita CNPJ (14 dígitos); CPF de pessoa física não é guardado (LGPD). */
export function apenasCnpj(doc: string | null | undefined): string | null {
  if (!doc) return null;
  const d = doc.replace(/\D/g, "");
  return d.length === 14 ? d : null;
}

/** Identificação "PL 2475/2025" → { sigla, numero, ano } */
export function lerIdentificacao(s: string | null | undefined): { sigla: string; numero: number; ano: number } | null {
  if (!s) return null;
  const m = s.match(/^\s*([A-Za-zÀ-ú]+)\s+(?:n[º°o.]\s*)?([\d.]+)\s*\/\s*(\d{4})/);
  if (!m) return null;
  return { sigla: m[1].toUpperCase(), numero: Number(m[2].replace(/\./g, "")), ano: Number(m[3]) };
}

/** Remove CPF que alguns fornecedores (MEI) trazem no próprio nome, ex.: "FULANO 49191160120". */
export function limparNomeFornecedor(nome: string | null): string | null {
  if (!nome) return null;
  return limpar(nome.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "").replace(/\s{2,}/g, " "));
}
