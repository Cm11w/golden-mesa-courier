# Golden Mesa Courier

[![make.fun](https://make.fun/badge/competition/best-flight-game-20261126-0057)](https://make.fun/c/best-flight-game-20261126-0057)
[![make.fun](https://make.fun/badge/entries/best-flight-game-20261126-0057)](https://make.fun/c/best-flight-game-20261126-0057)
[![make.fun](https://make.fun/badge/leaderboard/best-flight-game-20261126-0057)](https://make.fun/c/best-flight-game-20261126-0057)

A golden-hour mail run through a desert canyon. Fly a propeller courier
through twelve glowing gates across three named legs, fight the crosswind,
watch the fuel, and land her gently on the home strip for a grade.

**Bounty:** [Make the best flight game — make.fun](https://make.fun/c/best-flight-game-20261126-0057)

## How to fly

Open `game/index.html` in desktop Chrome (no network needed — Three.js is
vendored under `game/vendor/`).

- **W / S** — throttle up / down
- **← →** — roll (bank to turn)
- **↑ ↓** — pitch
- **Drag mouse** — look around
- **G** — gear up / down · **R** — fly again after landing or a crash

## The sortie

| Leg | Name | Gates | What changes |
|-----|------|-------|--------------|
| 1 | Canyon Run | 4 | Calm air, learn the rings |
| 2 | River Bend | 4 | Crosswind 8 kt pushes the plane |
| 3 | Mesa Gates | 4 | Crosswind 16 kt, fuel running low |

Thread a ring to score and top up fuel (+2%) and time (+8 s). Cargo grows
with every leg — 24 kg, then 60 kg, then 144 kg. Clear all twelve gates and
land on the runway: **PERFECT**, **GOOD** or **HARD**, by how gently and how
centred you touch down. Hit the terrain or run dry and the canyon keeps
the mail.

## What you see

- A detailed propeller courier: tapered fuselage with orange cheatline and
  "GOLDEN MESA / N427GM" livery, glass canopy, spinning propeller, cargo
  pod, landing gear, red/green navigation lights.
- A golden-hour canyon: layered mesas, a blue river, saguaro cacti,
  cottonwoods, rocks, distant peaks, clouds and a low sun.
- A home strip with painted markings, edge lights, a windsock and a tower.
- A full panel: altitude, speed and heading, score, rings, time and cargo
  up top; airspeed, attitude and altimeter dials, throttle and fuel below.
- Synthesised engine hum, wind, ring chimes, warnings and a landing
  fanfare — no audio files.

## Screenshots

Four staged shots, each a repeatable render of the real rules being
played with a fixed seed (`game/index.html?shot=leg1|leg2|leg3|landing&seed=1`):

1. Leg 1 mid-flight, threading Gate 02 in the canyon
2. Leg 2 along the river, crosswind warning up
3. Leg 3 through the mesa gates, fuel low
4. Landing on the runway with the results screen — 12/12 gates

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
game/src/shots.js        ?shot= staging, fixed seed
game/src/input.js        keyboard + mouse
game/src/main.js         bootstrap + render loop
game/vendor/three.module.min.js   three.js r160, vendored
```

## License

MIT — see `LICENSE`.
