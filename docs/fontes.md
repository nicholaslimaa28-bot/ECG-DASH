# Fontes de dados — relatório da Fase 0

Testes feitos em **12/11/2026** com chamadas reais. Amostras reduzidas (no máximo 3 itens por lista, CPF removido) estão em [`fixtures/`](../fixtures).

Legenda: ✅ funciona como esperado · ⚠️ funciona com ressalvas · ❌ indisponível ou bloqueado

| Fonte | Situação | Formato | Chave |
|---|---|---|---|
| Câmara — API v2 | ✅ (conexão instável, precisa de retry) | JSON | não |
| Câmara — arquivos em lote | ✅ | JSON/CSV por ano | não |
| Câmara — presença com justificativa | ⚠️ não está na API (ver 1.4) | HTML | não |
| Senado/Congresso — API | ✅ | JSON (pedir `.json` ou `Accept`) | não |
| Senado — presença com justificativa | ✅ por votação nominal | JSON | não |
| DOU — INLABS | ❌ em manutenção no dia do teste | XML/PDF | login |
| DOU — página pública `leiturajornal` | ❌ funciona, mas o `robots.txt` do in.gov.br proíbe robôs (`Disallow: /`) | JSON embutido no HTML | não |
| Agenda do Presidente (gov.br) | ✅ via raspagem | HTML | não |
| STF — portal | ❌ firewall bloqueia IPs de datacenter fora do Brasil | — | — |
| DataJud (CNJ) | ⚠️ funciona, mas servidor sobrecarregado; **não inclui STF** | JSON (Elasticsearch) | chave pública |
| Portal da Transparência (CGU) | não testado a fundo (401 sem chave, como esperado) | JSON | sim (cadastro) |

---

## 1. Câmara dos Deputados

**Base:** `https://dadosabertos.camara.leg.br/api/v2` (sem chave). Pedir `Accept: application/json`.

### 1.1 Paginação e limites
- Parâmetros `pagina` e `itens`. **Máximo de 100 itens por página**: pedir mais devolve só 100.
- O total vem no cabeçalho `x-total-count` e há cabeçalho `link` com `next`/`last` (também no corpo, em `links`). Paginar seguindo `rel="next"` até ele sumir.
- **Instabilidade:** várias conexões foram resetadas no meio da resposta (`Connection reset by peer`). O coletor precisa de retry com backoff (4 tentativas: 1 s, 2 s, 4 s, 8 s).
- Alguns `/votacoes/{id}/votos` devolvem **404** (27 de 100 no teste). Tratar 404 como "votação sem registro nominal" e não como erro.

### 1.2 Endpoints testados

