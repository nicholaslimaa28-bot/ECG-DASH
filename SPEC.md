# Portal "Três Poderes Hoje" (nome provisório) — Especificação

> Especificação original do projeto. Achados da Fase 0 que ajustam este texto estão em [`docs/fontes.md`](docs/fontes.md) e [`docs/esquema-banco.md`](docs/esquema-banco.md).

---

## 1. Missão do projeto

Site de transparência pública que reúne, num só lugar e em linguagem simples, o que acontece **hoje** nos três Poderes da República:

- **Legislativo:** Câmara dos Deputados, Senado Federal e sessões do Congresso Nacional.
- **Executivo:** Presidência da República (agenda, atos, sanções e vetos), Diário Oficial da União, ministérios.
- **Judiciário:** STF (pauta e julgamentos), tribunais superiores e metadados de processos públicos.

Os portais oficiais já publicam esses dados, mas de forma espalhada e difícil para o cidadão comum. O diferencial é **organizar, cruzar e explicar**: o cidadão pesquisa um deputado ou senador e vê, numa página só, presença, votos, proposições, gastos e agenda; abre a home e vê "o que acontece hoje em Brasília" com horários e links para assistir ao vivo.

### Princípios inegociáveis

1. **Neutralidade total.** Nenhum adjetivo, ranking de "melhor/pior político", cor partidária destacada ou texto opinativo. Só dados, contexto e fonte.
2. **Toda informação tem fonte e horário.** Cada bloco mostra "Fonte: [órgão] · atualizado às HH:MM" com link para a página oficial.
3. **Não inventar dados.** Se uma fonte falhar, mostrar "dado indisponível no momento" — nunca preencher com estimativa.
4. **Contexto em números sensíveis.** Ex.: presença sempre separando *falta justificada* de *não justificada* e explicando o que conta como presença (sessões deliberativas vs. não deliberativas, missões oficiais, licenças).
5. **Linguagem simples.** Glossário embutido (tooltip) para termos como PL, PEC, MPV, requerimento de urgência, quórum, destaque, sessão deliberativa.
6. **Mobile first.** A maioria do público vai acessar pelo celular.

---

## 2. Fontes de dados

Antes de escrever qualquer integração, fazer chamadas reais a cada endpoint, inspecionar os campos e registrar em `docs/fontes.md` o que funciona, formato, paginação, limites e adaptações.

### 2.1 Câmara dos Deputados — API oficial (sem chave)
- Base: `https://dadosabertos.camara.leg.br/api/v2` · Swagger: `https://dadosabertos.camara.leg.br/swagger/api.html`
- Recursos: `/deputados`, `/deputados/{id}` (+ `/despesas`, `/discursos`, `/eventos`, `/orgaos`, `/frentes`), `/eventos`, `/eventos/{id}/pauta`, `/eventos/{id}/deputados`, `/votacoes`, `/votacoes/{id}/votos`, `/votacoes/{id}/orientacoes`, `/proposicoes` (+ `/tramitacoes`), `/orgaos`, `/partidos`.
- Paginar sempre até o fim. Usar arquivos em lote (CSV/JSON por ano) para a carga histórica.
- Presença em plenário: localizar fonte oficial com justificativa.

### 2.2 Senado Federal / Congresso Nacional — API oficial (sem chave)
- Base: `https://legis.senado.leg.br/dadosabertos` · Docs: `https://legis.senado.leg.br/dadosabertos/docs/`
- Senadores, matérias e tramitação, votações e votos nominais, comissões, agenda, vetos e MPs.
- Presença de senadores: localizar fonte oficial e como aparece a ausência justificada.

### 2.3 Executivo
- **DOU — INLABS:** XML/PDF gratuitos mediante cadastro; scripts em `Imprensa-Nacional/inlabs`.
- **Agenda do Presidente:** gov.br/planalto (raspagem respeitosa). Depois Vice e ministros.
- **Legislação:** Portal da Legislação do Planalto.
- **Portal da Transparência (CGU):** API com chave gratuita — fase posterior.

### 2.4 Judiciário
- **STF:** pauta, calendário de sessões (presenciais e virtuais), resultados. Link para a TV Justiça.
- **DataJud (CNJ):** metadados de processos, chave pública (ler de variável de ambiente). Citação obrigatória "Fonte: CNJ – DataJud". Fase posterior.

### 2.5 Transmissões ao vivo
- TV Câmara, TV Senado, TV Justiça, Canal Gov e o link de cada sessão quando a fonte fornecer.

### Boas práticas de coleta
- User-Agent identificado com e-mail de contato; respeitar `robots.txt`; rate limit + backoff exponencial; cache.
- Guardar o **dado bruto** de cada coleta antes de transformar.

---

## 3. Funcionalidades

