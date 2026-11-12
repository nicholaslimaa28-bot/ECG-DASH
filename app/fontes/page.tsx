// Fontes e licenças.
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Fontes e licenças" };

const FONTES = [
  ["Câmara dos Deputados — Dados Abertos", "https://dadosabertos.camara.leg.br", "Deputados, eventos e pautas, votações, votos, orientações, proposições, tramitação e presença em eventos (API v2); cota parlamentar (arquivo anual)."],
  ["Câmara dos Deputados — perfil do deputado", "https://www.camara.leg.br/deputados/quem-sao", "Totais oficiais de presença em Plenário e comissões."],
  ["Senado Federal / Congresso Nacional — Dados Abertos Legislativos", "https://legis.senado.leg.br/dadosabertos", "Senadores, licenças, agenda do Plenário e das comissões, votações nominais, orientação de bancada, processos legislativos, vetos, leis federais e medidas provisórias."],
  ["Presidência da República — Agenda do Presidente", "https://www.gov.br/planalto/pt-br/acompanhe-o-planalto", "Compromissos oficiais do Presidente, dia a dia (página pública, coleta permitida pelo robots.txt do gov.br)."],
  ["Senado Federal — Dados Abertos Administrativos", "https://adm.senado.gov.br/adm-dadosabertos/swagger-ui/index.html", "Cota para o Exercício da Atividade Parlamentar dos Senadores (CEAPS)."],
];

export default function Fontes() {
  return (
    <article className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Fontes e licenças</h1>
      <p>Usamos apenas dados públicos publicados pelos próprios órgãos, em formato aberto. Os dados são reproduzidos com citação da fonte e link para a origem em cada página.</p>
      <ul className="space-y-3">
        {FONTES.map(([nome, url, uso]) => (
          <li key={url}><a href={url} target="_blank" rel="noopener" className="font-medium">{nome}</a><span className="block text-sm text-suave">{uso}</span></li>
        ))}
      </ul>
      <h2 className="text-xl font-semibold">Em breve</h2>
      <p className="text-sm">Diário Oficial da União (Imprensa Nacional — INLABS), agendas do Vice-Presidente e de ministros (e-Agendas/CGU), Supremo Tribunal Federal e DataJud (CNJ). Quando usarmos o DataJud, as telas trarão a citação “Fonte: CNJ – DataJud”, como exige o termo de uso.</p>
      <h2 className="text-xl font-semibold">Privacidade (LGPD)</h2>
      <p className="text-sm">Exibimos apenas informação funcional de agentes públicos, como os órgãos já publicam. Não armazenamos CPF, data de nascimento ou endereço residencial, ainda que algumas fontes os disponibilizem.</p>
      <p className="text-sm"><strong>Site independente, sem vínculo com os órgãos oficiais.</strong></p>
    </article>
  );
}
