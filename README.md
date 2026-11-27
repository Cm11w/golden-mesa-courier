# Golden Mesa Courier

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057/Cm11w/golden-mesa-courier/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057/Cm11w/golden-mesa-courier/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

A golden-hour mail run through a desert canyon. Fly jet **N427GM —
GOLDEN MESA** through twelve glowing gates across three named legs, drop
the mail on the painted ground targets, fight the crosswind, watch the
fuel and the hull, and land her gently on the home strip for a grade.

**Bounty:** [Make the best flight game — make.fun](https://make.fun/c/best-flight-game-20261126-0057)

## How to fly

Open `game/index.html` in desktop Chrome (no network needed — Three.js is
vendored under `game/vendor/`). The title screen comes up first — press
**ENTER** (or click) to fly.

- **W / S** — throttle up / down
- **← →** — roll (bank to turn)
- **↑ ↓** — pitch
- **SPACE** — airmail drop: release the mail over a painted ground target
- **SHIFT** — afterburner: +35% speed at 3× fuel burn (flames grow, A/B lights up)
- **Drag mouse** — look around
- **G** — gear up / down · **R** — fly again after landing or a crash
- **ENTER / click** — fly again from the results screen

The first ten seconds show the controls on screen; the first two gates
are wider and leg 1 forgives a low skim, so the opening half-minute
teaches instead of punishing. An arrow at the screen edge points at the
next gate whenever it is out of view.

## The sortie

| Leg | Name | Gates | What changes |
|-----|------|-------|--------------|
| 1 | Canyon Run | 4 | Calm air, learn the rings |
| 2 | River Bend | 4 | Crosswind 8 kt pushes the plane |
| 3 | Mesa Gates | 4 | Crosswind 16 kt, fuel running low |

Thread a ring to score and top up fuel (+2%) and time (+8 s). Cargo grows
with every leg — 24 kg, then 60 kg, then 144 kg. **Airmail drops:** each
leg has painted drop targets on the ground (Canyon Post, River Post, Bend
Post, Mesa Post) — press SPACE over one to release a parcel. Dead centre
(< 8 m) pays **+500**, on the mark (< 15 m) **+300**, on the edge (< 25 m)
**+150**; a parcel lost in the sand pays nothing. Clear all twelve gates
and land on the runway: **PERFECT**, **GOOD** or **HARD**, by how gently
and how centred you touch down — plus a landing bonus and your personal
best on the results screen. **Hull:** a ground strike costs 25 hull and
a hard landing 15–30; at 0 hull the jet is lost (**HULL BREACH**). Hit the
terrain four times, or run dry, and the canyon keeps the mail.

## What you see

- Three jets to pick, all with twin afterburners: **INTERCEPTOR** (big
  delta wing, canards, fastest), **STRIKE** (swept wing, balanced),
  **HAULER** (wide wing, twin fins, cargo pod) — each in six liveries
  plus a custom colour. Slim pointed fuselage with red cheatline and
  "GOLDEN MESA / N427GM" livery, glass canopy, landing gear, red/green
  navigation lights, orange afterburner flames that grow on SHIFT.
- A golden-hour canyon: layered mesas, a wide turquoise river with sandy
  banks, saguaro cacti, cottonwoods, rocks, distant peaks, clouds and a
  low sun that rides ahead of the plane in every shot. Leg 2 brings low
  mist over the river, leg 3 a lower, redder sun; a hot-air balloon and a
  fire-watch tower stand far off the course.
- A home strip with painted markings, edge lights, a windsock and a tower.
- A full panel: altitude, speed and heading, score, rings, airmail drops,
  time and cargo up top; airspeed, attitude and altimeter dials, throttle
  and fuel below. New in round 4: a **HULL** bar (green/amber/red), an
  **objective panel** (next gate + distance in NM), a live **radar
  mini-map** (jet, next gate, next drop, runway), a bottom **data bar**
  (SPD · ALT · AGL · V/S · G-load · throttle + A/B), and an afterburner
  badge on the throttle.
- Synthesised engine hum, wind, ring chimes, warnings and a landing
  fanfare — no audio files. The engine roar rises on afterburner.

## Screenshots

Four staged shots, each a repeatable render of the real rules being
played with a fixed seed (`game/index.html?shot=menu|leg1|leg2|results&seed=1`):

1. Main menu — pick your jet (INTERCEPTOR / STRIKE / HAULER) and livery
2. Leg 1 canyon run, afterburner lit, radar + new HUD live
3. Leg 2 along the river, airmail parcel dead centre on River Post (+500)
4. Results — PERFECT landing, 12/12 gates, final score

## Build

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to `/output` and writes `/output/dossier.json` via the
kit's `vendor/makefun-game.ts`. Running it twice writes identical bytes.

```
node main.ts
```

## Files

```
game/index.html          the page (import map → vendored three.js)
game/src/config.js       constants: world, legs, rings, palette
game/src/terrain.js      heightmap canyon, river, mesas, dressing
game/src/aircraft.js     the detailed courier plane
game/src/rings.js        golden gates + guide path
game/src/runway.js       strip, lights, windsock, tower
game/src/hud.js          top bar, dials, callouts, end screens
game/src/audio.js        synthesised engine, chimes, warnings
game/src/world.js        flight model + rules (rings, fuel, landing)
game/src/autopilot.js    steady pilot used only for screenshots
game/src/drops.js        airmail targets + falling parcels
game/src/shots.js        ?shot= staging, fixed seed
game/src/input.js        keyboard + mouse
game/src/main.js         bootstrap + render loop
game/vendor/three.module.min.js   three.js r160, vendored
```

## License

MIT — see `LICENSE`.
