# Cheia

**A flood simulator for Curitiba and its metropolitan area that runs in a
browser tab.** Pick a rainstorm, in mm/h or from Curitiba's own
intensity-duration-frequency curve, and watch the water run down the real
terrain, fill the rivers and spill into the neighbourhoods. A live ranking lists
the neighbourhoods and towns with the most land under water. With a strong El
Niño forming, a second panel puts the next six months of forecast rain and
heat next to what past El Niños did, and turns a month into starting
conditions for the flood.

**[Open it](https://zednaked.github.io/cheia/)** · Nothing to install ·
Interface in Portuguese · [Leia em português](README.pt-BR.md)

```
2.4 million cells of water, one shader pass per step, 5.5 ms a step
81 fps on an integrated laptop GPU, 4 simulated minutes per second
```

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

## The next six months

On 8 October 2026 NOAA's Climate Prediction Center kept its El Niño Advisory:
a strong to very strong event is likely through March 2027, with an 83% chance
that October to December is the strongest since 1950. In southern Brazil a
strong El Niño usually means a wet spring and summer, and people in Curitiba
are asking what that does to their street. So the simulator has a second
question now: *not "what if it rains 80 mm" but "what will the month around
that storm look like".*

![The next-months panel: monthly rain in Curitiba, normal range, the 51-member forecast and the past strong El Niños](docs/cenarios.webp)

Three sources, kept apart on purpose:

- **The forecast:** ECMWF SEAS5, 51 members, six months ahead, daily rain and
  temperature for Curitiba, fetched live from Open-Meteo every time the panel
  opens.
- **Normal:** ERA5 reanalysis for the same point, 1991 to 2020.
- **What strong El Niños actually did:** the October to April months of the
  six since 1982 (1982, 1991, 1997, 2009, 2015, 2023), from ERA5. That is
  measurement, not a model, and it is there to check the forecast against.

What it shows today, 16 October 2026:

```
             normal   forecast median (10-90%)   wet month*   max temp
Oct 2026     130 mm   327 mm  (258-400)            100%         -1.2 °C
Nov 2026     128 mm   234 mm  (160-360)             96%         +0.7 °C
Dec 2026     157 mm   206 mm  (128-325)             71%         +0.5 °C
Jan 2027     227 mm   206 mm  (124-300)             24%         +1.0 °C
Feb 2027     177 mm   159 mm   (72-284)             27%         +1.2 °C
Mar 2027     132 mm   151 mm   (91-241)             53%         +0.7 °C

* share of the 51 members above the wettest third of 1991-2020; 33% in any year
```

**Read the forecast as too wet.** It is not bias-corrected: the API has no
hindcasts to correct it with. Over the 26 days to 10 October, where both exist,
the model gave Curitiba **208 mm** and ERA5 recorded **147 mm**, 42% more. That
is too short a window to build a correction on, so the panel prints it instead.
The past El Niños point the same way with no model involved: October in
Curitiba was above its 1991-2020 median (130 mm) in 5 of the 6, at 157 to
321 mm; the sixth, 1991, had 129 mm.

**From a month to a flood.** A seasonal forecast can't say which day the
storm comes. What it can say is what the ground and the rivers will be like
when it does. Pick a month and a condition (the forecast's median, its wet
tenth, or "like 1997") and the panel sets the simulation:

- **Soil.** The wettest 5 days of that month give the SCS curve-number
  antecedent moisture class (dry under 35.6 mm, wet over 53.3 mm), and the
  infiltration-plus-drains loss scales with the retention of that class: 15
  mm/h normal, 6.5 mm/h saturated.
- **Rivers.** The starting water level scales with the month's rain over its
  normal, from 0.3 to 3 m. This one is a heuristic and the panel says so.
- **Heat.** Short storms get about 7% more intense per degree of warming
  (Clausius-Clapeyron). The design storm from Curitiba's IDF curve is scaled by
  the forecast temperature anomaly.

The same storm (10-year, one hour), read after two simulated hours, area that
passed 30 cm of water:

```
normal month                              138 km²
soil and rivers like November 1997        165 km²   +19%
the forecast's wet tenth for October      177 km²   +29%
```

![The November-1997 scenario at its peak over Curitiba's industrial district; hovering shows 50 cm of water that passed 30 cm at 1h22](docs/cenario-cic.webp)

## What runs in the tab

```
grid           1536 × 1536 cells, 34.5 m each, 53 × 53 km
terrain        SRTM 30 m (AWS Terrain Tiles), 36 tiles,  1.3 MB
imagery        Esri World Imagery, 576 tiles,            9.8 MB
rivers, lakes,
boundaries     OpenStreetMap, pre-fetched,               1.5 MB gzip
               3,041 waterways, 1,302 lakes,
               17 municipalities, 289 neighbourhoods
climate        ERA5 1981-2026 summaries, pre-fetched,     32 KB gzip
               SEAS5 seasonal forecast, live,              ~180 KB
model          local inertial shallow water, one fragment shader per step
```

Everything is client-side: no server, no account, no API key. GitHub Pages
serves the HTML and the OSM file; the terrain and imagery come straight from
their public tile servers.

![The Iguaçu floodplain and the Belém joining it, south-east of the centre, at the peak of the November-1997 scenario, vertical exaggeration 4×](docs/iguacu.webp)

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
- **The seasonal side is one point and not bias-corrected.** Rain and
  temperature come from the grid cell over central Curitiba, and the forecast
  ran 42% wet over the only window I could check. The step from a month's rain
  to soil and river conditions is a standard method for the soil (SCS) and a
  heuristic for the rivers.

This is an educational and exploratory tool. It does not replace the alerts
from the Defesa Civil.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
npm run data       # re-fetch rivers and boundaries from OSM (Overpass)
node scripts/fetch-climate.mjs   # rebuild the ERA5 summaries and the forecast snapshot
```

The area is set in `src/region.js` as a block of web map tiles; another city is
a change of five numbers and `npm run data`. The GitHub Pages deploy is
`.github/workflows/pages.yml`, on every push to `main`.

## Credits

Forecast and reanalysis: ECMWF SEAS5 and ERA5 (Copernicus) via
[Open-Meteo](https://open-meteo.com/). ENSO status: NOAA
[CPC](https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.html).
Terrain: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)
(SRTM, NASA/USGS). Imagery: Esri, Maxar, Earthstar Geographics. Rivers and
boundaries: © [OpenStreetMap](https://www.openstreetmap.org/copyright)
contributors, ODbL. Design storms: the IDF equation for Curitiba by Fendrich.

---

**Em português:** um simulador de enchentes de Curitiba e da RMC que roda no
navegador. Você escolhe a chuva e vê por onde a água desce no relevo real.
**[Abrir o simulador](https://zednaked.github.io/cheia/)** ·
[README completo em português](README.pt-BR.md)

MIT licensed.
