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
chuva de 2 anos (a de todo verão): 1,78 m na Wenceslau Braz x Linha Verde
```

**Nesta página:** [o que a simulação encontrou](#o-que-a-simulação-encontrou) ·
[o que dá para fazer](#o-que-dá-para-fazer) ·
[conferido com um temporal de verdade](#conferido-com-um-temporal-de-verdade) ·
[próximos seis meses](#os-próximos-seis-meses) · [métodos](#métodos) ·
[o que ele não enxerga](#o-que-ele-não-enxerga)

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

## O que a simulação encontrou

Rodei as chuvas de projeto de Curitiba (2, 10 e 100 anos de retorno em uma
hora, e 25 anos em três horas) sobre a região inteira e medi três coisas: a
água nos 18 pontos que alagaram de verdade em 18/02/2025, a fração de cada
bairro que passou de 30 cm, e quais escolas, creches, unidades de saúde e ruas
ficaram com água perigosa. Como foi feito está em [Métodos](#métodos); os
números completos, em [`docs/analise.json`](docs/analise.json).

**1. O Parolin, o Fanny e o Novo Mundo alagam até com a chuva de todo verão.**
Uma chuva de 2 anos de retorno (52 mm em uma hora) já põe 1,78 m de água no
cruzamento da Wenceslau Braz com a Linha Verde, 1,39 m no Córrego Henry Ford
e 1,27 m na Rua Dr. Luiz Losso Filho, onde a água passa de 30 cm em 5 minutos.
Nos três, a correnteza já é perigosa para qualquer pessoa. São fundos de vale
para onde corre a água de vários bairros.

![Chuva de 2 anos sobre o Parolin e o Fanny, uma hora e meia depois: a Linha Verde e o Córrego Henry Ford em vermelho, perigosos para pessoas](docs/chuva-comum.webp)

**2. O pior vem depois que a chuva para.** Nos vales maiores, o pico chega de
30 minutos a quase 2 horas depois do começo da chuva, quando a água da bacia
inteira chega ao rio. No Boqueirão (Carlos Essenfelder x Cleto da Silva) a
água só passa de 30 cm 1h53 depois, numa chuva de 100 anos.

**3. Intensidade pesa mais que volume.** A chuva de 25 anos em três horas
(mais água no total) deu menos água em quase todos os pontos do que a de 10
anos em uma hora. Em Curitiba, o perigo é a pancada curta e forte.

**4. Seis dos 18 pontos reportados ficam secos em qualquer chuva.** Sítio
Cercado (2), CIC (2), Fazendinha e Campo Comprido não passam de 5 cm nem na
chuva de 100 anos, e o Centro (Visconde de Nácar) não passa de 12 cm. Esses
alagamentos são de drenagem: boca de lobo entupida, galeria pequena, rua plana
sem saída. Um relevo de 30 m não enxerga isso, e o modelo não deve ser usado
para dizer que esses lugares são seguros.

**5. Os bairros com a maior parte da área alagada ficam fora de Curitiba.** Na
chuva de 10 anos, Alto Tarumã (15%), Parque das Águas (14%) e Jardim Claudia
(11%), em Pinhais, Agaraú (14%), em São José dos Pinhais, e Guaraituba (13%),
em Colombo, estão nas várzeas do Iraí, do Palmital, do Atuba e do alto Iguaçu.
Em Curitiba, os primeiros são Alto da Rua XV, Augusta, Hugo Lange e Santo
Inácio (8 a 10%); em parte é várzea e parque do Belém e do Barigui, feitos
para encher.

### Os 18 pontos de 18/02/2025, em quatro chuvas

Pico da lâmina num quadrado de 3 × 3 células (uns 100 m) em volta do ponto;
entre parênteses, quanto tempo depois do início da chuva passou de 30 cm; H é a
classe de perigo no pico.

```
                                         2 anos, 1 h       10 anos, 1 h      25 anos, 3 h      100 anos, 1 h
Parolin     Wenceslau Braz x Linha Verde 1,78 m (36′) H5   2,32 m (31′) H5   2,12 m (63′) H5   3,14 m (21′) H6
Fanny       Córrego Henry Ford           1,39 m (31′) H4   1,82 m (26′) H5   1,32 m (47′) H4   2,44 m (21′) H5
Novo Mundo  Dr. Luiz Losso Filho         1,27 m  (5′) H4   1,68 m  (5′) H4   1,36 m (16′) H4   2,31 m  (5′) H5
Parolin     Prof. Porthos Velozo         58 cm  (72′) H3   78 cm  (57′) H4   61 cm (105′) H3   1,06 m (42′) H5
Rebouças    Alferes Poli x A. Gonçalves  52 cm  (51′) H3   69 cm  (42′) H3   62 cm  (74′) H3   1,03 m (32′) H3
Novo Mundo  Arnaldo Rudnick              31 cm  (93′) H2   68 cm  (62′) H3   38 cm (135′) H2   1,30 m (47′) H4
Bom Retiro  Ângelo Zeni x Carlos Pioli   31 cm  (51′) H2   41 cm  (42′) H4   24 cm        H1   65 cm  (32′) H5
Uberaba     José Hauer x Salgado Filho   25 cm        H1   33 cm  (57′) H2   26 cm        H1   46 cm  (37′) H2
Boqueirão   Carlos Essenfelder x Cleto   11 cm        H1   13 cm        H1    8 cm        H1   1,16 m (113′) H3
Parolin     Brigadeiro Franco             2 cm        H0    3 cm        H0    2 cm        H0   33 cm  (68′) H2
Centro      Visconde de Nácar x Saldanha  8 cm        H1   10 cm        H1    6 cm        H1   12 cm        H1
Boqueirão   Aristóteles da Silva Santos   2 cm        H0    2 cm        H0    2 cm        H0    3 cm        H0
CIC         Parque Mané Garrincha         3 cm        H0    4 cm        H0    3 cm        H0    5 cm        H1
CIC, Sítio Cercado (2), Fazendinha,
Campo Comprido                           até 3 cm em todas as chuvas

