# Cheia

**A flood simulator for Curitiba and its metropolitan area that runs in a
browser tab.** Pick a rainstorm, in mm/h or from Curitiba's own
intensity-duration-frequency curve, and watch the water run down the real
terrain, fill the rivers and spill into the neighbourhoods. A live ranking lists
the neighbourhoods and towns with the most land under water, and how many
schools, hospitals and kilometres of street the water reached. Search for your
street and it tells you at what time the water passes 30 cm there. Drop a storm
cell on a neighbourhood, replay the storm of 18 February 2025 from the rain
gauges, or run the next 48 hours of forecast. With a strong El Niño forming, a
panel puts the next six months of forecast rain and heat next to what past El
Niños did.

**[Open it](https://zednaked.github.io/cheia/)** · Nothing to install ·
Interface in Portuguese · [Leia em português](README.pt-BR.md)

```
2.4 million cells of water, one shader pass per step, 5.9 ms a step
81 fps on an integrated laptop GPU, 4 simulated minutes per second
storm of 18 Feb 2025: the model flooded 9 of the 18 reported spots
                      (by chance, with the same yardstick, about 4)
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

## What you can do

- **Find your street.** Search finds neighbourhoods, schools and hospitals
  offline, and addresses through OpenStreetMap. The pin shows when the water
  passed 30 cm there, the peak, the hazard and a chart of the depth over time.
  On a phone, tap the map.
- **Send the link.** The page address holds the rain, the camera and the pin:
  whoever opens it sees the same thing, already running. You can also save an
  image or record a video of the map, with clock and legend.
- **Pick the rain.** Free intensity and duration, or Curitiba's design storms,
  from the every-summer storm (2-year) to the three-day Iguaçu flood (100-year).
  Over the whole region, or as a **storm cell** a few kilometres wide that you
  drop with a click and the wind carries, which is how summer rain falls in
  Curitiba.
- **Replay 18 Feb 2025.** The rain measured at 14 Civil Defence gauges,
  interpolated over the city, with the 18 floods reported that day pinned on
  the map: green if the model flooded the spot, red if not.
- **Run the next 48 hours.** Hourly forecast rain from Open-Meteo at 16 points
  over the region.
- **See hazard, not just depth.** The water can be coloured by the hazard class
  of the Australian ARR 2019 guideline, which combines depth and velocity:
  where water sweeps away a small car, a child, an adult. White streaks show
  the current.
- **Count what matters.** How many schools and day-care centres, hospitals and
  clinics, fire and police stations the water reached, how many kilometres of
  street passed 30 cm and how many became unsafe for cars. A 10-year,
  one-hour storm, two hours in: 503 km of street above 30 cm (66 km of them
  main roads), 519 km unsafe for cars, 90 schools and day-care centres and
  48 health sites with water at the door.

![Hazard colouring in a 100-year storm over Parolin and Guaíra: yellow is shallow, orange sweeps a small car, wine is unsafe for anyone; the white streaks are the current](docs/perigo.webp)

<img src="docs/celular.webp" alt="On a phone: the pin on Rua Alferes Poli, Rebouças, shows the water passed 30 cm after 27 minutes and reached 1.03 m" width="300">

## Checked against a real storm

On Tuesday 18 February 2025 a heavy storm hit Curitiba between late morning and
3 pm: 22.8 mm in 15 minutes around noon (Simepar), 69 mm at Portão, almost
nothing in the far south. The Civil Defence listed the day's flooding spots.
It is the best case I found: an official street-level list, 14 rain gauges the
same day, and a short intense storm, which is what this model exists to show.

**Replay 18/02/2025** does this:

- **Rain in space.** The day totals at the 14 Civil Defence gauges, inverse
  distance squared onto a 32 × 32 grid. Each gauge sits at the centre of the
  neighbourhood it is named after.
- **Rain in time.** 15-minute blocks from 11:30, peaking at noon: 34.6 mm by
  12:15 and 22.8 mm in the heaviest 15 minutes, per Simepar.
- **The spots.** The 15 on the Civil Defence list (as reprinted by Bem Paraná)
  and 3 from Banda B, geocoded with OpenStreetMap.

**The yardstick:** a spot counts as flooded if the model passed 20 cm
somewhere in a 9 × 9 cell box around it (about 310 m across), outside the river
channel. It is loose on purpose: the spot
positions and 30 m terrain don't support anything tighter. So the panel also
says what chance alone would score: with the same yardstick, 22% of urban
points flooded, about 4 of 18.

**The result: 9 of 18.** Hits are where water gathers in urban stream valleys
(Parolin, Novo Mundo, Fanny, Rebouças, Uberaba). Misses are where a river
overflowed with water from far upstream: in the centre the Bigorrilho stream
rose 2.29 m, in Boqueirão the Belém left its channel. How a river fills depends
on rain upstream and on how the real channel drains, and a channel burned from
OSM into 30 m terrain doesn't know that. It also misses in the south, at Sítio
Cercado, where the nearby gauges read 5 to 37 mm and the interpolation pulled
the rain down.

![The 18 Feb 2025 storm replayed: green pins where the model flooded the reported spot, red where it didn't](docs/validacao.webp)

One storm, a loose yardstick and points from the news. Much better than
chance, and far from a real validation, which needs an official flood-prone
area layer to compare outline with outline.

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
                                          18 Oct 2026     16 Oct 2026
normal month                              127 km²         138 km²
soil and rivers like November 1997        140 km²  +10%   165 km²  +19%
the forecast's wet tenth for October      127 km²   0%    177 km²  +29%
```

The 16 October column is the one I first published, and it was inflated: the
fuller river already spilled into the floodplain at the start, and that counted
as flooding (see "The rivers started out overflowing", below). With the fix, a
November-1997 soil and river still add 10% of flooded area. October's wet tenth
comes out the same as normal: October is forecast 1.2 °C cooler than normal,
which makes the storm 8% weaker and cancels the soaked soil. In the first
version, what made the difference there was the 2.1 m river spilling at the
start.

![The November-1997 scenario at its peak over Curitiba's industrial district; hovering shows 50 cm of water that passed 30 cm at 1h22](docs/cenario-cic.webp)

## What runs in the tab

```
grid           1536 × 1536 cells, 34.5 m each, 53 × 53 km
terrain        SRTM 30 m (AWS Terrain Tiles), rivers
               burned and pits treated at build time,   2.8 MB gzip
imagery        Esri World Imagery, 576 tiles,            9.8 MB
rivers, lakes,
boundaries     OpenStreetMap, pre-fetched,               1.5 MB gzip
               3,041 waterways, 1,302 lakes,
               17 municipalities, 289 neighbourhoods,
               1,716 schools, health and emergency sites
streets        OSM road network, 51,129 ways, 13,640 km,
               summarised per cell inside the terrain file
climate        ERA5 1981-2026 summaries, pre-fetched,     32 KB gzip
               SEAS5 seasonal forecast, live,              ~180 KB
model          local inertial shallow water, one fragment shader per step
```

Everything is client-side: no server, no account, no API key. GitHub Pages
serves the HTML, the prepared terrain and the OSM file; the imagery comes
straight from its public tile server and is kept by a service worker, so a
second visit opens without downloading it again.

![The Iguaçu floodplain and the Belém joining it, south-east of the centre, at the peak of the November-1997 scenario, vertical exaggeration 4×](docs/iguacu.webp)

**The hydraulics** are the local inertial formulation of Bates et al. (2010),
the one inside LISFLOOD-FP, which is what flood researchers actually use for
this. Water depth per cell, discharge per cell face, Manning friction, a
time step that adapts to the deepest water (CFL), open boundaries. Rain minus a
loss rate (infiltration plus storm drains, in mm/h) is added every step. Rain is
the sum of three parts: a uniform rate, a coarse rain map (gauges, forecast)
and a moving Gaussian storm cell. Velocity per cell comes from the face
discharges, and the hazard class from depth and velocity.

**The tests** (`npm test`) run the model on the GPU in headless Chromium, on
small hand-made grids: all the water rained into a closed bowl must be there at
the end (error under 0.01%), a still lake must stay still, depth never goes
negative or NaN on rough terrain under heavy rain, and in a sloping channel the
steady velocity matches Manning's (0.368 against 0.359 m/s).

## Five things that had to be fixed before the water went where water goes

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

**The rivers started out overflowing.** Every run began with water in the
channels up to the chosen level. But a channel burned into the terrain is one
or two cells wide, and in many places the floodplain next to it is lower than
the water inside. With no rain at all, after two hours more than 10 km² already
counted as flooded, with 38 schools and clinics. Now the starting water stops at
the bank (the lowest non-channel cell nearby), the rivers settle for two hours
without rain before the clock starts, and whatever was already wet at the
start doesn't count as flooding. With zero rain and rivers at 1.5 m, about
3 km² remain after four hours, river water still seeping into the floodplain.
This changed numbers I had already published: the El Niño scenarios move the
result much less than I said (see above), because part of the difference was
the fuller river spilling at the start.

**Neighbouring neighbourhoods swapped names.** The map of which cell belongs to
which neighbourhood was drawn on a canvas, each neighbourhood in a code colour.
The canvas antialiases edges, and one neighbourhood's colour blended with its
neighbour's gave a third one's: a point in Parolin showed up as Orleans, across
town. Polygons are now filled by scanline, cell by cell, with no smoothing.

**The first render ran at 22 fps with the simulation stopped.** On the AMD
Renoir integrated GPU I built this on, the whole region on screen meant 2.4
million triangles, most smaller than a pixel. Splitting the terrain into 144
blocks with four levels of detail (and skirts so the seams don't show) took
it to **81 fps**. The simulation step went from 14 ms to **5.5 ms** by packing
depth, both face discharges and the bed into one RGBA32F texture, so each step
is one pass that reads 5 texels per cell instead of two passes reading about 11
(5.9 ms now, with rain that varies in space and the hazard class).
On that GPU the model advances **about 4 simulated minutes per second**: a
one-hour storm plus its aftermath takes half a minute to watch.

## What it can't see

- **It was checked against one storm.** On 18 Feb 2025 it hit 9 of the 18
  reported spots, against about 4 by chance, and missed the rivers that
  overflowed (see above). The city's flood-prone-area layer, which would allow
  comparing outline with outline, is not on IPPUC's download page today. Read
  the map as *where water goes first*, not *how deep it will get on your
  street*.
- **Storm drains are one number.** The galleries under the city are modelled as
  a loss rate, the same everywhere.
- **No water comes in from outside.** The Iguaçu receives the rain that falls
  inside the 53 km square, not what falls upstream of it.
- **The terrain is from 2000** and includes buildings and trees. Recent works,
  like detention basins and channelled streams, are not in it.
- **Rain in space is approximate.** The storm cell is a Gaussian bell moving in
  a straight line; the 2025 storm comes from 14 interpolated gauges; the 48-hour
  forecast, from 16 points of hourly rain, smooths out short bursts. None of
  it is radar.
- **Schools and streets are OpenStreetMap's.** Some are missing, and a
  school's point often lands on a roof, so the model looks at the water within
  one cell around it.
- **The seasonal side is one point and not bias-corrected.** Rain and
  temperature come from the grid cell over central Curitiba, and the forecast
  ran 42% wet over the only window I could check. The step from a month's rain
  to soil and river conditions is a standard method for the soil (SCS) and a
  heuristic for the rivers.

This is an educational and exploratory tool. It does not replace the alerts
from the Defesa Civil.

## Goal: reports from residents

Today Cheia simulates; it doesn't know what is happening on the street right
now. The next goal is to let people who live there report it: *there is water
here, about this deep, at this time*, with an optional photo. Those reports
would do two things:

1. **Show floods as they happen**, on the map, next to what the model expects
   from the rain at that moment.
2. **Calibrate the model** with far more points than the 18 from 2025, which
   is the way to get the overflowing rivers right.

None of this exists yet. It needs a server to receive reports, moderation and
protection against false ones, care with privacy (Brazil's LGPD) and observed
rain fed in live instead of forecast rain. Follow or help in the
[GitHub issue](https://github.com/zednaked/cheia/issues/1).

## Run it

```sh
npm install
npm test           # model tests on the GPU (headless Chromium)
npm run dev        # http://localhost:5173
npm run data       # re-fetch rivers, boundaries, schools and streets from OSM, rebuild the terrain
npm run bake       # rebuild only the terrain (public/data/terreno.bin.gz)
node scripts/fetch-climate.mjs   # rebuild the ERA5 summaries and the forecast snapshot
```

The area is set in `src/region.js` as a block of web map tiles; another city is
a change of five numbers and `npm run data`. Streets come in 64 pieces because
Overpass can't take the whole region at once; each piece is kept in `.cache/`,
so if Overpass fails halfway, run it again. The GitHub Pages deploy is
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
