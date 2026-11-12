// Linha de comando dos coletores.
//   npm run coletar -- frequente            agenda + votações (dias de sessão: a cada 10 min)
//   npm run coletar -- diaria               cadastros, despesas, presença, autoria, tramitações (1×/dia)
//   npm run coletar -- camara:votacoes 2026-05-01 2026-05-31   uma tarefa avulsa, com argumentos
import { existsSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");

const { encerrar } = await import("@/lib/db");
const camara = await import("./camara/coletar");
const senado = await import("./senado/coletar");
const planalto = await import("./planalto/coletar");
const congresso = await import("./congresso/coletar");

type Tarefa = (...args: string[]) => Promise<unknown>;
const tarefas: Record<string, Tarefa> = {
  "camara:cadastro": () => camara.cadastro(),
  "camara:agenda": (de, ate) => camara.agenda(de, ate),
  "camara:votacoes": (de, ate) => camara.votacoes(de, ate),
  "camara:despesas": (ano) => camara.despesas(ano ? Number(ano) : undefined),
  "camara:presenca": (ano) => camara.presenca(ano ? Number(ano) : undefined),
  "camara:autoria": (desde) => camara.autoria(desde),
  "camara:tramitacoes": (dias) => camara.tramitacoesRecentes(dias ? Number(dias) : undefined),
  "senado:cadastro": () => senado.cadastro(),
  "senado:agenda": (de, ate) => senado.agenda(de, ate),
  "senado:votacoes": (de, ate) => senado.votacoes(de, ate),
  "senado:despesas": (ano) => senado.despesas(ano ? Number(ano) : undefined),
  "senado:autoria": (desde) => senado.autoria(desde),
  "planalto:agenda": (de, ate) => planalto.agenda(de, ate),
  "congresso:vetos": (...anos) => congresso.vetos(anos.length ? anos.map(Number) : undefined),
  "congresso:leis": (ano) => congresso.leis(ano ? Number(ano) : undefined),
  "congresso:mpvs": (ano) => congresso.mpvs(ano ? Number(ano) : undefined),
};

// Rotinas agrupam tarefas na ordem certa (cadastros antes de votos, por exemplo)
const rotinas: Record<string, string[]> = {
  frequente: ["camara:agenda", "senado:agenda", "camara:votacoes", "senado:votacoes", "planalto:agenda"],
  diaria: [
    "camara:cadastro", "senado:cadastro", "camara:despesas", "senado:despesas",
    "camara:presenca", "camara:autoria", "senado:autoria", "camara:tramitacoes",
    "congresso:vetos", "congresso:leis", "congresso:mpvs",
  ],
};
rotinas.inicial = [...rotinas.diaria.slice(0, 2), ...rotinas.frequente, ...rotinas.diaria.slice(2)];

const [nome, ...args] = process.argv.slice(2);
const lista = nome && rotinas[nome] ? rotinas[nome] : nome && tarefas[nome] ? [nome] : null;
if (!lista) {
  console.log(`Uso: npm run coletar -- <rotina|tarefa> [args]\nRotinas: ${Object.keys(rotinas).join(", ")}\nTarefas: ${Object.keys(tarefas).join(", ")}`);
  process.exit(1);
}

let falhou = false;
for (const t of lista) {
  const status = await tarefas[t](...(lista.length === 1 ? args : []));
  if (status === "erro") falhou = true;
}
await encerrar();
process.exit(falhou ? 1 : 0);