H1 raso · H2 arrasta carro pequeno · H3 perigoso para criança e idoso · H4 para qualquer pessoa
H5 construções leves sofrem · H6 qualquer construção pode ceder
```

### Onde a água chega primeiro a quem mais precisa

Para ordenar os bairros por relevância social, contei, na chuva de 10 anos, os
serviços essenciais com mais de 30 cm de água na porta, com peso pelo quanto a
população depende deles numa emergência (hospital e asilo 5, unidade de saúde
e creche 3, escola e bombeiros 2, polícia 1), e somei os quilômetros de rua
onde a água passa a arrastar carro (H2 ou mais). É uma régua simples e
explícita, não um índice oficial; falta, por exemplo, a renda e a densidade de
moradores, que ainda não estão no simulador.

```
    bairro                        o que fica com mais de 30 cm na porta                  ruas H2+
 1  CIC                           UPA CIC, US Taiz Viviane Machado, 2 escolas            21 km
 2  Boqueirão                     4 unidades de saúde (US Irmã Tereza Araújo, CAPS,      7 km
                                  US Tapajós, UPA Boqueirão), 4 escolas, PM
 3  Cajuru                        EM Senador Enéas Faria (1,57 m)                       15 km
 4  Eucaliptos (Faz. Rio Grande)  US Hortência, EM Alcides Pelanda, CE Lucy Requião     9 km
                                  (todos com cerca de 1 m)
 5  Xaxim                         EM Jardim Europa (1,25 m), US Esmeralda, US São Pedro  5 km
 6  Guaraituba (Colombo)          EM Angelo Falavinha Dalprá (1,03 m), CMEI Tia Itamara  7 km
 7  Centro                        Colégio Estadual do Paraná (1,25 m), 3 escolas         1 km
 8  Palmital (Colombo)            CMEI Generosa Simões (1,45 m), 2 escolas               5 km
 9  Sítio Cercado                 EM e CMEI Parigot de Souza (1,30 m), EM José Cavallin  5 km
