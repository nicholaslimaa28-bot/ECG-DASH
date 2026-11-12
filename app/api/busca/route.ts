// API do autocompletar da busca.
import { buscar } from "@/lib/consultas";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") ?? "").slice(0, 100);
  const limite = Math.min(20, Number(u.searchParams.get("limite") ?? 10) || 10);
  const r = await buscar(q, limite);
  return Response.json(r, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
