// Metodologia: como cada número exibido é obtido ou calculado.
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Metodologia", description: "Como cada número do site é obtido ou calculado a partir das fontes oficiais." };

export default function Metodologia() {
  const h2 = "mt-6 text-xl font-semibold";
  return (
    <article className="max-w-3xl space-y-3">
      <h1 className="text-2xl font-bold">Metodologia</h1>
      <p>Este site não produz dados próprios: organiza o que os órgãos oficiais publicam. Cada bloco mostra a fonte e o horário da coleta. Quando uma fonte falha, mostramos “dado indisponível no momento” e nunca uma estimativa. O estado das coletas fica na página <Link href="/status">Status</Link>.</p>

      <h2 id="presenca" className={h2}>Presença</h2>
      <h3 className="font-semibold">Deputados</h3>
      <p>Mostramos os <strong>totais oficiais</strong> que a Câmara publica no perfil de cada deputado: dias de presença, ausências justificadas e ausências não justificadas em sessões deliberativas do Plenário, e o mesmo para reuniões de comissões. A regra de registro é a do Ato da Mesa nº 191/2017. Sessões não deliberativas (solenes, de debates) não contam.</p>
      <p>A API de dados abertos da Câmara informa quem registrou presença em cada evento, mas não traz as justificativas. Por isso os totais vêm do perfil público, que o arquivo <code>robots.txt</code> da Câmara permite consultar. Coletamos uma vez por dia. O detalhamento sessão a sessão, com o motivo de cada falta, está na página oficial de presença do deputado.</p>
      <h3 className="font-semibold">Senadores</h3>
      <p>O Senado registra o comparecimento <strong>em cada votação nominal</strong>. Cada senador recebe um código oficial: voto (Sim, Não, Abstenção), “presente, não registrou voto”, presidindo a sessão, licenças, missão, atividade parlamentar ou “não compareceu”. Classificamos assim:</p>
      <ul className="list-disc pl-6">
        <li><strong>Presente:</strong> votou, presidiu ou estava presente sem registrar voto.</li>
        <li><strong>Ausência justificada:</strong> licenças (saúde, particular, maternidade/paternidade…), missão oficial, atividade parlamentar, comunicação de ausência e demais códigos de afastamento previstos.</li>
        <li><strong>Ausência não justificada:</strong> código “NCom — Não compareceu”.</li>
      </ul>
      <p>Por isso o número do Senado conta <strong>votações</strong>, não dias, e não deve ser comparado diretamente com o da Câmara.</p>

      <h2 id="votos" className={h2}>Votos e orientação de bancada</h2>
      <p>Só votações <strong>nominais</strong> têm registro de cada voto. Votações simbólicas e secretas aparecem só com o resultado. Na Câmara, o placar é a soma dos votos individuais publicados (a API não publica o placar separado). No Senado, usamos o placar oficial da orientação de bancada e, se ele faltar, a soma dos votos.</p>
      <p>“Votou com o partido” compara o voto Sim/Não com a orientação Sim/Não do partido <strong>na data da votação</strong>. Quando o partido votou dentro de uma federação ou bloco, usamos a orientação da federação ou do bloco. Abstenções, obstruções, orientação “liberado” e ausência de orientação não entram nessa comparação. Não fazemos ranking de parlamentares.</p>

      <h2 id="gastos" className={h2}>Gastos da cota parlamentar</h2>
      <p>Valores líquidos reembolsados, como publicados pela Câmara (arquivo anual da CEAP) e pelo Senado (CEAPS, API administrativa). Valores negativos são estornos ou compensações registrados pela própria Casa. Não guardamos CPF de fornecedores pessoa física e removemos números de CPF que apareçam no nome do fornecedor.</p>

      <h2 id="vetos" className={h2}>Sanções e vetos</h2>
      <p>Uma lei aparece como “sancionada ou promulgada” quando consta na legislação federal publicada; ligamos cada lei ao projeto de origem com a informação do próprio Senado. Para cada veto, mostramos o resultado da deliberação do Congresso a partir da situação de cada trecho vetado: <strong>mantido</strong>, <strong>derrubado</strong> (o trecho volta a valer) ou ainda não apreciado. Quando parte dos trechos foi derrubada e parte mantida, o veto aparece como “derrubado em parte”.</p>

      <h2 id="horarios" className={h2}>Horários</h2>
      <p>Todos os horários estão no fuso de Brasília. A situação das sessões (agendada, em andamento, encerrada, cancelada, suspensa) é a publicada pelas Casas e é atualizada a cada coleta.</p>
      <p>Na agenda do Presidente, durante viagens, a Presidência publica o <strong>horário local</strong> e um aviso com a diferença para Brasília (ex.: “Fuso horário: +6h em relação a Brasília”). Mostramos o horário como publicado e, ao lado, o equivalente em Brasília, calculado com a diferença informada no aviso. O arquivo de calendário oferecido pela página trata o horário local como se fosse de Brasília; por isso não o usamos.</p>

      <h2 id="proposicoes" className={h2}>Proposições</h2>
      <p>Desde 2019 o número de uma proposição é o mesmo nas duas Casas. Juntamos as informações da Câmara e do Senado pela combinação sigla + número + ano. A lista de proposições de um parlamentar inclui autoria e coautoria dos tipos PL, PLP, PEC, PDL (e MPV na Câmara) apresentados desde fevereiro de 2023.</p>
    </article>
  );
}