10  Uberaba                       CE Conselheiro Carrão, EM Michel Khury                 8 km
```

A posição de cada escola e unidade de saúde vem do OpenStreetMap e o relevo
tem células de 34 m: leia "a água chega à quadra dessa escola", não "entra na
sala de aula".

### Vídeos

Gravados no próprio simulador, com a cor por perigo. Em ordem de prioridade
social, chuva de 10 anos:
[1 CIC](https://github.com/zednaked/cheia/raw/main/docs/videos/prioridade/01-cic.mp4) ·
[2 Boqueirão](https://github.com/zednaked/cheia/raw/main/docs/videos/prioridade/02-boqueirao.mp4) ·
[3 Cajuru](https://github.com/zednaked/cheia/raw/main/docs/videos/prioridade/03-cajuru.mp4) ·
[4 Eucaliptos, Fazenda Rio Grande](https://github.com/zednaked/cheia/raw/main/docs/videos/prioridade/04-eucaliptos-fazenda-rio-grande.mp4) ·
[5 Xaxim](https://github.com/zednaked/cheia/raw/main/docs/videos/prioridade/05-xaxim.mp4) ·
[6 Guaraituba, Colombo](https://github.com/zednaked/cheia/raw/main/docs/videos/prioridade/06-guaraituba-colombo.mp4) ·
[7 Centro](https://github.com/zednaked/cheia/raw/main/docs/videos/prioridade/07-centro.mp4) ·
[8 Palmital, Colombo](https://github.com/zednaked/cheia/raw/main/docs/videos/prioridade/08-palmital-colombo.mp4)

Pontos críticos:
[Parolin e Fanny numa chuva de 2 anos](https://github.com/zednaked/cheia/raw/main/docs/videos/parolin-fanny-chuva-comum.mp4) ·
[Novo Mundo, 10 anos](https://github.com/zednaked/cheia/raw/main/docs/videos/novo-mundo-temporal.mp4) ·
[Rebouças, 10 anos](https://github.com/zednaked/cheia/raw/main/docs/videos/reboucas-temporal.mp4) ·
[Pinhais, 10 anos](https://github.com/zednaked/cheia/raw/main/docs/videos/pinhais-temporal.mp4) ·
[Boqueirão, 100 anos](https://github.com/zednaked/cheia/raw/main/docs/videos/boqueirao-extrema.mp4)

A cidade e os eventos:
[chuva extrema no Parolin](https://github.com/zednaked/cheia/raw/main/docs/videos/extrema-perigo-parolin.mp4) ·
[temporal de 18/02/2025 no Portão](https://github.com/zednaked/cheia/raw/main/docs/videos/evento-18-fev-2025.mp4) ·
[temporal de 10 anos, a cidade toda](https://github.com/zednaked/cheia/raw/main/docs/videos/temporal-10-anos.mp4) ·
[célula de tempestade sobre o centro](https://github.com/zednaked/cheia/raw/main/docs/videos/celula-tempestade-centro.mp4)

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

## Métodos

### Dados

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

### Hidráulica

A hidráulica é a formulação inercial local de Bates et al. (2010), a mesma
que está dentro do LISFLOOD-FP, que é o que os pesquisadores de inundação usam
de fato. Profundidade da água em cada célula, vazão em cada face, atrito de
Manning, passo de tempo que se ajusta à água mais funda (CFL), bordas abertas.
A cada passo entra a chuva menos uma perda (infiltração mais galerias, em
mm/h). A chuva é a soma de três partes: uma taxa uniforme, um mapa de chuva em
grade grossa (pluviômetros, previsão) e uma célula de tempestade gaussiana que
anda. A velocidade em cada célula sai das vazões das faces, e com ela a classe
de perigo.

### Preparação do relevo

Rios do OSM gravados no relevo com cota que só desce (até 10 m de corte);
represas falsas do SRTM abertas até 5 m e o resto preenchido com inclinação
mínima (priority-flood, Barnes et al. 2014); antes de cada simulação, os rios
assentam por duas horas sem chuva, e o que já estava molhado no começo não
conta como alagamento. Os detalhes e o porquê estão em [Cinco
coisas](#cinco-coisas-que-precisei-consertar-antes-de-a-água-ir-para-onde-a-água-vai).

### Chuva

- **Chuvas de projeto:** equação IDF de Curitiba (Fendrich), intensidade
  constante durante a duração escolhida, igual na região inteira.
- **Perda:** infiltração mais galerias, uma taxa em mm/h descontada da chuva
  em cada célula.
- **Evento de 2025:** 14 pluviômetros, inverso do quadrado da distância numa
  grade de 32 × 32, distribuídos no tempo em blocos de 15 minutos pelo
  hietograma do Simepar.
- **Previsão de 48 h:** Open-Meteo, 16 pontos (4 × 4) com chuva por hora,
  interpolados do mesmo jeito.
- **Célula de tempestade:** sino gaussiano com raio, velocidade e direção
  escolhidos.

### Perigo e exposição

- **Classe de perigo:** ARR 2019 (Austrália), de H1 a H6, pela profundidade,
  pela velocidade e pelo produto das duas; guarda-se a maior classe de cada
  célula ao longo da simulação.
- **Alagado:** passou de 30 cm em algum momento, fora da calha dos rios e dos
  lagos e fora do que já estava molhado antes da chuva.
- **Lugares:** 1.716 escolas, creches, unidades de saúde, hospitais, asilos,
  bombeiros e polícia do OSM; conta se o pico passou de 30 cm em alguma das
  9 células em volta (o ponto do OSM costuma cair no telhado).
- **Ruas:** a malha viária do OSM (51.129 vias) vira metros de rua por célula
  no build; somam-se as células alagadas e as de perigo H2 ou mais.

### Análise dos pontos e dos bairros

[`scripts/analise-pontos.mjs`](scripts/analise-pontos.mjs) abre o simulador
num Chromium sem tela, na GPU, e roda quatro chuvas (2, 10 e 100 anos em uma
hora, 25 anos em três horas), cada uma até duas horas depois de a chuva parar.
A cada 5 minutos simulados lê a lâmina nos 18 pontos de 2025 (máximo num
quadrado de 3 × 3 células, fora do que já estava molhado). No fim, soma por
bairro a área que passou de 30 cm, os km de rua e os lugares atingidos, e
calcula a prioridade social descrita acima. Bairros com menos de 0,5 km²
dentro da grade ficam de fora da fração. O município de cada bairro é o que
contém o centroide do seu polígono. Rodar de novo:

```sh
node scripts/analise-pontos.mjs   # sobe o próprio servidor; ~6 min, grava docs/analise.json
```

### Validação

Descrita em [Conferido com um temporal de
verdade](#conferido-com-um-temporal-de-verdade): 18 pontos, quadrado de 9 × 9
células, 20 cm, comparado com o acaso.

### Testes

Os testes (`npm test`) rodam o modelo na GPU, num Chromium headless, em
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
npm run analise    # roda as quatro chuvas e refaz docs/analise.json (~6 min, GPU)
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