### 3.1 Home — "Hoje nos Três Poderes"
- Linha do tempo do dia (America/Sao_Paulo): sessões e reuniões da Câmara, Senado, Congresso e STF, com horário, status (agendada / em andamento / encerrada / cancelada), pauta resumida e botão "assistir".
- Card "Votado hoje" (placar, orientação de cada partido).
- Card "Publicado no Diário Oficial hoje" (leis, decretos, MPs).
- Card "Agenda do Presidente hoje".
- Card "Próximos dias".

### 3.2 Página do parlamentar (deputado e senador)
- Foto oficial, partido, UF, mandato, comissões, contatos oficiais.
- Presença por mês e na legislatura: presente / falta justificada / falta não justificada, com a regra e link para a fonte.
- Votos nominais com filtro por tema e orientação do partido ao lado.
- Proposições de autoria e relatorias.
- Gastos da cota parlamentar (por categoria e por mês).
- Agenda / eventos.
- Botão "Seguir este parlamentar".

### 3.3 Páginas de sessão / evento
- Pauta, presentes, votações, resultado, vídeo.

### 3.4 Páginas de proposição
- Resumo simples, linha do tempo Câmara → Senado → sanção/veto, votações, situação. "Seguir esta proposta".

### 3.5 Busca unificada
- Parlamentar, proposição, sessão, ato do DOU ou processo do STF. Autocompletar, tolerância a erro e acentos.

### 3.6 Alertas
- Seguir parlamentares, proposições ou temas. Canais: Web Push (PWA) → e-mail → Telegram. WhatsApp no futuro.
- Resumo "Brasília Hoje" às 7h e 20h.

### 3.7 Resumos com IA (opcional, fase 4)
- Rótulo "resumo gerado automaticamente — leia o texto oficial", neutralidade estrita, link do original.

---

## 4. Arquitetura sugerida (custo baixo)

- Next.js (App Router) + TypeScript + Tailwind, ISR.
- PostgreSQL (Supabase/Neon gratuito) com Prisma ou Drizzle; `pg_trgm` + full-text português (`unaccent`).
- Coletores por fonte (`collectors/camara`, `senado`, `dou`, `planalto`, `stf`, `datajud`): busca → bruto → normaliza → grava → registra execução.
- Agendamento: GitHub Actions (cron) ou worker com fila.
- Frequências: dias de sessão 8h–23h a cada 5–10 min; fora disso 1 h; DOU após publicação matinal e extras; cadastros 1×/dia; despesas 1×/dia.
- Detecção de mudanças por hash → eventos `mudou_status`, `nova_votacao`, `nova_publicacao`.
- Página `/status`; alerta ao administrador após 3 falhas seguidas.
- Hospedagem: Vercel + banco gerenciado; coletores em GitHub Actions ou Railway/Fly.io.

Modelo inicial: `parlamentar`, `mandato`, `partido`, `orgao`, `evento`, `presenca`, `proposicao`, `tramitacao`, `votacao`, `voto`, `orientacao`, `despesa`, `ato_dou`, `agenda_executivo`, `julgamento_stf`, `processo`, `fonte_coleta`, `usuario`, `inscricao_alerta`, `notificacao`. IDs oficiais como referência; sempre `fonte_url` e `coletado_em`.

---

## 5. Design e acessibilidade
- Sóbrio e institucional, sem cores de partidos; uma cor por Poder apenas como identificação.
- WCAG AA, teclado, textos alternativos, fonte ajustável. Modo escuro. Rápido em 4G.
- SEO: página indexável por parlamentar e proposição.

---

## 6. Plano de execução

- **Fase 0 — Reconhecimento:** testar fontes, `docs/fontes.md`, esquema de banco. Sem site.
- **Fase 1 — MVP Legislativo:** Câmara + Senado: home "hoje", página do parlamentar, busca, `/status`.
- **Fase 2 — Executivo:** DOU, agenda do Presidente, sanções/vetos ligados às proposições.
- **Fase 3 — Judiciário:** STF; busca via DataJud.
- **Fase 4 — Alertas e resumos.**
- **Fase 5 — Extras:** comparador (sem ranking), exportação CSV, API pública.

Em cada fase: testes dos normalizadores com amostras reais em `fixtures/`, README atualizado, `.env.example` completo.

---

## 7. Aspectos legais e éticos
- LGPD: só informação funcional do agente público.
- Páginas "Metodologia" e "Fontes e licenças" (obrigatório para o DataJud).
- Aviso: "site independente, sem vínculo com os órgãos oficiais".
- Canal para reportar erro em dado.

---

## 8. Forma de trabalho
- Antes de cada fase, plano em tópicos e aguardar OK.
- Se uma fonte não oferecer o dado prometido, parar e explicar as opções.
- Soluções simples e baratas; justificar serviço pago.
- Código comentado em português.
