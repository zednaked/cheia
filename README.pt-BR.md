# Cheia

**Um simulador de enchentes de Curitiba e da Região Metropolitana que roda no
navegador.** Você escolhe uma chuva (em mm/h, ou um dos cenários da curva de
chuvas intensas de Curitiba) e vê a água descer pelo relevo de verdade, encher
os rios e sair para os bairros. Um ranking ao vivo mostra os bairros e
municípios com mais área debaixo d'água. E, com um El Niño forte se formando,
um segundo painel coloca a chuva e o calor previstos para os próximos seis
meses ao lado do que os El Niños fortes do passado fizeram, e transforma um
mês em ponto de partida para a enchente.

**[Abrir o simulador](https://zednaked.github.io/cheia/)** · Não precisa
instalar nada · [English](README.md)

![Uma chuva de 100 anos, de uma hora, sobre Curitiba, em duas horas simuladas](docs/cheia.webp)

*Chuva com tempo de retorno de 100 anos (98 mm em uma hora), duas horas
simuladas, gravado direto do navegador. Azul-claro é poucos centímetros; roxo é
dois metros ou mais.*

Antes de escrever uma linha, fui ver o que já existia para Curitiba. O Flood
Hub do Google prevê cheias lentas de rio e avisa que não cobre alagamento
repentino em cidade grande, que é justamente o que Curitiba tem. O Plano
Diretor de Drenagem do estado tem as manchas de inundação por rio, em PDFs de
2002. Pesquisadores já mapearam o risco de bacias isoladas. Mas nada deixava
você perguntar *"e se chover 80 mm em uma hora, para onde vai a água?"* e ver a
resposta no mapa.

![A interface no pico da cheia: controles de chuva, o mapa 3D e o ranking dos bairros afetados](docs/screenshot.webp)

## O que dá para fazer

- **Escolher a chuva.** Intensidade e duração livres, ou cenários prontos: do
  temporal de todo verão (2 anos de retorno) à cheia de três dias do Iguaçu
  (100 anos).
- **Ajustar a cidade.** Quanto o solo e as galerias absorvem, o nível inicial
  dos rios, a rugosidade do terreno.
- **Passar o mouse em qualquer ponto** e ver o bairro, a altitude, a lâmina
  d'água agora e no pico, e a hora em que a água passou de 30 cm ali.
- **Ligar "Pico da cheia"** para ver a mancha máxima da simulação inteira, não
  só a do momento.
- **Abrir "Próximos meses"** e rodar a enchente com o solo e os rios de um mês
  específico: o mais provável pela previsão, o mais chuvoso, ou "como em 1997".

## Os próximos seis meses

Em 8 de outubro de 2026, o Centro de Previsão Climática da NOAA manteve o
alerta de El Niño: um evento forte a muito forte é provável até março de 2027,
com 83% de chance de que outubro a dezembro seja o mais forte desde 1950. No
Sul do Brasil, El Niño forte costuma significar primavera e verão chuvosos, e
muita gente em Curitiba está se perguntando o que isso quer dizer para a sua
rua. Por isso o simulador ganhou uma segunda pergunta: *não "e se chover
80 mm", mas "como vai estar o mês em volta dessa chuva".*

![O painel dos próximos meses: chuva mensal em Curitiba, a faixa normal, a previsão de 51 membros e os El Niños fortes do passado](docs/cenarios.webp)

São três fontes, mantidas separadas de propósito:

- **A previsão:** ECMWF SEAS5, 51 membros, seis meses à frente, chuva e
  temperatura diárias para Curitiba, buscadas ao vivo no Open-Meteo toda vez
  que o painel abre.
- **O normal:** reanálise ERA5 para o mesmo ponto, de 1991 a 2020.
- **O que os El Niños fortes fizeram de fato:** os meses de outubro a abril dos
  seis desde 1982 (1982, 1991, 1997, 2009, 2015 e 2023), pelo ERA5. Isso é
  medição, não modelo, e está ali para conferir a previsão.

O que o painel mostrava em 16 de outubro de 2026:

```
             normal   previsão: mediana (10-90%)   mês chuvoso*   temp. máx.
out 2026     130 mm   327 mm  (258-400)              100%           -1,2 °C
nov 2026     128 mm   234 mm  (160-360)               96%           +0,7 °C
dez 2026     157 mm   206 mm  (128-325)               71%           +0,5 °C
jan 2027     227 mm   206 mm  (124-300)               24%           +1,0 °C
fev 2027     177 mm   159 mm   (72-284)               27%           +1,2 °C
mar 2027     132 mm   151 mm   (91-241)               53%           +0,7 °C

* fração dos 51 membros acima do terço mais chuvoso de 1991-2020; num ano qualquer, 33%
```

**Leia a previsão como chuvosa demais.** Ela não tem correção de viés: a API
não oferece as previsões retroativas que permitiriam corrigir. Nos 26 dias até
10 de outubro, o único trecho em que existem as duas coisas, o modelo deu
**208 mm** para Curitiba e o ERA5 registrou **147 mm**: 42% a mais. É pouco
tempo para montar uma correção, então o painel mostra a diferença em vez de
escondê-la. E os El Niños do passado apontam para o mesmo lado, sem modelo
nenhum: em 5 dos 6, outubro em Curitiba ficou acima da mediana de 1991-2020
(130 mm), entre 157 e 321 mm. O sexto, 1991, teve 129 mm.

**Do mês à enchente.** Uma previsão sazonal não sabe em que dia vem o temporal.
O que ela sabe é como o solo e os rios vão estar quando ele vier. Escolha um
mês e uma condição (a mediana da previsão, o décimo mais chuvoso dela, ou "como
em 1997") e o painel prepara a simulação:

- **Solo.** Os 5 dias mais chuvosos do mês definem a umidade antecedente pelo
  método SCS (seco abaixo de 35,6 mm, úmido acima de 53,3 mm), e a perda por
  infiltração e galerias acompanha essa classe: 15 mm/h no normal, 6,5 mm/h
  com o solo encharcado.
- **Rios.** O nível inicial sobe com a chuva do mês em relação ao normal, de
  0,3 a 3 m. Essa parte é uma aproximação, e o painel avisa.
- **Calor.** Chuvas curtas ficam cerca de 7% mais intensas por grau de
  aquecimento (Clausius-Clapeyron). A chuva de projeto da curva de Curitiba é
  ajustada pela anomalia de temperatura prevista.

A mesma chuva (10 anos de retorno, uma hora), lida depois de duas horas
simuladas, em área que passou de 30 cm de água:

```
mês normal                                   138 km²
solo e rios como em novembro de 1997         165 km²   +19%
o décimo mais chuvoso da previsão de outubro 177 km²   +29%
```

![O cenário de novembro de 1997 no pico, sobre a Cidade Industrial; o mouse mostra 50 cm de água, que passou de 30 cm à 1h22](docs/cenario-cic.webp)

## O que roda na aba

```
grade          1536 × 1536 células de 34,5 m, 53 × 53 km
relevo         SRTM 30 m (AWS Terrain Tiles), 36 tiles,   1,3 MB
imagem         Esri World Imagery, 576 tiles,             9,8 MB
rios, lagos,
limites        OpenStreetMap, baixado antes,              1,5 MB gzip
               3.041 cursos d'água, 1.302 lagos,
               17 municípios, 289 bairros
clima          resumos do ERA5 1981-2026, baixados antes,  32 KB gzip
               previsão sazonal SEAS5, ao vivo,             ~180 KB
modelo         água rasa inercial local, um fragment shader por passo
```

Tudo roda no seu computador: sem servidor, sem conta, sem chave de API. O
GitHub Pages entrega o HTML e o arquivo do OSM; relevo e imagem vêm direto dos
servidores públicos de tiles.

![A várzea do Iguaçu e o Belém chegando nele, a sudeste do centro, no pico do cenário de novembro de 1997, relevo exagerado 4×](docs/iguacu.webp)

**A hidráulica** é a formulação inercial local de Bates et al. (2010), a mesma
que está dentro do LISFLOOD-FP, que é o que os pesquisadores de inundação usam
de fato. Profundidade da água em cada célula, vazão em cada face, atrito de
Manning, passo de tempo que se ajusta à água mais funda (CFL), bordas abertas.
A cada passo entra a chuva menos uma perda (infiltração mais galerias, em
mm/h).

## Três coisas que precisei consertar antes de a água ir para onde a água vai

**O SRTM mede o topo das coisas.** É um modelo de superfície do ano 2000: uma
faixa de mata ou um aterro de estrada atravessando um vale vira uma represa, e
a chuva empoça atrás dela. Preenchendo só as depressões rasas (menos de 3 m),
**182 km² da grade continuavam em buracos fechados** com mais de 30 cm, quase
todos enfileirados ao longo dos vales. A correção, nesta ordem: abrir passagem
em cada represa falsa, até 5 m de corte, e depois preencher o que sobra com uma
inclinação mínima para os planos escoarem (priority-flood, Barnes et al.
2014). Só preencher alaga demais: na mesma chuva de 10 anos, por volta de
1h45, só preencher marcou 170 km² acima de 30 cm, e abrir antes de preencher
marcou 137 km². Nenhum dos dois números foi conferido com uma enchente real
(veja abaixo).

**Os rios precisam saber para que lado é descida.** Com células de 34 m,
pontes, ruído e copa de árvore quebram os canais em poças. O OSM desenha todo
curso d'água no sentido da correnteza, então cada um é gravado no relevo com
uma cota que só desce ao longo da linha, com no máximo 10 m de corte.

**A primeira versão rodava a 22 fps com a simulação parada.** Na GPU integrada
AMD Renoir em que construí isto, a região inteira na tela dava 2,4 milhões de
triângulos, a maioria menor que um pixel. Dividir o relevo em 144 blocos com
quatro níveis de detalhe (e "saias" para esconder as emendas) levou a
**81 fps**. O passo da simulação caiu de 14 ms para **5,5 ms** juntando
profundidade, as duas vazões e o leito numa única textura RGBA32F: cada passo
virou uma passada que lê 5 texels por célula, em vez de duas passadas lendo
umas 11. Nessa GPU o modelo anda **cerca de 4 minutos simulados por
segundo**: uma chuva de uma hora e tudo que vem depois cabem em meio minuto.

## O que ele não enxerga

- **Não foi validado.** Não comparei com uma enchente observada. A camada de
  áreas sujeitas a inundação da prefeitura, citada nos artigos, não está hoje
  na página de downloads do IPPUC. Leia o mapa como *por onde a água passa
  primeiro*, e não como *qual altura ela vai ter na sua rua*.
- **As galerias são um número só.** A drenagem debaixo da cidade entra como uma
  taxa de perda, igual em todo lugar.
- **Não entra água de fora.** O Iguaçu recebe só a chuva que cai dentro do
  quadrado de 53 km, não a que cai rio acima.
- **O relevo é de 2000** e inclui prédios e árvores. Obras recentes, como
  bacias de contenção e córregos canalizados, não estão nele.
- **A chuva é igual em toda parte.** A região inteira recebe o mesmo temporal
  ao mesmo tempo. Os temporais de verão de Curitiba, na vida real, têm poucos
  quilômetros de largura.
- **A parte sazonal é um ponto só e não tem correção de viés.** Chuva e
  temperatura vêm da célula sobre o centro de Curitiba, e a previsão veio 42%
  acima no único período que deu para conferir. A passagem da chuva do mês
  para solo e rios usa um método consagrado para o solo (SCS) e uma
  aproximação para os rios.

É uma ferramenta educativa e de exploração. **Não é previsão e não substitui
os alertas da Defesa Civil.** Em caso de chuva forte, ligue 199 e cadastre-se
nos alertas por SMS mandando seu CEP para 40199.

## Rodar localmente

```sh
npm install
npm run dev        # http://localhost:5173
npm run data       # baixa de novo rios e limites do OSM (Overpass)
node scripts/fetch-climate.mjs   # refaz os resumos do ERA5 e a foto da previsão
```

A área fica em `src/region.js`, como um bloco de tiles de mapa: outra cidade é
trocar cinco números e rodar `npm run data`. O deploy no GitHub Pages está em
`.github/workflows/pages.yml` e roda a cada push na `main`.

## Créditos

Previsão e reanálise: ECMWF SEAS5 e ERA5 (Copernicus) via
[Open-Meteo](https://open-meteo.com/). Estado do ENSO: NOAA
[CPC](https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.html).
Relevo: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)
(SRTM, NASA/USGS). Imagem: Esri, Maxar, Earthstar Geographics. Rios e limites:
© colaboradores do [OpenStreetMap](https://www.openstreetmap.org/copyright),
ODbL. Chuvas de projeto: equação IDF de Curitiba, de Fendrich.

Licença MIT.
