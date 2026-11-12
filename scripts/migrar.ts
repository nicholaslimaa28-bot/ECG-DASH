// Aplica as migrações do Drizzle e depois o SQL extra (extensões, índices de busca, fontes).
import { readFileSync } from "node:fs";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sql, encerrar } from "../lib/db";

await migrate(db, { migrationsFolder: "./db/migracoes" });
await sql.unsafe(readFileSync("./db/extra.sql", "utf8"));
console.log("Migrações aplicadas.");
await encerrar();
