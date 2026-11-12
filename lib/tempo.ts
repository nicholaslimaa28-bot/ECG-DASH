// Horários: o Brasil não tem horário de verão desde 2019, então Brasília é sempre UTC−3.
export const FUSO = "America/Sao_Paulo";
const OFFSET = "-03:00";

/** Converte "2026-11-11T10:43" ou "2026-11-11 10:43:00" (sem fuso, horário de Brasília) em Date. */
export function deBrasilia(texto: string | null | undefined): Date | null {
  if (!texto) return null;
  const t = texto.trim().replace(" ", "T");
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(t)) return new Date(t); // já tem fuso
  const completo = /^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t}T00:00:00` : t.length === 16 ? `${t}:00` : t;
  const d = new Date(completo + OFFSET);
  return isNaN(d.getTime()) ? null : d;
}

/** "11/11/2026" → "2026-11-11" */
export function dataBrParaIso(d: string): string {
  const [dia, mes, ano] = d.split("/");
  return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

/** Data de hoje (AAAA-MM-DD) no fuso de Brasília. */
export function hojeBrasilia(base = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO }).format(base);
}

export function somarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function formatarHora(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" }).format(d);
}

export function formatarData(d: Date | string, opcoes: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }): string {
  const data = typeof d === "string" ? new Date(`${d.slice(0, 10)}T12:00:00Z`) : d;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: typeof d === "string" ? "UTC" : FUSO, ...opcoes }).format(data);
}