| Endpoint | Uso no portal | Observações |
|---|---|---|
| `/deputados` | lista dos 513 em exercício | `id`, `nome`, `siglaPartido`, `siglaUf`, `urlFoto`, `email` |
| `/deputados/{id}` | perfil | ⚠️ traz **`cpf`**, data e município de nascimento. **Não guardar nem exibir o CPF** (LGPD); usar `ultimoStatus` (nome eleitoral, gabinete, situação, condição eleitoral) |
| `/deputados/{id}/despesas?ano=` | cota parlamentar | por documento: `tipoDespesa`, `valorLiquido`, `valorGlosa`, `nomeFornecedor`, `cnpjCpfFornecedor`, `urlDocumento`. O fornecedor pode ser pessoa física (CPF): exibir só o nome |
| `/deputados/{id}/eventos` | agenda do parlamentar | mesmo formato de `/eventos` |
| `/deputados/{id}/orgaos` | comissões | `titulo` (Titular/Suplente/Presidente…), `dataInicio`/`dataFim` |
| `/deputados/{id}/discursos` | discursos | período sem discursos devolve lista vazia |
| `/eventos?dataInicio=&dataFim=` | **linha do tempo do dia** | 63 eventos entre 10 e 12/11. Campos: `dataHoraInicio` (horário de Brasília, **sem fuso**), `situacao`, `descricaoTipo`, `orgaos[]`, `localCamara`, `urlRegistro` (**link do YouTube**: serve como "assistir") |
| `/eventos/{id}` | página da sessão | + `fases`, `requerimentos`, `urlDocumentoPauta` |
| `/eventos/{id}/pauta` | pauta | `ordem`, `titulo`, `regime`, `proposicao_`, `relator`, `uriVotacao`, `situacaoItem` |
| `/eventos/{id}/deputados` | presentes no evento | só **quem esteve presente** (472 na sessão deliberativa de 11/11), sem justificativa |
| `/votacoes?dataInicio=&dataFim=&idOrgao=180` | votações do Plenário (órgão 180) | `aprovacao` (1/0), `descricao`, `idEvento`. A maioria é **simbólica** (sem votos individuais) |
| `/votacoes/{id}` | detalhe | `proposicoesAfetadas`, `objetosPossiveis`, `ultimaApresentacaoProposicao`. **Não traz placar**: calcular a partir dos votos |
| `/votacoes/{id}/votos` | votos nominais | `tipoVoto`: na amostra apareceram `Sim`, `Não` e `Artigo 17` (presidente da sessão). Esperamos também `Abstenção` e `Obstrução`, a confirmar com o arquivo anual, `dataRegistroVoto`, `deputado_`. **Só lista quem votou**; ausentes não aparecem |
| `/votacoes/{id}/orientacoes` | orientação de partidos/blocos | `orientacaoVoto`, `siglaPartidoBloco`, `codTipoLideranca` (`P` partido, `B` bloco; inclui "Governo", "Maioria", "Minoria", "Oposição") |
| `/proposicoes?siglaTipo=&numero=&ano=` | busca de proposição | — |
| `/proposicoes/{id}` | página da proposição | `statusProposicao` (situação atual), `ementa`, `ementaDetalhada`, `keywords`, `urlInteiroTeor` |
| `/proposicoes/{id}/tramitacoes` | linha do tempo | `dataHora`, `siglaOrgao`, `descricaoTramitacao`, `descricaoSituacao`, `despacho`, `url` |
| `/partidos`, `/legislaturas`, `/orgaos` | cadastros | legislatura atual = 57 |

> Cuidado: o `uriProposicaoCitada` de uma votação pode apontar para um parecer, e não para o projeto. Usar `proposicoesAfetadas` para ligar votação ↔ proposição.

### 1.3 Arquivos em lote (carga histórica)
`https://dadosabertos.camara.leg.br/arquivos/{conjunto}/{formato}/{conjunto}-{ano}.{formato}`. Todos atualizados de madrugada (por volta de 6h–7h UTC). Tamanhos de 2026:

| Arquivo | Tamanho |
|---|---|
| `votacoesVotos-2026.json` | 32,7 MB |
| `votacoesOrientacoes-2026.json` | 0,8 MB |
| `eventosPresencaDeputados-2026.json` | 18 MB |
| `eventos-2026.json` | 1,7 MB |
| `proposicoes-2026.json` | 79 MB (grande: preferir CSV ou processamento em streaming) |
| `deputados/json/deputados.json` | 3,6 MB |
| Cota parlamentar: `https://www.camara.leg.br/cotas/Ano-2026.json.zip` | 5,8 MB |

### 1.4 ⚠️ Presença em plenário (decisão sua)
**A API não informa ausências justificadas.** Ela só diz quem esteve presente em cada evento (`/eventos/{id}/deputados` e o arquivo `eventosPresencaDeputados`).

A Câmara publica os números oficiais em dois lugares do site:
1. **Perfil** `https://www.camara.leg.br/deputados/{id}?ano=2026`: totais do ano (presenças / ausências justificadas / ausências não justificadas, em plenário e em comissões). O `robots.txt` **permite** essa página.
2. **Detalhe** `https://www.camara.leg.br/deputados/{id}/presenca-plenario/{ano}`: sessão por sessão, com a justificativa e a regra (Ato da Mesa nº 191/2017). O `robots.txt` **bloqueia** essa página (`Disallow: /deputados/*/*` para todos os robôs).

Também há uma diferença entre as duas: no teste, o perfil dizia **63** dias de presença e a página de detalhe dizia **64**.

