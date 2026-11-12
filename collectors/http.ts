// Cliente HTTP dos coletores: User-Agent identificado, limite de ritmo por servidor,
// retry com backoff exponencial e gravação do dado bruto para auditoria.
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const VERSAO = "0.1";

export function userAgent(): string {
  const site = process.env.SITE_URL ?? "http://localhost:3000";
  const email = process.env.COLETOR_EMAIL_CONTATO;
  return `TresPoderesHoje/${VERSAO} (+${site}${email ? `; ${email}` : ""})`;
}

/** Intervalo mínimo entre requisições ao mesmo servidor (ms). 500 ms = no máximo 2 req/s. */
const INTERVALO_MS = Number(process.env.COLETOR_INTERVALO_MS ?? 500);
const ultimaPorHost = new Map<string, number>();

async function esperarVez(host: string) {
  const agora = Date.now();
  const proxima = (ultimaPorHost.get(host) ?? 0) + INTERVALO_MS;
  ultimaPorHost.set(host, Math.max(agora, proxima));
  if (proxima > agora) await new Promise((r) => setTimeout(r, proxima - agora));
}

export class ErroHttp extends Error {
  constructor(public status: number, public url: string) {
    super(`HTTP ${status} em ${url}`);
  }
}

export type Resposta = { status: number; corpo: Buffer; url: string; coletadoEm: Date };

/** Respostas obtidas nesta execução — o registro de coleta as grava no banco ao final. */
export const brutosDaExecucao: { url: string; status: number; sha256: string; arquivo: string; coletadoEm: Date }[] = [];

function guardarBruto(r: Resposta) {
  const dir = process.env.DADOS_BRUTOS_DIR;
  if (!dir) return;
  const sha256 = createHash("sha256").update(r.corpo).digest("hex");
  const dia = r.coletadoEm.toISOString().slice(0, 10);
  const pasta = path.join(dir, new URL(r.url).hostname, dia);
  mkdirSync(pasta, { recursive: true });
  const arquivo = path.join(pasta, `${sha256.slice(0, 16)}.gz`);
  writeFileSync(arquivo, gzipSync(r.corpo));
  brutosDaExecucao.push({ url: r.url, status: r.status, sha256, arquivo, coletadoEm: r.coletadoEm });
}

type Opcoes = {
  accept?: string;
  tentativas?: number;
  timeoutMs?: number;
  /** Status tratados como resposta válida (ex.: 404 = "sem dado"), sem retry nem erro. */
  aceitar?: number[];
  guardar?: boolean;
};

export async function buscar(url: string, op: Opcoes = {}): Promise<Resposta> {
  const tentativas = op.tentativas ?? 4;
  const host = new URL(url).hostname;
  let ultimoErro: unknown;
  for (let i = 0; i < tentativas; i++) {
    await esperarVez(host);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": userAgent(), Accept: op.accept ?? "application/json" },
        signal: AbortSignal.timeout(op.timeoutMs ?? 60_000),
        redirect: "follow",
      });
      const corpo = Buffer.from(await res.arrayBuffer());
      const r: Resposta = { status: res.status, corpo, url, coletadoEm: new Date() };
      if (res.ok || op.aceitar?.includes(res.status)) {
        if (res.ok && op.guardar !== false) guardarBruto(r);
        return r;
      }
      // 4xx (exceto 429) não melhora com nova tentativa
      if (res.status < 500 && res.status !== 429) throw new ErroHttp(res.status, url);
      ultimoErro = new ErroHttp(res.status, url);
      const retryAfter = Number(res.headers.get("retry-after"));
      if (retryAfter > 0) await new Promise((r) => setTimeout(r, Math.min(retryAfter, 60) * 1000));
    } catch (e) {
      if (e instanceof ErroHttp && e.status < 500 && e.status !== 429) throw e;
      ultimoErro = e; // conexão resetada, timeout etc.
    }
    await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
  throw ultimoErro;
}

export async function buscarJson<T = unknown>(url: string, op: Opcoes = {}): Promise<T | null> {
  const r = await buscar(url, op);
  if (r.status >= 400) return null; // status aceito como "sem dado"
  return JSON.parse(r.corpo.toString("utf8")) as T;
}

export async function buscarTexto(url: string, op: Opcoes = {}): Promise<string> {
  const r = await buscar(url, { accept: "text/html", ...op });
  return r.corpo.toString("utf8");
}

export function hashDe(obj: unknown): string {
  return createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}
