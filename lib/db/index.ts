// Conexões com o Postgres (reaproveitadas entre requisições no Next.js).
// São dois clientes: o Drizzle altera os conversores de data do cliente que recebe,
// e as consultas SQL diretas (lib/consultas.ts) precisam receber Date, não texto.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "postgres://portal:portal@localhost:5432/portal";

type Global = { __sql?: ReturnType<typeof postgres>; __sqlOrm?: ReturnType<typeof postgres> };
const g = globalThis as unknown as Global;

/** Cliente para SQL direto (datas como Date). */
export const sql = g.__sql ?? postgres(url, { max: 5, onnotice: () => {} });
const clienteOrm = g.__sqlOrm ?? postgres(url, { max: 5, onnotice: () => {} });
if (process.env.NODE_ENV !== "production") {
  g.__sql = sql;
  g.__sqlOrm = clienteOrm;
}

export const db = drizzle(clienteOrm, { schema });
export { schema };

/** Encerra as conexões (usado pelos scripts de linha de comando). */
export async function encerrar() {
  await Promise.all([sql.end(), clienteOrm.end()]);
}
