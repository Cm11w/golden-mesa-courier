// Golden Mesa Courier — the flight model and the rules.
// One job: the state of one sortie — physics, rings, legs, fuel, wind,
// landing and game over — as pure numbers. Rendering lives elsewhere.

import * as THREE from 'three';
import { CALLSIGN, DROP_RADIUS, DROP_SPOTS, FUEL_RING_BONUS, LEGS, LOW_FUEL_AT, RING_COUNT, RING_RADIUS, RING_SPOTS, WORLD } from './config.js';
import { groundHeightAt } from './terrain.js';

export const MAX_SPEED = 88; // m/s, about 171 kt
export const AB_BOOST = 1.35; // afterburner: +35% top speed
export const AB_FUEL_MULT = 3; // afterburner burns 3x the fuel
const TURN_RATE = 0.55;
const PITCH_RATE = 0.55;
const ROLL_RATE = 1.6;
const MAX_ROLL = 1.05;
const MAX_PITCH = 0.5;

export function createWorld() {
  return {
    phase: 'fly', // fly | landed | over
    leg: 0,
    ringsCleared: 0,
    score: 0,
    cargoKg: LEGS[0].cargoKg,
    drops: DROP_SPOTS.flatMap((legSpots, leg) => legSpots.map(([x, z, label]) => ({
      x, z, leg, label, done: false, missed: false, bonus: 0, y: 0,
    }))),
    dropsDone: 0,
    dropBonusTotal: 0,
    packages: [], // falling mail parcels: { x, y, z, vy, landed }
    callsign: CALLSIGN,
    fuel: 100,
    airframe: 100,
    hull: 100, // structural damage: ground strike -25, hard landing -15..-30
    afterburner: false,
    elapsed: 0,
    timeLimit: WORLD.timeLimit,
    pos: new THREE.Vector3(WORLD.start.x, WORLD.start.y, WORLD.start.z),
    heading: WORLD.startHeading, // radians; π = north, down the course (-z)
    pitch: 0,
    roll: 0,
    speed: 46,
    verticalSpeed: 0,
    throttle: 0.62,
    gearDown: true,
    crosswind: LEGS[0].crosswind,
    callout: '',
    calloutUntil: 0,
    calloutDanger: false,
    landingGrade: '',
    overReason: '',
    warnedFuel: false,
    warnedWind: false,
    finalSet: false, // autopilot latch: once on a stable final, stay on it
  };
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function setCallout(s, text, seconds, danger = false) {
  s.callout = text;
  s.calloutUntil = s.elapsed + seconds;
  s.calloutDanger = danger;
}

/** Advance the world one fixed step. `input` = { pitch, roll, throttle }. Returns events. */
export function stepWorld(s, input, dt) {
  const events = [];
  if (s.phase !== 'fly') return events;
  s.elapsed += dt;

  // --- Controls ---
  s.throttle = THREE.MathUtils.clamp(input.throttle ?? s.throttle, 0, 1);
  // Afterburner (SHIFT held): +35% top speed at 3x fuel burn. The autopilot
  // never sends the field, so a staged shot can keep it on (undefined =
  // keep the staged value) while interactive play always drives it.
  if (input.afterburner !== undefined) s.afterburner = !!input.afterburner;
  const maxSpeed = s.afterburner ? MAX_SPEED * AB_BOOST : MAX_SPEED;
  const targetSpeed = 18 + s.throttle * (maxSpeed - 18);
  s.speed += (targetSpeed - s.speed) * Math.min(1, dt * 0.8);
  s.pitch = THREE.MathUtils.clamp(s.pitch + (input.pitch ?? 0) * PITCH_RATE * dt, -MAX_PITCH, MAX_PITCH);
  s.roll = THREE.MathUtils.clamp(s.roll + (input.roll ?? 0) * ROLL_RATE * dt, -MAX_ROLL, MAX_ROLL);
  if (!(input.roll ?? 0)) s.roll *= Math.max(0, 1 - dt * 1.1);
  if (!(input.pitch ?? 0)) s.pitch *= Math.max(0, 1 - dt * 0.8);

  // --- Motion ---
  s.heading = wrapAngle(s.heading - s.roll * TURN_RATE * dt * (0.6 + s.speed / MAX_SPEED));
  const cp = Math.cos(s.pitch);
  const forward = new THREE.Vector3(
    Math.sin(s.heading) * cp,
    Math.sin(s.pitch),
    Math.cos(s.heading) * cp,
  );
  // Crosswind pushes the plane sideways, stronger at low speed. Crosswind is
  // in m/s, so it enters directly; 0.35 is how much of the wind the airframe
  // actually feels (no knot conversion here — that lives in the HUD).
  const windDrift = s.crosswind * 0.35 * (1.2 - s.speed / MAX_SPEED);
  const sink = (1 - s.throttle) * 2.0 + (s.speed < 26 ? (26 - s.speed) * 0.35 : 0);
  s.verticalSpeed = forward.y * s.speed - sink;
  s.pos.addScaledVector(forward, s.speed * dt);
  s.pos.x += windDrift * dt;
  s.pos.y -= sink * dt;

  // --- Fuel ---
  // Drain is % per second: 0.12 idle plus 0.40 at full throttle, so a sortie
  // flown at cruise throttle (0.7) burns 0.40 %/s — 100% plus the gate
  // top-ups just covers the 336 s mission clock, and fuel, not time, is the
  // binding limit on a slow run. Afterburner triples the whole drain.
  s.fuel -= dt * (0.12 + s.throttle * 0.40) * (s.afterburner ? AB_FUEL_MULT : 1);
  if (s.fuel <= LOW_FUEL_AT && !s.warnedFuel) {
    s.warnedFuel = true;
    setCallout(s, 'LOW FUEL — FLY HER HOME', 4, true);
    events.push('warn');
  }
  if (s.fuel <= 0) {
    s.fuel = 0;
    s.phase = 'over';
    s.overReason = 'OUT OF FUEL — THE MESA KEEPS THE MAIL';
    events.push('over');
    return events;
  }

  // --- Clock ---
  if (s.elapsed >= s.timeLimit) {
    s.phase = 'over';
    s.overReason = 'OUT OF TIME — THE MAIL IS LATE';
    events.push('over');
    return events;
  }

  // --- Terrain ---
  const ground = groundHeightAt(s.pos.x, s.pos.z);
  if (s.pos.y <= ground + 2.5) {
    // Ground strike costs 25 hull and bounces the jet back up to climb
    // away — only a strike at 0 hull is fatal. The autopilot never strikes,
    // so the 12/12 + landing test is unaffected.
    s.hull = Math.max(0, s.hull - 25);
    s.pos.y = ground + 12;
    s.pitch = 0.15;
    s.speed *= 0.7;
    events.push('thud');
    if (s.hull <= 0) {
      s.phase = 'over';
      s.overReason = 'HULL BREACH — AIRCRAFT LOST';
      s.airframe = 0;
      events.push('over');
      return events;
    }
    setCallout(s, `GROUND STRIKE — HULL ${s.hull}%`, 4, true);
    events.push('warn');
  }
  if (s.pos.y > 420) s.pos.y = 420;

  // --- Rings ---
  const next = s.ringsCleared < RING_COUNT ? RING_SPOTS[s.ringsCleared] : null;
  if (next) {
    const dx = s.pos.x - next[0];
    const dy = s.pos.y - next[1];
    const dz = s.pos.z - next[2];
    if (Math.sqrt(dx * dx + dy * dy + dz * dz) < RING_RADIUS * 0.92) {
      const award = 1000 + 100 * (s.leg + 1) + Math.round((s.timeLimit - s.elapsed) / 10) * 10;
      s.score += award;
      s.ringsCleared += 1;
      s.fuel = Math.min(100, s.fuel + FUEL_RING_BONUS);
      s.timeLimit += 8;
      events.push('ring');
      if (s.ringsCleared === 4 || s.ringsCleared === 8) {
        s.leg += 1;
        s.cargoKg = LEGS[s.leg].cargoKg;
        s.crosswind = LEGS[s.leg].crosswind;
        setCallout(s, `LEG ${s.leg + 1} — ${LEGS[s.leg].name.toUpperCase()} · CARGO ${s.cargoKg} KG`, 4);
        events.push('leg');
        if (s.leg === 1 && !s.warnedWind) {
          s.warnedWind = true;
          setCallout(s, 'CROSSWIND 8 KT · HOLD YOUR LINE', 4, true);
          events.push('warn');
        }
      } else if (s.ringsCleared < RING_COUNT) {
        setCallout(s, `GATE ${String(s.ringsCleared + 1).padStart(2, '0')} — THREAD THE GOLDEN RING!`, 3);
      } else {
        setCallout(s, 'ALL GATES CLEAR — RUNWAY AHEAD, LAND HER GENTLY', 5);
      }
    }
  }

  // --- Falling mail parcels ---
  for (const p of s.packages) {
    if (p.landed) continue;
    p.vy = Math.min(p.vy + 22 * dt, 42);
    p.y -= p.vy * dt;
    const pg = groundHeightAt(p.x, p.z);
    if (p.y <= pg + 0.6) { p.y = pg + 0.6; p.landed = true; }
  }

  // --- Landing: all rings done, settle onto the runway strip ---
  if (s.ringsCleared === RING_COUNT) {
    const r = WORLD.runway;
    const nearStrip = Math.abs(s.pos.x - r.x) < r.width / 2 + 6
      && s.pos.z > r.z - r.length / 2 && s.pos.z < r.z + r.length / 2;
    if (nearStrip && s.pos.y <= r.y + 4 && Math.abs(s.verticalSpeed) < 14 && s.speed < 52) {
      s.phase = 'landed';
      // She sits level on the centreline: wings flat, nose down the strip.
      s.roll = 0;
      s.pitch = 0;
      s.heading = WORLD.runway.heading;
      // Settle the wheels exactly on the strip: the main wheels reach 2.86
      // below the airframe origin and the strip sits 0.15 above the runway.
      s.pos.y = r.y + 0.15 + 2.86;
      const centreOffset = Math.abs(s.pos.x - r.x);
      const vsFpm = Math.abs(s.verticalSpeed) * 196.85;
      s.landingGrade = centreOffset < 8 && vsFpm < 180 ? 'PERFECT'
        : centreOffset < 16 && vsFpm < 320 ? 'GOOD' : 'HARD';
      // A hard touchdown bends the airframe: -15 / -22 / -30 by how hard it
      // was. A landing that breaks the last of the hull is a crash, not a
      // touchdown — the results screen says so.
      if (s.landingGrade === 'HARD') {
        const dmg = vsFpm < 600 ? 15 : vsFpm < 1200 ? 22 : 30;
        s.hull = Math.max(0, s.hull - dmg);
        if (s.hull <= 0) {
          s.phase = 'over';
          s.overReason = 'HULL BREACH — AIRCRAFT LOST';
          s.airframe = 0;
          events.push('over');
          return events;
        }
        setCallout(s, `HARD LANDING — HULL ${s.hull}%`, 4, true);
      }
      s.score += s.landingGrade === 'PERFECT' ? 500 : s.landingGrade === 'GOOD' ? 250 : 100;
      s.score += Math.round((s.timeLimit - s.elapsed) / 10) * 10;
      events.push('landed');
    }
  }
  return events;
}

/** Drop the mail on the nearest remaining target of the current leg.
 *  Accuracy is the horizontal distance from the target centre at release:
 *  < 8 m dead centre +500, < 15 m +300, < 25 m +150, beyond that the parcel
 *  is lost (+0). Returns the bonus awarded, or null when nothing is left
 *  to drop on this leg. Only callable while flying. */
export function dropPackage(s) {
  if (s.phase !== 'fly') return null;
  const remaining = s.drops.filter((d) => !d.done && d.leg === s.leg);
  if (remaining.length === 0) return null;
  let best = remaining[0];
  let bestDist = Infinity;
  for (const d of remaining) {
    const dist = Math.hypot(s.pos.x - d.x, s.pos.z - d.z);
    if (dist < bestDist) { bestDist = dist; best = d; }
  }
  // Too far from any target: the parcel stays aboard — an accidental
  // SPACE press halfway across the canyon must not waste the drop.
  if (bestDist > 60) {
    setCallout(s, 'NO DROP TARGET BELOW — FLY OVER A GOLDEN CIRCLE', 2);
    return null;
  }
  const bonus = bestDist < 8 ? 500 : bestDist < 15 ? 300 : bestDist < DROP_RADIUS ? 150 : 0;
  best.done = true;
  best.missed = bonus === 0;
  best.bonus = bonus;
  s.dropsDone += 1;
  s.dropBonusTotal += bonus;
  s.score += bonus;
  s.packages.push({ x: s.pos.x, y: s.pos.y - 2, z: s.pos.z, vy: 0, landed: false });
  const verdict = bonus === 500 ? 'DEAD CENTRE!' : bonus === 300 ? 'RIGHT ON THE MARK!' : bonus === 150 ? 'ON THE EDGE — IT COUNTS!' : 'LOST IN THE SAND…';
  setCallout(s, bonus > 0 ? `AIRMAIL +${bonus} — ${verdict}` : `AIRMAIL ${verdict}`, 4, bonus === 0);
  return bonus;
}

/** HUD-friendly numbers derived from the state. */
export function hudState(s) {
  const ground = groundHeightAt(s.pos.x, s.pos.z);
  const nextRing = s.ringsCleared < RING_COUNT ? RING_SPOTS[s.ringsCleared] : null;
  const nextDrop = s.drops.find((d) => !d.done && d.leg === s.leg) || null;
  return {
    ...s,
    altitudeFt: Math.max(0, (s.pos.y - ground) * 3.28084),
    speedKt: s.speed * 1.94384,
    headingDeg: ((s.heading * 180) / Math.PI + 360) % 360,
    verticalSpeedFpm: s.verticalSpeed * 196.85,
    // Height above the ground right below the jet, in feet.
    aglFt: Math.max(0, (s.pos.y - ground) * 3.28084),
    // G-load, simplified: 1 + bank + pitch effort, clamped 1..4 G.
    gLoad: Math.min(4, Math.max(1, 1 + Math.abs(s.roll) * 0.8 + Math.abs(s.pitch) * 0.5)),
    nextRing: nextRing ? { x: nextRing[0], y: nextRing[1], z: nextRing[2] } : null,
    nextRingNm: nextRing
      ? Math.hypot(nextRing[0] - s.pos.x, nextRing[1] - s.pos.y, nextRing[2] - s.pos.z) / 1852
      : 0,
    nextDrop: nextDrop ? { x: nextDrop.x, z: nextDrop.z, label: nextDrop.label } : null,
  };
}
