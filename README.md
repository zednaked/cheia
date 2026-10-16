# Cheia

Simulador 3D de enchentes de Curitiba e Região Metropolitana, rodando inteiro
no navegador (three.js + WebGL2). Você escolhe uma chuva (mm/h e duração, ou
um cenário da curva IDF de Curitiba) e vê a água escorrer pelo relevo, encher
os rios e transbordar. Um ranking mostra os bairros e municípios com mais área
alagada.

## Como funciona

- **Relevo:** SRTM 30 m via [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/),
  baixado em tempo de execução (grade 1536×1536, ~34 m por célula, ~53 km de lado).
- **Rios, lagos, bairros e municípios:** OpenStreetMap, pré-baixados em
  `public/data/osm.json` (`npm run data` atualiza).
- **Preparação do relevo:** os rios do OSM são "queimados" no relevo seguindo
  o sentido da correnteza; depois as depressões falsas do SRTM (matas, prédios,
  aterros) são rompidas (até 5 m) e preenchidas (priority-flood).
- **Hidráulica:** modelo inercial local de Bates et al. (2010), o mesmo do
  LISFLOOD-FP, em um único fragment shader por passo, com passo de tempo
  adaptativo (CFL) e bordas abertas.
- **Chuva efetiva:** intensidade − perdas (infiltração + galerias), em mm/h.

## Rodar

```sh
npm install
npm run dev
```

O deploy no GitHub Pages é feito pelo workflow em `.github/workflows/pages.yml`
a cada push na `main`.

## Limitações

Ferramenta educativa e exploratória, não é previsão nem substitui a Defesa
Civil. O SRTM mede a superfície (topo de prédios e árvores), tem 30 m de
resolução e é de 2000; a drenagem urbana é representada só como uma taxa de
perda; não há vazão vinda de fora da área simulada.
