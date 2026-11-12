# Fixtures — amostras reais das fontes

Coletadas em 12/11/2026 durante a Fase 0 (ver `docs/fontes.md`). Cada lista foi reduzida a no máximo 3 itens e campos de CPF foram substituídos por `<removido>`. Serão usadas nos testes dos normalizadores.

- `camara/` — API v2 da Câmara (`dadosabertos.camara.leg.br/api/v2`)
- `senado/` — API do Senado/Congresso (`legis.senado.leg.br/dadosabertos`)
- `dou/` — `jsonArray` extraído de `in.gov.br/leiturajornal` (DO1 de 11/11/2026). Só referência de formato: o robots.txt do in.gov.br proíbe coleta automática
- `planalto/` — trechos do HTML da agenda do Presidente (05/11: dia em Brasília; 11 e 12/11: viagem com aviso de fuso)
- `datajud/` — resposta de `api_publica_tst/_search`
- `congresso/` — vetos (lista anual e resultado por dispositivo), leis de 2026, MPs e busca de processo por norma
