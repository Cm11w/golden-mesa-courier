// Golden Mesa Courier — the flight model and the rules.
// One job: the state of one sortie — physics, rings, legs, fuel, wind,
// landing and game over — as pure numbers. Rendering lives elsewhere.

import * as THREE from 'three';
import { FUEL_RING_BONUS, LEGS, LOW_FUEL_AT, RING_COUNT, RING_RADIUS, RING_SPOTS, WORLD } from './config.js';
import { groundHeightAt } from './terrain.js';

export const MAX_SPEED = 88; // m/s, about 171 kt
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
    fuel: 100,
    airframe: 100,
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
  const targetSpeed = 18 + s.throttle * (MAX_SPEED - 18);
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
  // binding limit on a slow run.
  s.fuel -= dt * (0.12 + s.throttle * 0.40);
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
    s.pos.y = ground + 2.5;
    s.phase = 'over';
    s.overReason = 'TERRAIN STRIKE — THE CANYON WINS THIS TIME';
    s.airframe = 12;
    events.push('over');
    events.push('thud');
    return events;
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
      s.score += s.landingGrade === 'PERFECT' ? 500 : s.landingGrade === 'GOOD' ? 250 : 100;
      s.score += Math.round((s.timeLimit - s.elapsed) / 10) * 10;
      events.push('landed');
    }
  }
  return events;
}

/** HUD-friendly numbers derived from the state. */
export function hudState(s) {
  const ground = groundHeightAt(s.pos.x, s.pos.z);
  return {
    ...s,
    altitudeFt: Math.max(0, (s.pos.y - ground) * 3.28084),
    speedKt: s.speed * 1.94384,
    headingDeg: ((s.heading * 180) / Math.PI + 360) % 360,
    verticalSpeedFpm: s.verticalSpeed * 196.85,
  };
}
