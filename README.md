# Cheia

**A flood simulator for Curitiba and its metropolitan area that runs in a
browser tab.** Pick a rainstorm, in mm/h or from Curitiba's own
intensity-duration-frequency curve, and watch the water run down the real
terrain, fill the rivers and spill into the neighbourhoods. A live ranking lists
the neighbourhoods and towns with the most land under water.

**[Open it](https://zednaked.github.io/cheia/)** · Interface in Portuguese ·
[Em português](#em-português)

![A 100-year, one-hour storm over Curitiba, two simulated hours](docs/cheia.webp)

*A 100-year storm (98 mm in one hour), two simulated hours, recorded from the
browser. Light blue is a few centimetres, purple is two metres and more.*

I went looking for what already existed for Curitiba before writing any of
this. Google's Flood Hub forecasts slow river floods and says plainly that it
does not cover flash floods in large cities, which is what Curitiba gets. The
state's drainage master plan has flood lines per river, as PDFs from 2002.
Researchers have mapped flood risk for single basins. Nothing let you ask
*"what if it rains 80 mm in an hour, where does the water go?"* and see the
answer on the map.

![The interface at the peak of the flood: rain controls, the 3D map and the ranking of affected neighbourhoods](docs/screenshot.webp)

## What runs in the tab

```
grid           1536 × 1536 cells, 34.5 m each, 53 × 53 km
terrain        SRTM 30 m (AWS Terrain Tiles), 36 tiles,  1.3 MB
imagery        Esri World Imagery, 576 tiles,            9.8 MB
rivers, lakes,
boundaries     OpenStreetMap, pre-fetched,               1.5 MB gzip
               3,041 waterways, 1,302 lakes,
               17 municipalities, 289 neighbourhoods
model          local inertial shallow water, one fragment shader per step
```

Everything is client-side: no server, no account, no API key. GitHub Pages
serves the HTML and the OSM file; the terrain and imagery come straight from
their public tile servers.

**The hydraulics** are the local inertial formulation of Bates et al. (2010),
the one inside LISFLOOD-FP, which is what flood researchers actually use for
this. Water depth per cell, discharge per cell face, Manning friction, a
time step that adapts to the deepest water (CFL), open boundaries. Rain minus a
loss rate (infiltration plus storm drains, in mm/h) is added every step.

## Three things that had to be fixed before the water went where water goes

**SRTM measures the top of things.** It is a surface model from 2000: a strip
of forest or a road embankment across a valley reads as a dam, and the rain
pools behind it. With only shallow pits (under 3 m) filled, **182 km² of the
grid still sat in closed depressions** deeper than 30 cm, almost all of them
strung along valleys. The fix, in order: cut a way through each false dam, up
to 5 m deep, then fill whatever is left with a minimum slope so flats drain
(priority-flood, Barnes et al. 2014). Filling alone over-floods: on the same
10-year storm, at about 1h45, fill-only flagged 170 km² as having passed 30 cm
and breach-then-fill flagged 137 km². Neither number has been checked against
an observed flood (see below).

**Rivers have to be told which way is downhill.** At 34 m per cell, bridges,
noise and canopy break the channels into ponds. OSM draws every waterway in
the direction of the current, so each one is burned into the terrain with an
elevation that can only go down along the line, capped at 10 m of cut.

**The first render ran at 22 fps with the simulation stopped.** On the AMD
Renoir integrated GPU I built this on, the whole region on screen meant 2.4
million triangles, most smaller than a pixel. Splitting the terrain into 144
blocks with four levels of detail (and skirts so the seams don't show) took
it to **81 fps**. The simulation step went from 14 ms to **5.5 ms** by packing
depth, both face discharges and the bed into one RGBA32F texture, so each step
is one pass that reads 5 texels per cell instead of two passes reading about 11.
On that GPU the model advances **about 4 simulated minutes per second**: a
one-hour storm plus its aftermath takes half a minute to watch.

## What it can't see

- **It is not validated.** I have not compared it with an observed flood. The
  city's flood-prone-area layer that papers cite is not on IPPUC's download
  page today. Read the map as *where water goes first*, not *how deep it will
  get on your street*.
- **Storm drains are one number.** The galleries under the city are modelled as
  a loss rate, the same everywhere.
- **No water comes in from outside.** The Iguaçu receives the rain that falls
  inside the 53 km square, not what falls upstream of it.
- **The terrain is from 2000** and includes buildings and trees. Recent works,
  like detention basins and channelled streams, are not in it.
- **Uniform rain.** The whole area gets the same storm at the same time. Real
  summer storms in Curitiba are a few kilometres wide.

This is an educational and exploratory tool. It does not replace the alerts
from the Defesa Civil.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm run data       # re-fetch rivers and boundaries from OSM (Overpass)
```

The area is set in `src/region.js` as a block of web map tiles; another city is
a change of five numbers and `npm run data`. The GitHub Pages deploy is
`.github/workflows/pages.yml`, on every push to `main`.

## Credits

Terrain: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)
(SRTM, NASA/USGS). Imagery: Esri, Maxar, Earthstar Geographics. Rivers and
boundaries: © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors, ODbL. Design storms: the IDF equation for Curitiba by Fendrich.

---

## Em português

**Simulador de enchentes de Curitiba e Região Metropolitana que roda no
navegador.** Você escolhe uma chuva (mm/h e duração, ou um cenário da curva IDF
de Curitiba) e vê a água descer pelo relevo real, encher os rios e transbordar.
Um ranking mostra os bairros e municípios com mais área alagada.

**[Abrir o simulador](https://zednaked.github.io/cheia/)**

- Relevo SRTM de 30 m, imagem de satélite, rios e bairros do OpenStreetMap.
- Modelo hidráulico inercial local (o mesmo do LISFLOOD-FP), rodando na GPU.
- Passe o mouse para ver bairro, altitude, lâmina d'água agora e no pico, e a
  hora em que a água passou de 30 cm.
- "Pico da cheia" mostra a mancha máxima da simulação inteira.

**Não é previsão e não foi validado contra uma enchente observada.** Serve para
entender por onde a água escoa e onde ela se acumula primeiro. Em caso de
chuva forte, siga a Defesa Civil (199) e os alertas por SMS (40199).

MIT licensed.
