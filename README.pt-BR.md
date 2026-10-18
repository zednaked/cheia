# Cheia

**Um simulador de enchentes de Curitiba e da Região Metropolitana que roda no
navegador.** Você escolhe uma chuva (em mm/h, ou um dos cenários da curva de
chuvas intensas de Curitiba) e vê a água descer pelo relevo de verdade, encher
os rios e sair para os bairros. Um ranking ao vivo mostra os bairros e
municípios com mais área debaixo d'água, e quantas escolas, hospitais e
quilômetros de rua a água alcançou. Busque a sua rua e o simulador diz a que
horas a água passa de 30 cm ali. Solte uma célula de tempestade sobre um bairro,
reviva o temporal de 18 de fevereiro de 2025 com a chuva medida nos
pluviômetros, ou rode a previsão das próximas 48 horas. E, com um El Niño forte
se formando, um painel coloca a chuva e o calor previstos para os próximos seis
meses ao lado do que os El Niños fortes do passado fizeram.

**[Abrir o simulador](https://zednaked.github.io/cheia/)** · Não precisa
instalar nada · [English](README.md)

```
2,4 milhões de células de água, uma passada de shader por passo, 5,9 ms
temporal de 18/02/2025: a simulação alagou 9 dos 18 pontos reportados
                        (por sorte, com a mesma régua, seriam uns 4)
```

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

- **Procurar a sua rua.** A busca acha bairros, escolas e hospitais sem sair
  da página, e endereços pelo OpenStreetMap. O pino mostra a que horas a água
  passou de 30 cm ali, o pico, o perigo e um gráfico da lâmina ao longo do
  tempo. No celular, é só tocar no mapa.
- **Mandar o link.** O endereço da página guarda a chuva, a câmera e o pino:
  quem abre vê a mesma coisa, com a simulação já rodando. Dá também para
  baixar uma imagem ou gravar um vídeo do mapa, com relógio e legenda.
- **Escolher a chuva.** Intensidade e duração livres, ou cenários prontos: do
  temporal de todo verão (2 anos de retorno) à cheia de três dias do Iguaçu
  (100 anos). Na região inteira, ou numa **célula de tempestade** de poucos
  quilômetros, solta com um clique e levada pelo vento, que é como chove em
  Curitiba no verão.
- **Reviver 18/02/2025.** A chuva medida em 14 pluviômetros da Defesa Civil,
  interpolada sobre a cidade, com os 18 alagamentos reportados naquele dia
  marcados no mapa: verdes se a simulação alagou ali, vermelhos se não.
- **Rodar as próximas 48 horas.** A chuva prevista hora a hora pelo Open-Meteo
  em 16 pontos da região.
- **Ver o perigo, não só a profundidade.** A cor da água pode mostrar a classe
  de perigo da diretriz australiana ARR 2019, que junta profundidade e
  velocidade: onde a água derruba um carro pequeno, uma criança, um adulto.
  Riscos brancos mostram a correnteza.
- **Contar o que importa.** Quantas escolas e creches, hospitais e postos,
  bombeiros e delegacias a água alcançou, quantos quilômetros de rua passaram
  de 30 cm e quantos ficaram perigosos para carro. Numa chuva de 10 anos e
  uma hora, duas horas depois: 503 km de rua acima de 30 cm (66 km de vias
  principais), 519 km perigosos para carro, 90 escolas e creches e 48
  unidades de saúde com água na porta.
- **Ajustar a cidade.** Quanto o solo e as galerias absorvem, o nível inicial
  dos rios, a rugosidade do terreno.
- **Abrir "Próximos meses"** e rodar a enchente com o solo e os rios de um mês
  específico: o mais provável pela previsão, o mais chuvoso, ou "como em 1997".

![Cor por perigo numa chuva de 100 anos sobre o Parolin e o Guaíra: amarelo é raso, laranja derruba carro pequeno, vinho é perigoso para qualquer pessoa; os riscos brancos são a correnteza](docs/perigo.webp)

<img src="docs/celular.webp" alt="No celular: o pino na Rua Alferes Poli, no Rebouças, mostra que a água passou de 30 cm com 27 minutos e chegou a 1,03 m" width="300">

## Conferido com um temporal de verdade

Na terça-feira, 18 de fevereiro de 2025, choveu forte em Curitiba entre o fim da
manhã e as três da tarde: 22,8 mm em 15 minutos por volta do meio-dia (Simepar),
69 mm no Portão, quase nada no extremo sul. A Defesa Civil listou os pontos de
alagamento do dia. É o melhor caso que encontrei: lista oficial por rua, 14
pluviômetros no mesmo dia, e um evento curto e intenso, que é o que este modelo
existe para mostrar.

O botão **Reviver 18/02/2025** faz assim:

- **Chuva no espaço.** Os totais do dia dos 14 pluviômetros da Defesa Civil,
  interpolados pelo inverso do quadrado da distância numa grade de 32 × 32. A
  posição de cada pluviômetro é o centro do bairro que dá nome à estação.
- **Chuva no tempo.** Em blocos de 15 minutos a partir das 11h30, com o pico às
  12h: 34,6 mm até 12h15 e 22,8 mm nos 15 minutos mais fortes, segundo o
  Simepar.
- **Os pontos.** Os 15 da lista da Defesa Civil (reproduzida pelo Bem Paraná)
  e 3 da Banda B, geocodificados pelo OpenStreetMap.

**A régua:** um ponto conta como alagado se a simulação passou de 20 cm em
algum lugar de um quadrado de 9 × 9 células em volta dele (uns 310 m de lado),
fora da calha do rio. A régua é frouxa de propósito, porque a
posição do ponto e o relevo de 30 m não dão para mais que isso. Por isso o
painel também diz quanto dá acertar por sorte: com a mesma régua, 22% dos
pontos urbanos ficaram alagados, ou seja, uns 4 de 18 por acaso.

**O resultado: 9 de 18.**

```
Rebouças        Alferes Poli x Almirante Gonçalves       sim   26 cm
Bom Retiro      Ângelo Zeni x Carlos Pioli               sim   24 cm
Novo Mundo      Arnaldo Rudnick                          sim   89 cm
Novo Mundo      Dr. Luiz Losso Filho                     sim   89 cm
Parolin         Wenceslau Braz x Linha Verde             sim   1,03 m
Parolin         Prof. Porthos Velozo                     sim   66 cm
Parolin         Brigadeiro Franco                        sim   23 cm
Uberaba         José Hauer x Salgado Filho               sim   52 cm
Fanny           Córrego Henry Ford                       sim   85 cm
Centro          Visconde de Nácar x Saldanha Marinho     não    8 cm
CIC             Emílio Nichele                           não   14 cm
CIC             Parque Mané Garrincha                    não    7 cm
Sítio Cercado   Marialva                                 não   13 cm
Sítio Cercado   Bandeirantes, 520                        não    4 cm
Fazendinha      Waldemar Cavanha x Raul Pompéia          não    4 cm
Boqueirão       Aristóteles da Silva Santos (Belém)      não    7 cm
Boqueirão       Carlos Essenfelder x Cleto da Silva      não    7 cm
Campo Comprido  Humberto Cantarelli                      não    2 cm
```

![O temporal de 18/02/2025 reproduzido: pontos verdes onde a simulação alagou o lugar reportado, vermelhos onde não](docs/validacao.webp)

O que isso diz: o modelo acerta onde a água se junta em vale de córrego
urbano (o Parolin, o Novo Mundo, o Fanny), e erra onde o alagamento é de rio
transbordando com água que vem de longe. No Centro, o Córrego Bigorrilho subiu
2,29 m; no Boqueirão, o Belém saiu da calha. Rio que enche depende de quanto
chove rio acima e de como a calha real escoa, e uma calha queimada a partir do
OSM num relevo de 30 m não sabe isso. Também erra no sul, no Sítio Cercado,
onde os pluviômetros vizinhos marcaram de 5 a 37 mm e a interpolação puxou a
chuva para baixo.

É um evento só, uma régua frouxa e pontos de jornal. É bem melhor que o acaso,
e está longe de ser uma validação de verdade. Ainda falta uma camada oficial de
áreas inundáveis para comparar mancha com mancha.

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
                                             18/out/2026     16/out/2026
mês normal                                   127 km²         138 km²
solo e rios como em novembro de 1997         140 km²  +10%   165 km²  +19%
o décimo mais chuvoso da previsão de outubro 127 km²   0%    177 km²  +29%
```

A coluna de 16 de outubro é a que publiquei primeiro, e estava inflada: o rio
mais cheio já começava transbordando para a várzea, e isso contava como
alagamento (veja "Os rios começavam transbordando", abaixo). Com a correção, o
solo encharcado e o rio cheio de um novembro como o de 1997 ainda somam 10% de
área alagada. Já o décimo mais chuvoso de outubro sai igual ao normal:
outubro está previsto 1,2 °C mais frio que o normal, o que deixa a tempestade
8% mais fraca e anula o solo encharcado. Na primeira versão, quem fazia a
diferença ali era o rio de 2,1 m transbordando no começo.

![O cenário de novembro de 1997 no pico, sobre a Cidade Industrial; o mouse mostra 50 cm de água, que passou de 30 cm à 1h22](docs/cenario-cic.webp)

## O que roda na aba

```
grade          1536 × 1536 células de 34,5 m, 53 × 53 km
relevo         SRTM 30 m (AWS Terrain Tiles), com rios
               queimados e depressões tratadas no build,  2,8 MB gzip
imagem         Esri World Imagery, 576 tiles,             9,8 MB
rios, lagos,
limites        OpenStreetMap, baixado antes,              1,5 MB gzip
               3.041 cursos d'água, 1.302 lagos,
               17 municípios, 289 bairros,
               1.716 escolas, unidades de saúde e de socorro
ruas           malha viária do OSM, 51.129 vias, 13.640 km,
               resumida por célula dentro do arquivo do relevo
clima          resumos do ERA5 1981-2026, baixados antes,  32 KB gzip
               previsão sazonal SEAS5, ao vivo,             ~180 KB
modelo         água rasa inercial local, um fragment shader por passo
```

Tudo roda no seu computador: sem servidor, sem conta, sem chave de API. O
GitHub Pages entrega o HTML, o relevo já preparado e o arquivo do OSM; a imagem
vem direto dos servidores públicos de tiles e fica guardada no navegador
(service worker), então a segunda visita abre sem baixar tudo de novo.

![A várzea do Iguaçu e o Belém chegando nele, a sudeste do centro, no pico do cenário de novembro de 1997, relevo exagerado 4×](docs/iguacu.webp)

**A hidráulica** é a formulação inercial local de Bates et al. (2010), a mesma
que está dentro do LISFLOOD-FP, que é o que os pesquisadores de inundação usam
de fato. Profundidade da água em cada célula, vazão em cada face, atrito de
Manning, passo de tempo que se ajusta à água mais funda (CFL), bordas abertas.
A cada passo entra a chuva menos uma perda (infiltração mais galerias, em
mm/h). A chuva é a soma de três partes: uma taxa uniforme, um mapa de chuva em
grade grossa (pluviômetros, previsão) e uma célula de tempestade gaussiana que
anda. A velocidade em cada célula sai das vazões das faces, e com ela a classe
de perigo.

**Os testes** (`npm test`) rodam o modelo na GPU, num Chromium headless, em
grades pequenas feitas à mão: a água que entra numa bacia fechada tem que estar
toda lá no fim (erro abaixo de 0,01%), um lago parado tem que continuar
parado, a lâmina nunca fica negativa nem vira NaN num relevo áspero com chuva
forte, e num canal inclinado a velocidade de equilíbrio bate com a de Manning
(0,368 contra 0,359 m/s).

## Cinco coisas que precisei consertar antes de a água ir para onde a água vai

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

**Os rios começavam transbordando.** Cada simulação começava com água na
calha, até o nível escolhido. Só que a calha queimada no relevo tem uma ou duas
células de largura e, em muito lugar, a várzea ao lado é mais baixa que a água
dentro dela. Sem chover nada, em duas horas mais de 10 km² já contavam como
alagados, com 38 escolas e postos de saúde. Agora a água inicial não passa da
margem (a célula de fora da calha mais baixa ali perto), o rio se acomoda por
duas horas sem chuva antes de o relógio zerar, e o que já estava molhado no
começo não conta como alagamento. Com chuva zero e o rio a 1,5 m, sobram uns
3 km² em quatro horas, de água de rio que continua escorrendo para a várzea.
Isso mudou números que eu já tinha publicado: os cenários do El Niño mexem bem
menos no resultado do que eu dizia (veja acima), porque parte da diferença era
o rio mais cheio transbordando no começo.

**Os bairros vizinhos trocavam de nome.** O mapa de que célula é de que bairro
era desenhado num canvas, com cada bairro pintado numa cor-código. O canvas
suaviza as bordas, e a mistura da cor de um bairro com a do vizinho dava a cor
de um terceiro: um ponto no Parolin aparecia como Orleans, do outro lado da
cidade. Agora os polígonos são preenchidos por linha de varredura, célula a
célula, sem suavização.

**A primeira versão rodava a 22 fps com a simulação parada.** Na GPU integrada
AMD Renoir em que construí isto, a região inteira na tela dava 2,4 milhões de
triângulos, a maioria menor que um pixel. Dividir o relevo em 144 blocos com
quatro níveis de detalhe (e "saias" para esconder as emendas) levou a
**81 fps**. O passo da simulação caiu de 14 ms para **5,5 ms** juntando
profundidade, as duas vazões e o leito numa única textura RGBA32F: cada passo
virou uma passada que lê 5 texels por célula, em vez de duas passadas lendo
umas 11 (hoje são 5,9 ms, com a chuva que varia no espaço e a classe de
perigo). Nessa GPU o modelo anda **cerca de 4 minutos simulados por
segundo**: uma chuva de uma hora e tudo que vem depois cabem em meio minuto.

## O que ele não enxerga

- **Foi conferido com um temporal só.** Em 18/02/2025 acertou 9 dos 18 pontos
  reportados, contra uns 4 por sorte, e errou os rios que transbordaram (veja
  acima). A camada de áreas sujeitas a inundação da prefeitura, que permitiria
  comparar mancha com mancha, não está hoje na página de downloads do IPPUC.
  Leia o mapa como *por onde a água passa primeiro*, e não como *qual altura
  ela vai ter na sua rua*.
- **As galerias são um número só.** A drenagem debaixo da cidade entra como uma
  taxa de perda, igual em todo lugar.
- **Não entra água de fora.** O Iguaçu recebe só a chuva que cai dentro do
  quadrado de 53 km, não a que cai rio acima.
- **O relevo é de 2000** e inclui prédios e árvores. Obras recentes, como
  bacias de contenção e córregos canalizados, não estão nele.
- **A chuva no espaço é aproximada.** A célula de tempestade é um sino
  gaussiano que anda em linha reta; o temporal de 2025 vem de 14 pluviômetros
  interpolados; a previsão de 48 h, de 16 pontos com chuva por hora, suaviza as
  pancadas curtas. Nada disso é radar.
- **Escolas e ruas são as do OpenStreetMap.** Faltam algumas, e a posição de
  uma escola costuma cair no telhado, por isso o simulador olha a água num raio
  de uma célula em volta.
- **A parte sazonal é um ponto só e não tem correção de viés.** Chuva e
  temperatura vêm da célula sobre o centro de Curitiba, e a previsão veio 42%
  acima no único período que deu para conferir. A passagem da chuva do mês
  para solo e rios usa um método consagrado para o solo (SCS) e uma
  aproximação para os rios.

É uma ferramenta educativa e de exploração. **Não é previsão e não substitui
os alertas da Defesa Civil.** Em caso de chuva forte, ligue 199 e cadastre-se
nos alertas por SMS mandando seu CEP para 40199.

## Meta: relatos de moradores

Hoje o Cheia simula; ele não sabe o que está acontecendo na rua agora. A
próxima meta é deixar quem mora na região contar: *aqui tem água, mais ou
menos esta altura, a esta hora*, com foto opcional. Esses relatos serviriam
para duas coisas:

1. **Mostrar alagamentos acontecendo**, no mapa, junto com o que o modelo
   espera para a chuva daquele momento.
2. **Calibrar o modelo** com muito mais pontos do que os 18 de 2025, o que é
   o caminho para acertar melhor os rios que transbordam.

Isso ainda não existe. Precisa de um servidor para receber os relatos,
moderação e proteção contra relatos falsos, cuidado com a privacidade (LGPD)
e chuva observada ao vivo no lugar da prevista. Acompanhe ou contribua na
[issue do GitHub](https://github.com/zednaked/cheia/issues/1).

## Rodar localmente

```sh
npm install
npm test           # testes do modelo na GPU (Chromium headless)
npm run dev        # http://localhost:5173
npm run data       # baixa de novo do OSM rios, limites, escolas e ruas, e refaz o relevo
npm run bake       # só refaz o relevo (public/data/terreno.bin.gz)
node scripts/fetch-climate.mjs   # refaz os resumos do ERA5 e a foto da previsão
```

A área fica em `src/region.js`, como um bloco de tiles de mapa: outra cidade é
trocar cinco números e rodar `npm run data`. As ruas vêm em 64 pedaços, porque
o Overpass não aguenta a região inteira de uma vez; cada pedaço fica guardado
em `.cache/`, e se o Overpass cair no meio é só rodar de novo. O deploy no GitHub Pages está em
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
