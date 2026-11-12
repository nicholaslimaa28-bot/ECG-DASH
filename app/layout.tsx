import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Script from "next/script";
import "./globals.css";
import { Preferencias } from "@/components/Preferencias";
import { BuscaRapida } from "@/components/BuscaRapida";

export const metadata: Metadata = {
  title: { default: "Três Poderes Hoje", template: "%s · Três Poderes Hoje" },
  description: "O que acontece hoje na Câmara, no Senado, no Executivo e no Judiciário, com dados oficiais, fonte e horário.",
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

// Aplica tema e tamanho de fonte salvos antes da primeira pintura (evita "piscar")
const scriptPreferencias = `try{var t=localStorage.getItem('tema');if(t&&t!=='auto')document.documentElement.dataset.tema=t;var f=localStorage.getItem('fonte');if(f&&f!=='normal')document.documentElement.dataset.fonte=f}catch(e){}`;

const LINKS = [
  ["/", "Hoje"],
  ["/parlamentares", "Parlamentares"],
  ["/executivo", "Executivo"],
  ["/busca", "Busca"],
  ["/metodologia", "Metodologia"],
  ["/status", "Status"],
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <Script id="preferencias" strategy="beforeInteractive">{scriptPreferencias}</Script>
      </head>
      <body className="min-h-screen">
        <a href="#conteudo" className="pular-conteudo">Pular para o conteúdo</a>
        <header className="border-b border-borda bg-superficie">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
            <Link href="/" className="mr-auto font-bold text-texto no-underline" style={{ color: "var(--texto)" }}>
              Três Poderes Hoje
            </Link>
            <Preferencias />
            <nav aria-label="Principal" className="w-full">
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {LINKS.map(([href, rotulo]) => (
                  <li key={href}><Link href={href}>{rotulo}</Link></li>
                ))}
              </ul>
            </nav>
            <div className="w-full"><BuscaRapida /></div>
          </div>
        </header>
        <main id="conteudo" className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mt-10 border-t border-borda bg-superficie">
          <div className="mx-auto max-w-5xl space-y-2 px-4 py-6 text-sm text-suave">
            <p><strong>Site independente, sem vínculo com os órgãos oficiais.</strong> Todos os dados vêm de fontes públicas, com link para a origem.</p>
            <p>
              <Link href="/fontes">Fontes e licenças</Link> · <Link href="/metodologia">Metodologia</Link> ·{" "}
              <Link href="/glossario">Glossário</Link> · <Link href="/reportar-erro">Reportar erro em um dado</Link> ·{" "}
              <Link href="/status">Status das coletas</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