Opções:
- **A (recomendada):** raspar só o perfil (permitido), 1× por dia por deputado (513 requisições espaçadas). Temos totais oficiais com justificativa, mas não o motivo de cada falta. Complementar com presença por sessão vinda da API (presente / não registrado), rotulada com clareza.
- **B:** pedir à Câmara (Fale Conosco ou Lei de Acesso à Informação) a publicação da frequência com justificativa nos dados abertos, ou autorização para coletar a página de detalhe. Pode correr em paralelo com a A.
- **C:** raspar a página de detalhe mesmo com o bloqueio do robots. **Não recomendo**: contraria o princípio de coleta respeitosa da própria especificação.

---

## 2. Senado Federal e Congresso Nacional

**Base:** `https://legis.senado.leg.br/dadosabertos` (sem chave). Especificação OpenAPI 3.1 em `/dadosabertos/v3/api-docs` (116 endpoints ativos). JSON com o sufixo `.json` ou `Accept: application/json`. A raiz `/` devolve 403, o que é normal.

Os serviços antigos devolvem XML convertido em JSON (chaves em PascalCase e listas aninhadas, como `Parlamentares.Parlamentar[]`; com **um único item**, o "array" pode vir como objeto: normalizar). Os serviços novos (`/votacao`, `/processo`, `orientacaoBancada`) devolvem JSON plano em camelCase. Vários endpoints `materia/*` antigos estão marcados como **DEPRECATED**: usar `/processo`.

### 2.1 Endpoints testados

| Endpoint | Uso | Observações |
|---|---|---|
| `/senador/lista/atual` | 81 senadores | foto, partido, UF, bloco, e-mail, telefones, mandato |
| `/senador/{codigo}` | perfil | — |
| `/senador/{codigo}/mandatos`, `/comissoes` | mandato e comissões | — |
| `/senador/{codigo}/licencas` | **licenças oficiais** | `DataInicio`, `DataFim`, `SiglaTipoAfastamento`, `DescricaoTipoAfastamento` (ex.: "Missão política ou cultural de interesse parlamentar") |
| `/senador/afastados` | fora de exercício | — |
| `/votacao?dataInicio=&dataFim=` | **votações nominais com os votos** | cada votação traz `votos[]` com **os 81 senadores**. `totalVotosSim/Nao/Abstencao` vieram `null`: calcular a partir dos votos ou usar `orientacaoBancada` |
| `/plenario/votacao/orientacaoBancada/{data}` | **orientação de bancada** + placar | `qtdVotosSim/Nao/Abstencao`, `quorumInicial/Final`, `orientacoesLideranca[]` (`partido`, `voto`; inclui "Governo"), `votosParlamentar` |
| `/plenario/agenda/dia/{AAAAMMDD}` | agenda do Plenário (SF e CN) | `Hora`, `TipoSessao`, `SituacaoSessao`, `Casa` (SF/CN), `CodigoSessao`, pauta |
| `/plenario/agenda/mes/{AAAAMMDD}`, `/plenario/agenda/atual/iCal` | próximos dias | — |
| `/plenario/resultado/{AAAAMMDD}` | resultado dos itens da pauta | — |
| `/comissao/agenda/{AAAAMMDD}` e `/{inicio}/{fim}` | reuniões de comissões | inclui comissões mistas do CN |
| `/processo?sigla=&numero=&ano=` e `/processo/{id}` | proposição | `situacaoAtual`, `siglaCasaIniciadora`, `idProcessoCasaInicial`, **`outrosNumeros[]`** (liga à Câmara), `normaGerada`, `despachos`, `autuacoes` |
| `/materia/vetos/{ano}` | vetos (56 em 2026) | `MateriaVetada` liga o veto ao PL/MPV de origem |
| `/plenario/resultado/veto/materia/{codigo}` | votação de veto | — |
| `/taquigrafia/videos/sessao/{idSessao}` | **vídeo por trecho da sessão** | `enderecoVideo`, `enderecoAudio`, orador, horário (`-03:00`) |
| `/plenario/lista/tiposComparecimento` | tabela de códigos de presença | ver 2.2 |

