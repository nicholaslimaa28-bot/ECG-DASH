# Três Poderes Hoje (nome provisório)

Site de transparência que reúne, em linguagem simples, o que acontece hoje na Câmara, no Senado e no Congresso, com fonte e horário em cada dado. Executivo e Judiciário entram nas próximas fases. A especificação completa está em [`SPEC.md`](SPEC.md).

> Site independente, sem vínculo com os órgãos oficiais.

## Estado atual — Fase 1 (MVP Legislativo)

| Funcionalidade | Situação |
|---|---|
| Home "Hoje": plenários e comissões do dia, status, pauta resumida, botão "assistir" | ✅ |
| Votações recentes com placar e orientação das bancadas | ✅ |
| Próximos 7 dias nos Plenários | ✅ |
| Página do parlamentar: presença, votos nominais (com orientação do partido), proposições, gastos, agenda | ✅ |
| Páginas de sessão, votação (voto a voto) e proposição (situação nas duas Casas, tramitação na Câmara) | ✅ |
| Busca unificada (nome com erro de digitação/sem acento, número "PL 2475/2025", tema) | ✅ |
| `/status`, Metodologia, Fontes e licenças, Glossário, Reportar erro | ✅ |
| Executivo: agenda do Presidente (com fuso em viagens), leis, vetos e MPs | ✅ Fase 2A e 2B |
| Executivo: Diário Oficial (INLABS) | Fase 2C — aguarda o INLABS e o cadastro |
| Judiciário (STF, DataJud) | Fase 3 — card com links oficiais |

## Arquitetura

- **Web:** Next.js 16 (App Router) + TypeScript + Tailwind 4, renderizado no servidor com revalidação (ISR).
- **Banco:** PostgreSQL com Drizzle (esquema em `lib/db/schema.ts`, migrações em `db/migracoes`). Busca com `pg_trgm` + full-text em português com `unaccent` (`db/extra.sql`).
- **Coletores** (`collectors/`): um por fonte, separados em **normalizadores** (funções puras, testadas com amostras reais de `fixtures/`) e **coletores** (buscam → guardam o bruto → normalizam → gravam → registram a execução em `coleta`). Mudanças de status, novas votações e novos eventos são registradas em `mudanca`, que vai alimentar os alertas da Fase 4.
- **Agendamento:** GitHub Actions (`.github/workflows/coleta.yml`).

```
app/               páginas (home, parlamentar, proposicao, sessao, votacao, busca, status…)
components/        componentes de interface
lib/               banco, consultas, glossário, utilidades de data/texto
collectors/        http.ts (UA, ritmo, retry, bruto), comum.ts (gravação), camara/, senado/, cli.ts
fixtures/          amostras reais das fontes, usadas nos testes
docs/              fontes.md (relatório das fontes) e esquema-banco.md
```

## Rodando localmente

Requisitos: Node 22+ e PostgreSQL 16 com as extensões `pg_trgm` e `unaccent` (vêm no pacote `postgresql-contrib`).

```bash
cp .env.example .env           # ajuste DATABASE_URL e COLETOR_EMAIL_CONTATO
npm install
npm run db:migrate             # cria as tabelas, extensões e índices
npm run coletar -- inicial     # primeira carga (cadastros, agenda, votações, despesas, presença, autoria) — ~40 min
npm run dev                    # http://localhost:3000
npm test                       # testes dos normalizadores
```

> Atrás de um proxy HTTP (como em alguns ambientes de nuvem), o `fetch` do Node só usa o `HTTPS_PROXY` com `NODE_USE_ENV_PROXY=1`.

### Tarefas de coleta

| Comando | O que faz | Frequência sugerida |
|---|---|---|
| `npm run coletar -- frequente` | agenda (ontem até +7 dias) e votações (últimos 3 dias) da Câmara e do Senado | a cada 10–15 min em dias de sessão, 8h–23h; senão 1×/hora |
| `npm run coletar -- diaria` | cadastros, licenças, despesas, presença (Câmara), autoria, tramitações recentes | 1×/dia de madrugada |
| `npm run coletar -- camara:votacoes 2026-05-01 2026-05-31` | tarefa avulsa com período (para carga histórica) | sob demanda |

Execute sem argumentos para ver todas as tarefas.

## Publicação (custo zero para começar)

1. **Banco:** crie um Postgres no [Neon](https://neon.tech) ou no [Supabase](https://supabase.com) (planos gratuitos). Ambos têm `pg_trgm` e `unaccent`.
2. **Coletores:** no GitHub, cadastre o secret `DATABASE_URL` (e `COLETOR_EMAIL_CONTATO`) e a variável `SITE_URL`. Rode o workflow "Coleta" manualmente com `inicial` uma vez.
   - Em repositório **privado**, a coleta a cada 15 min gasta mais que os 2.000 minutos mensais gratuitos do Actions. Nesse caso, torne o repositório público (Actions é gratuito sem limite em repositórios públicos) ou reduza a frequência.
3. **Site:** importe o repositório na [Vercel](https://vercel.com) (plano Hobby) com `DATABASE_URL` e `SITE_URL`.

## Princípios (resumo)

Neutralidade (sem ranking, sem adjetivos, sem cores de partido) · toda informação com fonte e horário · nunca estimar dado que falta · contexto em números sensíveis (presença com justificativa) · linguagem simples (glossário) · mobile first. Detalhes de cálculo na página `/metodologia`.
