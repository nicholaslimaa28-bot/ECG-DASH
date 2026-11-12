// Coletor da agenda do Presidente da República (gov.br/planalto).
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { buscar } from "../http";
import { executarTarefa } from "../comum";
import { hojeBrasilia, somarDias } from "@/lib/tempo";
import { PAGINA_ACOMPANHE, AGENDA_PADRAO, descobrirUrlAgenda, lerAgenda } from "./normalizar";

async function urlAgenda(): Promise<string> {
  try {
    const r = await buscar(PAGINA_ACOMPANHE, { accept: "text/html", guardar: false });
    return descobrirUrlAgenda(r.corpo.toString("utf8")) ?? AGENDA_PADRAO;
  } catch {
    return AGENDA_PADRAO; // página de descoberta fora do ar: usa o caminho conhecido
  }
}

/** Coleta a agenda de `de` até `ate` (padrão: anteontem até amanhã). Dias futuros costumam dar 404 (não publicados). */
export const agenda = (de = somarDias(hojeBrasilia(), -2), ate = somarDias(hojeBrasilia(), 1)) =>
  executarTarefa("planalto", "agenda_presidente", async (c) => {
    const base = await urlAgenda();
    for (let dia = de; dia <= ate; dia = somarDias(dia, 1)) {
      const url = `${base}/${dia}`;
      const r = await buscar(url, { accept: "text/html", aceitar: [404] });
      const agora = new Date();
      if (r.status === 404) {
        // Não apaga compromissos já coletados se a página sumir: só marca o dia como não publicado se nunca existiu
        const [antes] = await db.select().from(s.agendaDia).where(and(eq(s.agendaDia.autoridade, "presidente"), eq(s.agendaDia.data, dia)));
        if (!antes) await db.insert(s.agendaDia).values({ autoridade: "presidente", data: dia, publicada: false, url, coletadoEm: agora });
        continue;
      }
      const a = lerAgenda(r.corpo.toString("utf8"), dia);
      await db.transaction(async (tx) => {
        const linha = { autoridade: "presidente", data: dia, publicada: true, aviso: a.aviso, fusoMin: a.fusoMin, url, coletadoEm: agora };
        await tx.insert(s.agendaDia).values(linha).onConflictDoUpdate({ target: [s.agendaDia.autoridade, s.agendaDia.data], set: linha });
        // A página do dia é a referência completa: substitui os compromissos (inclui remoções e mudanças de horário)
        await tx.delete(s.agendaExecutivo).where(and(eq(s.agendaExecutivo.autoridade, "presidente"), eq(s.agendaExecutivo.data, dia)));
        if (a.compromissos.length) {
          await tx.insert(s.agendaExecutivo).values(a.compromissos.map((x, i) => ({ ...x, autoridade: "presidente", data: dia, ordem: i, coletadoEm: agora })));
        }
      });
      c.lidos += a.compromissos.length;
    }
  });