### 2.2 ✅ Presença dos senadores
Em `/votacao`, cada votação nominal lista os 81 senadores. Quem não votou aparece com um código de comparecimento, por exemplo:

| `siglaVotoParlamentar` | Significado | Classificação proposta |
|---|---|---|
| `Sim`, `Não`, `Abstenção` | votou | presente |
| `P-NRV` | presente, não registrou voto | presente |
| `Presidente (art. 51 RISF)` | presidindo a sessão | presente |
| `MIS` | missão da Casa no país/exterior | ausência justificada |
| `AP` | atividade parlamentar | ausência justificada |
| `L1`…`L7`, `LAP`, `LAF`… | licenças (saúde, particular, missão…) | ausência justificada |
| `NCom` | não compareceu | ausência **não justificada** |

A tabela completa está em `fixtures/senado/tipos_comp.json`. **Atenção:** é presença **por votação nominal**, e não por sessão. A página de Metodologia precisa deixar isso claro. Para "por sessão", contar o senador como presente se esteve presente em pelo menos uma votação nominal daquela sessão (regra nossa, a documentar).

### 2.3 Ligação Câmara ↔ Senado
Desde 2019 o número do projeto é único nas duas Casas (ex.: "PEC 18/2025" nas duas). O `/processo/{id}` do Senado traz `siglaCasaIniciadora: "CD"` e `outrosNumeros[]`. Chave de ligação: `(sigla, numero, ano)`, conferida com a casa iniciadora.

---

## 3. Executivo

### 3.1 Diário Oficial da União
- **INLABS** (`inlabs.in.gov.br`): no dia do teste a página exibia **"Estamos em manutenção"** e indicava a "Base de Dados de Publicações do DOU" como alternativa temporária. O README oficial (`github.com/Imprensa-Nacional/inlabs`, ramo `master`) informa que o INLABS guarda **só os últimos 4 meses**; para períodos anteriores, ver a página de Dados Abertos da Imprensa Nacional (dumps mensais). O INLABS exige cadastro (usuário e senha), então vamos precisar de `INLABS_EMAIL` e `INLABS_SENHA`.
- **Alternativa testada, sem login:** `https://www.in.gov.br/leiturajornal?data=DD-MM-AAAA&secao=do1`. O HTML traz `<script id="params" type="application/json">` com `jsonArray`: **471 atos** no DO1 de 11/11/2026. Campos: `title`, `artType` (Portaria, Decreto, Lei, Medida Provisória…), `hierarchyStr` (órgão), `pubDate`, `editionNumber`, `numberPage`, `urlTitle` (o texto integral fica em `https://www.in.gov.br/web/dou/-/{urlTitle}`) e `content` (só o começo do texto).
- ❌ **Atualização (2º teste, mesmo dia):** o `robots.txt` de `www.in.gov.br` foi lido via HTTP/1.1 e diz `User-agent: *` / `Disallow: /`. Ele **proíbe qualquer robô** no site inteiro, incluindo o `leiturajornal`. Pelo princípio de coleta respeitosa, o `leiturajornal` **não deve ser a fonte automática**. A amostra em `fixtures/dou/` serve só para conhecer o formato.
- **Proposta revisada:** a fonte do DOU é o **INLABS** (canal oficial para download automatizado, com cadastro). No 2º teste ele continuava em manutenção. Enquanto não volta, o card "Publicado hoje" mostra "dado indisponível no momento" e um link para a edição do dia. Os filtros de interesse são `artType` (Lei, Decreto, Medida Provisória, vetos; confirmar os valores exatos) e a hierarquia "Atos do Poder Executivo" / "Presidência da República". Outra fonte permitida: `/legislacao/lista` do Senado, para leis e decretos já publicados (com algum atraso).

