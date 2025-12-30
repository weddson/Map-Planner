# Map Planner Tool

## O que e

Map Planner e uma ferramenta web para criar planos de mapas com marcadores e caminhos.
Ela roda totalmente no navegador e salva o estado no `localStorage`, sem backend.

## Recursos principais

- Importar uma imagem de mapa (PNG/JPG) ou um plano `.json`.
- Criar marcadores numerados com nome, cor e status.
- Desenhar caminhos livres ou ligar marcadores entre si.
- Filtrar marcadores por cor e ajustar zoom.
- Exportar o plano como `.json` ou `.png`.

## Fluxo rapido

1. Envie uma imagem de mapa ou abra um plano existente.
2. Use as ferramentas da barra lateral para adicionar marcadores e caminhos.
3. Ajuste cores, nomes e ligacoes entre marcadores.
4. Exporte quando o plano estiver pronto.

## Formato do plano

O arquivo `.json` exportado contem:

- `image`: imagem do mapa em data URL.
- `markers`: lista de marcadores com posicao, nome e cor.
- `paths`: lista de caminhos com pontos e ligacoes opcionais.
