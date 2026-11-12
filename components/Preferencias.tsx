"use client";
// Preferências de leitura: tema claro/escuro e tamanho da fonte (guardadas só neste navegador).
import { useEffect, useState } from "react";

const TAMANHOS = ["normal", "grande", "maior"] as const;

function ler(chave: string): string | null {
  try { return localStorage.getItem(chave); } catch { return null; }
}
function gravar(chave: string, valor: string) {
  try { localStorage.setItem(chave, valor); } catch { /* navegação privada: ignora */ }
}

export function Preferencias() {
  const [fonte, setFonte] = useState<(typeof TAMANHOS)[number]>("normal");
  const [tema, setTema] = useState<string>("auto");

  useEffect(() => {
    setFonte((ler("fonte") as (typeof TAMANHOS)[number]) ?? "normal");
    setTema(ler("tema") ?? "auto");
  }, []);

  useEffect(() => {
    const raiz = document.documentElement;
    if (fonte === "normal") delete raiz.dataset.fonte; else raiz.dataset.fonte = fonte;
    if (tema === "auto") delete raiz.dataset.tema; else raiz.dataset.tema = tema;
  }, [fonte, tema]);

  const mudarFonte = (passo: number) => {
    const i = Math.min(TAMANHOS.length - 1, Math.max(0, TAMANHOS.indexOf(fonte) + passo));
    setFonte(TAMANHOS[i]);
    gravar("fonte", TAMANHOS[i]);
  };
  const alternarTema = () => {
    const escuroAgora = tema === "escuro" || (tema === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    const novo = escuroAgora ? "claro" : "escuro";
    setTema(novo);
    gravar("tema", novo);
  };

  const botao = "rounded border border-borda px-2 py-1 text-sm hover:bg-borda/40";
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Preferências de leitura">
      <button type="button" className={botao} onClick={() => mudarFonte(-1)} aria-label="Diminuir fonte">A−</button>
      <button type="button" className={botao} onClick={() => mudarFonte(1)} aria-label="Aumentar fonte">A+</button>
      <button type="button" className={botao} onClick={alternarTema} aria-label="Alternar tema claro ou escuro">◐</button>
    </div>
  );
}
