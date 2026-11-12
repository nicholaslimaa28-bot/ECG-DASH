// Canal para o cidadão reportar erro em um dado.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { reporteErro } from "@/lib/db/schema";

export const metadata: Metadata = { title: "Reportar erro em um dado" };
type Props = { searchParams: Promise<{ pagina?: string; enviado?: string }> };

async function enviar(form: FormData) {
  "use server";
  const urlPagina = String(form.get("pagina") ?? "").slice(0, 500).trim();
  const descricao = String(form.get("descricao") ?? "").slice(0, 2000).trim();
  const email = String(form.get("email") ?? "").slice(0, 200).trim();
  if (String(form.get("site") ?? "")) redirect("/reportar-erro?enviado=1"); // campo-isca contra robôs
  if (!urlPagina || descricao.length < 10) redirect("/reportar-erro?enviado=0");
  await db.insert(reporteErro).values({ urlPagina, descricao, emailContato: email || null });
  redirect("/reportar-erro?enviado=1");
}

export default async function ReportarErro({ searchParams }: Props) {
  const sp = await searchParams;
  const campo = "w-full rounded border border-borda bg-superficie px-2 py-1";
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Reportar erro em um dado</h1>
      <p>Encontrou um número diferente da fonte oficial? Conte qual página e o que está errado. Vamos conferir com a fonte e corrigir.</p>
      {sp.enviado === "1" && <p role="status" className="rounded border border-ok p-2 text-ok">Obrigado! Seu relato foi registrado.</p>}
      {sp.enviado === "0" && <p role="alert" className="rounded border border-erro p-2 text-erro">Informe a página e uma descrição com pelo menos 10 caracteres.</p>}
      <form action={enviar} className="space-y-3">
        <label className="block">Página com o erro (endereço)
          <input name="pagina" required defaultValue={sp.pagina} className={campo} />
        </label>
        <label className="block">O que está errado?
          <textarea name="descricao" required minLength={10} rows={5} className={campo} />
        </label>
        <label className="block">Seu e-mail (opcional, só para respondermos)
          <input name="email" type="email" className={campo} />
        </label>
        <div aria-hidden className="hidden"><label>Não preencha<input name="site" tabIndex={-1} autoComplete="off" /></label></div>
        <button className="rounded border border-borda bg-superficie px-4 py-2 font-medium">Enviar</button>
      </form>
    </div>
  );
}
