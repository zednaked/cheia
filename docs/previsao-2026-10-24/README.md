# Prediction committed before the rain: 24–26 Oct 2026

Run at 13:48 (BRT) on 24/10/2026 with `node scripts/previsao.mjs`: the next 48 h
of Open-Meteo forecast (16 points, hourly) through the simulator, the same as the
app's "Próximas 48 h" button. Raw forecast in `open-meteo.json`.

**Forecast:** up to 45 mm at the wettest point, 34 mm on average, one hour of
11.3 mm (02:00 on 25/10).

**What the model expects:** none of the 18 spots flooded on 18/02/2025 passes
30 cm. Closest: R. Dr. Luiz Losso Filho (Novo Mundo) at 30 cm, Wenceslau Braz x
Linha Verde (Parolin) at 16 cm, Córrego Henry Ford (Fanny) at 15 cm. For scale, a
2-year storm (52 mm in one hour) puts 7 of the 18 above 30 cm and 1.78 m at
Wenceslau Braz x Linha Verde (`docs/analise.json`).

If a storm cell drops 30–40 mm in an hour, which a 16-point hourly forecast
can't see, this changes. After the rain: compare with what the Defesa Civil and
the press report, then rerun with measured rain.

`resultado.json` (points and neighbourhoods), `pico.png` (one hour after the
forecast peak), `fim.png` (end of the 50 h run).