### 3.2 Agenda do Presidente
- URL: `https://www.gov.br/planalto/pt-br/acompanhe-o-planalto/agenda-do-presidente-da-republica-lula/agenda-do-presidente-da-republica/AAAA-MM-DD` → 200, HTML estável: `li.item-compromisso-wrapper` > `time.compromisso-inicio`, `h2.compromisso-titulo`, `div.compromisso-local`, link `vcal_view` por compromisso.
- O `robots.txt` do gov.br permite (só bloqueia formulários e áreas de outros órgãos).
- ⚠️ **Fuso horário:** em viagem, o horário vem no **fuso local**, com um aviso no topo (ex.: "Antália (Turquia) (Fuso horário: +6h em relação a Brasília)"). O coletor precisa ler esse aviso e converter, ou exibir o aviso junto.
- ⚠️ **A URL contém o nome do presidente** (`...-lula`). Haverá posse em **1º/01/2027**, e o caminho pode mudar. O coletor deve descobrir a URL a partir da página de "Acompanhe o Planalto" e não fixá-la no código. A agenda do Vice segue o mesmo padrão (`agenda-do-vice-presidente-geraldo-alckmin`).
- A primeira requisição falhou com "Empty reply" e as seguintes funcionaram: retry necessário.
- Sugestão para a Fase 2: avaliar o **e-Agendas (CGU)**, que publica agendas de autoridades federais em formato aberto e evitaria a raspagem. Domínio não testado nesta fase.

### 3.3 Portal da Transparência (CGU)
`api.portaldatransparencia.gov.br` → 401 sem chave, como esperado. Fase posterior (`PORTAL_TRANSPARENCIA_CHAVE`).

---

## 4. Judiciário

### 4.1 ❌ STF
Todo o portal (`portal.stf.jus.br`, `noticias.stf.jus.br`, `transparencia.stf.jus.br`), **até o `robots.txt`**, devolveu **403 do firewall F5** ("The requested URL was rejected"). O bloqueio vale para o IP do nosso ambiente de nuvem nos EUA. É muito provável que também bloqueie Vercel e GitHub Actions, que rodam em datacenters nos EUA.

Opções para a Fase 3:
- **A:** rodar o coletor do STF em infraestrutura **no Brasil** (VPS barata em São Paulo, ou região `sa-east-1`/`southamerica-east1`) e testar de lá se o bloqueio é geográfico.
- **B:** pedir ao STF (Ouvidoria / Lei de Acesso à Informação) acesso ou dados abertos da pauta e dos resultados.
- **C:** começar o Judiciário só com links para a pauta oficial e a TV Justiça, sem coletar dados, até resolver A ou B.

### 4.2 ⚠️ DataJud (CNJ)
- Base: `https://api-publica.datajud.cnj.jus.br/api_publica_{tribunal}/_search` (POST, Elasticsearch DSL). Cabeçalho `Authorization: APIKey <chave>`. A chave pública vigente está em `https://datajud-wiki.cnj.jus.br/api-publica/acesso/`; ela **pode mudar**, então guardar em `DATAJUD_API_KEY`.
- **Não existe índice do STF.** Há STJ, TST, TSE, STM, TRFs, TJs, TRTs, TREs e TJMs.
- O servidor estava **sobrecarregado**: 429 (`es_rejected_execution_exception`, fila cheia), consultas com ordenação estourando 40 s, e respostas de 25–45 s com shards falhando. O cliente precisa de timeout longo, retry espaçado, cache agressivo e consultas simples (por `numeroProcesso`, sem ordenação).
- Campos: `numeroProcesso`, `tribunal`, `grau`, `classe`, `orgaoJulgador`, `assuntos`, `movimentos[]` (código TPU + data), `nivelSigilo`, `dataAjuizamento` (formato `AAAAMMDDhhmmss`).
- Citação obrigatória: "Fonte: CNJ – DataJud".

---

## 5. Transmissões ao vivo

| Origem | Como obter o link |
|---|---|
| Câmara | campo `urlRegistro` de cada evento (YouTube da Câmara) ✅ |
| Senado | vídeos por trecho via `/taquigrafia/videos/sessao/{id}` (depois da sessão). Ao vivo: link fixo da TV Senado ⚠️ |
| Congresso | sessões conjuntas aparecem na agenda do Senado (`Casa = CN`) e na da Câmara ("Sessão Conjunta") |
| STF | link fixo da TV Justiça (sem dado por sessão, ver 4.1) |
| Executivo | link fixo do Canal Gov |

