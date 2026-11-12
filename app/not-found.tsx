import Link from "next/link";
export default function NaoEncontrado() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">Página não encontrada</h1>
      <p>O endereço pode ter mudado ou o dado ainda não foi coletado. <Link href="/busca">Tente a busca</Link>.</p>
    </div>
  );
}