Os links fixos dos canais vão num arquivo de configuração, revisado manualmente.

---

## 6. Regras de coleta (valem para todos os coletores)
- User-Agent: `TresPoderesHoje/<versão> (+<url do site>; <e-mail de contato>)`. O e-mail fica em `COLETOR_EMAIL_CONTATO`, nunca no código.
- Requisições em série por fonte, com no máximo 2 por segundo; backoff exponencial em 429/5xx e resets; respeitar `Retry-After`.
- Guardar cada resposta bruta (comprimida) com URL, horário e hash. Processar de novo a partir do bruto quando o normalizador mudar.
- Horários: a Câmara manda sem fuso (horário de Brasília); o Senado manda `-03:00` ou sem fuso; o Planalto manda no fuso do local da agenda. Converter tudo para `timestamptz`.
- Fontes em XML convertido: tratar "lista com um item" que vem como objeto.

---

## 7. Achados da Fase 1 (12/11/2026)

- **Despesas dos senadores (CEAPS):** `https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/{ano}`. API administrativa do Senado, sem chave, um JSON por ano (16.505 lançamentos em 2026, 6,8 MB). Campos: `codSenador` (o mesmo código da API legislativa), `tipoDespesa`, `cpfCnpj`, `fornecedor`, `data`, `valorReembolsado`. O campo `detalhamento` traz nomes de passageiros, inclusive assessores: **não é guardado**.
- **Cota da Câmara (arquivo anual):** cada linha tem `idDeputado` (o mesmo id da API v2) e `numeroDeputadoID` (outro identificador, que não usamos). Linhas de lideranças vêm sem `idDeputado` e são ignoradas. Documentos parcelados repetem `idDocumento`: a chave é `idDocumento-parcela`. `dataEmissao` às vezes vem vazio. Alguns fornecedores MEI trazem o CPF no próprio nome, e ele é removido.
- **Votos nominais recentes da Câmara:** das 185 votações de Plenário de 1º a 12/11/2026, só 1 tinha `/votos` publicado no dia da coleta. Em maio de 2026, a proporção de nominais foi bem maior. É provável que parte dos votos nominais seja publicada com atraso. Por isso a tarefa `frequente` recoleta os últimos 3 dias, e vale uma recoleta semanal de 30 dias.
- **Agenda do Plenário do Senado:** a hora vem sem zero à esquerda (`"9:00"`).
- **Autoria no Senado:** `/processo?codigoParlamentarAutor={cod}&sigla={PL|PEC…}&dataInicioApresentacao=AAAA-MM-DD` funciona e inclui coautoria.
- **Presença (perfil da Câmara):** os totais coletados batem com a página oficial (ex.: deputado 204379 em 2026: 63 / 0 / 16 no Plenário; 12 / 0 / 44 nas comissões).

---

## 8. Fase 2A — Agenda do Presidente (12/11/2026)

- **URL do dia:** `{base}/AAAA-MM-DD`. Dias ainda não publicados (futuros) devolvem **404**: o site mostra "a Presidência ainda não publicou a agenda deste dia".
- **Descoberta da base:** o coletor procura o link `agenda-do-presidente-da-republica*/agenda-do-presidente-da-republica` em `https://www.gov.br/planalto/pt-br/acompanhe-o-planalto`. Se não encontrar, usa o caminho conhecido (que tem `-lula` no nome). Isso protege contra a troca de URL na posse de 2027.
- **Fuso em viagens:** o horário publicado é o **local**, com o aviso `.portalMessage.info` "Antália (Turquia) (Fuso horário: +6h em relação a Brasília)". O **vCal** de cada compromisso trata esse horário como se fosse de Brasília (ex.: "13h00" em Antália → `DTSTART:20261112T160000Z`, ou seja, 13h de Brasília, quando o correto é 7h): **não usar o vCal**. Convertemos com a diferença publicada no aviso.
- O portal tem um `dl.portalMessage.info` oculto (`display:none`, texto "Info") em todas as páginas: deve ser ignorado.
- O gov.br às vezes responde com "Empty reply from server": o retry resolve.
- **Vice-Presidente e ministros:** a agenda do Vice não fica mais no Planalto; a página da Vice-Presidência aponta para o **e-Agendas (CGU)**. O robots.txt permite tudo, e há uma API oficial (`https://eagendas.cgu.gov.br/api/v2`, documentada em `github.com/cgugovbr/eagendas-publico/api-consulta`), mas ela **exige token pessoal** gerado por quem faz login no e-Agendas (conta gov.br). Variável prevista: `EAGENDAS_TOKEN`.

---

## 9. Fase 2B — Sanções, vetos, leis e MPs (12/11/2026)

- **Vetos por ano:** `/materia/vetos/{ano}.json` responde com **301** para `/dados/ListaVetosAnoCN{ano}.json`: o cliente precisa seguir o redirecionamento. Cada veto traz:
  - `Total` (Sim/Não), `Assunto`, `Comentario`;
  - `Mensagem.UrlPlanalto` (razões do veto);
  - `DataSobrestacaoPauta` / `SobrestandoPauta`;
  - `MateriaVetada` (sigla/número/ano do projeto ou MP) com `NormaGerada` (lei, data e edição do DOU).
- **Resultado do veto:** `/plenario/resultado/veto/materia/{codigoMateria}.json` → `Dispositivos.Dispositivo[]` com `Situacao`: **Mantido**, **Rejeitado** (veto derrubado) ou **Não Apreciado**, mais `DataSessao`. Exemplo real: VET 3/2026 (veto total ao PL 2162/2023) foi "Rejeitado" em 30/04/2026 e virou a Lei 15.402.
- **Leis:** `/legislacao/lista.json?tipo=LEI-n&ano=AAAA` (e `tipo=LCP` para leis complementares). Os filtros de data são **ignorados**: sem `tipo` e `ano`, a resposta traz o acervo inteiro (7 MB). Em 2026: 206 leis ordinárias e 14 complementares.
- **Lei → projeto de origem:** `/processo?tipoNorma=LEI&numeroNorma=N&anoNorma=AAAA` devolve o processo que originou a lei. As 220 leis de 2026 foram ligadas ao projeto.
- **Medidas provisórias:** `/processo?sigla=MPV&ano=AAAA` traz número, data de edição e situação ("SEM EFICÁCIA", "TRANSFORMADA EM NORMA JURÍDICA"...). Em 2026: 68 MPs.
- **Sanção sem veto:** não há lista própria. Aparece como lei publicada cujo projeto não tem veto.

---

## 10. Fase 2C — Diário Oficial (situação em 12/11/2026)

- **INLABS continua em manutenção** (2º e 3º testes do dia).
- **Fluxo oficial confirmado** nos scripts de `github.com/Imprensa-Nacional/inlabs` (`public/python`):
  1. `POST https://inlabs.in.gov.br/logar.php` com `email` e `password` (formulário), que devolve o cookie `inlabs_session_cookie`;
  2. `GET https://inlabs.in.gov.br/index.php?p=AAAA-MM-DD&dl=AAAA-MM-DD-{DO1|DO2|DO3|DO1E|DO2E|DO3E}.zip` com o cookie e o cabeçalho `origem: 736372697074`, que devolve um ZIP de XML por seção (as edições extras têm o sufixo `E`);
  3. resposta **404** = edição inexistente naquele dia.
- **Pendente para implementar:**
  - credenciais `INLABS_EMAIL` / `INLABS_SENHA` (cadastro gratuito, feito pelo responsável do projeto);
  - **uma amostra real do XML**, para escrever e testar o leitor sem supor o formato.
- **Alternativas descartadas:** a página "Base de Dados de Publicações do DOU" monta os links de download só com JavaScript, e o `robots.txt` de `www.in.gov.br` proíbe robôs (`Disallow: /`). Por isso não é usada como fonte automática.
- **Enquanto isso:** leis e MPs já vêm do Senado (Fase 2B), com a edição do DOU em que foram publicadas. Decretos, nomeações e exonerações dependem do INLABS.
