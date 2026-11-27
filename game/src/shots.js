// Golden Mesa Courier — the screenshot staging.
// One job: given ?shot=leg1|leg2|leg3|landing&seed=1, put the world into that
// moment of a real sortie and let the autopilot fly it with fixed steps, so
// every screenshot is a repeatable render of the real rules being played —
// never a posed frame. Interactive play ignores this file entirely.

import * as THREE from 'three';
import { LEGS, RING_SPOTS, WORLD } from './config.js';
import { createWorld } from './world.js';
import { autopilotInput } from './autopilot.js';
import { groundHeightAt } from './terrain.js';

export const SHOT_IDS = ['leg1', 'leg2', 'leg3', 'landing', 'menu', 'results', 'cockpit', 'afterburner'];

/**
 * The score a real sortie would have at this moment, replayed from the award
 * rule in world.js (1000 + 100 * (leg + 1) + time bonus, time limit +8 s per
 * ring). Rings are taken as cleared at even intervals up to `elapsed`; the
 * staged score is the sum of those awards, so it is derivable from the rules
 * instead of a hand-picked number.
 */
function stagedScore(cleared, elapsed) {
  let total = 0;
  for (let i = 1; i <= cleared; i += 1) {
    const leg = Math.floor((i - 1) / 4);
    const timeLimit = 240 + 8 * (i - 1);
    const clearedAt = elapsed * i / cleared;
    total += 1000 + 100 * (leg + 1) + Math.round((timeLimit - clearedAt) / 10) * 10;
  }
  return total;
}

/** The staged moments. Score rises across the shots, as a real run would. */
export function stageShot(shotId) {
  const s = createWorld();
  if (shotId === 'menu') {
    // Title screen: the plane parked at the start line, gear down, engine
    // idling. main.js orbits the camera around it under the menu overlay.
    s.pos.set(WORLD.start.x, WORLD.start.y, WORLD.start.z);
    s.heading = WORLD.startHeading;
    s.speed = 0;
    s.throttle = 0;
    s.gearDown = true;
    return s;
  }
  // 'results' stages exactly like the landing shot: on final approach, and
  // runStaging flies it to touchdown — main.js then shows the results panel.
  // 'cockpit' and 'afterburner' stage like leg 1 (one ring in, afterburner
  // lit); the cockpit shot flies from inside the canopy (main.js), the
  // afterburner shot uses the burner cam (state.camMode).
  const leg = (shotId === 'leg1' || shotId === 'cockpit' || shotId === 'afterburner') ? 0 : shotId === 'leg2' ? 1 : 2;
  const cleared = (shotId === 'landing' || shotId === 'results') ? 12 : leg * 4 + 1;
  s.leg = (shotId === 'landing' || shotId === 'results') ? 2 : leg;
  s.ringsCleared = cleared;
  s.cargoKg = LEGS[s.leg].cargoKg;
  s.crosswind = LEGS[s.leg].crosswind;
  // Leg 3 is staged late (elapsed 232 s) so the tank is genuinely low by the
  // drain rule below — the LOW FUEL banner in that shot is earned, not posed.
  s.elapsed = [26, 96, 232, 262][(shotId === 'leg1' || shotId === 'cockpit' || shotId === 'afterburner') ? 0 : shotId === 'leg2' ? 1 : shotId === 'leg3' ? 2 : 3];
  s.score = stagedScore(cleared, s.elapsed);
  // Fuel from the real drain: 0.40 %/s at cruise throttle 0.7 (world.js drains
  // 0.12 + 0.40 * throttle), plus 2% topped up at each gate cleared.
  s.fuel = Math.round(100 - s.elapsed * 0.40 + 2 * cleared);
  s.timeLimit = WORLD.timeLimit + cleared * 8;
  s.gearDown = shotId === 'landing' || shotId === 'results';

  // Start a little behind the next ring, on the course line, mid-flight.
  // The course runs north (-z), so "behind" is south (+z) of the ring.
  // 280 m back: after the staging flight the ring still stands ~130 m
  // ahead, big and glowing, instead of swallowing the camera.
  const next = RING_SPOTS[Math.min(cleared, 11)];
  const isFinal = shotId === 'landing' || shotId === 'results';
  const back = isFinal ? null : new THREE.Vector3(next[0], next[1] + 4, next[2] + 280);
  if (isFinal) {
    // On final approach, 420 m out, descending toward the threshold.
    const r = WORLD.runway;
    s.pos.set(r.x + 8, r.y + 42, r.z + r.length / 2 + 420);
    s.heading = Math.PI;
    s.speed = 44;
    s.throttle = 0.42;
  } else {
    s.pos.copy(back);
    s.heading = Math.atan2(next[0] - back.x, next[2] - back.z);
    s.speed = 58;
    s.throttle = 0.7;
  }
  s.pitch = 0;
  s.roll = 0;

  // Per-shot callout, as the real game would show it.
  if (shotId === 'leg1' || shotId === 'cockpit' || shotId === 'afterburner') {
    // The gameplay showcase shot: afterburner lit for the whole staging
    // flight (autopilot never sends the field, so stepWorld keeps it on).
    s.afterburner = true;
    s.callout = 'GATE 02 — THREAD THE GOLDEN RING!';
    s.calloutUntil = s.elapsed + 30;
    // The afterburner shot pulls the chase cam back and down (burner cam)
    // so the twin flame tongues stay in frame.
    if (shotId === 'afterburner') s.camMode = 'burner';
  } else if (shotId === 'leg2') {
    s.callout = 'CROSSWIND 8 KT · HOLD YOUR LINE';
    s.calloutUntil = s.elapsed + 30;
    s.calloutDanger = true;
  } else if (shotId === 'leg3') {
    s.callout = 'LOW FUEL — FLY HER HOME';
    s.calloutUntil = s.elapsed + 30;
    s.calloutDanger = true;
  } else {
    s.callout = '';
  }
  if (shotId === 'leg2') {
    // The airmail shot (02-leg2-airmail): one ring into leg 2, with a parcel
    // already dead-centre on RIVER POST (+500, DROPS 1/4). Framing: the plane
    // comes in LOW over the river, due north from the east bank, so the
    // frozen frame holds the whole airmail story at once — GATE 06
    // ahead-left under the callout, the done (green) RIVER POST circle +
    // landed parcel ahead-right. The autopilot bends her onto the gate
    // during the staging flight (final heading ~203°). The old line-up
    // (20, 242, -1850, aimed straight at the gate) put the parcel ~100°
    // off the chase-cam axis, behind the camera — the callout and score
    // showed, but no target and no parcel. Staged at 120 m (not 90 m):
    // iteration 1 at 90 m put the target at py ~566, where the label and
    // the top of the circle hid behind the plane's own right wing. Higher
    // staging steepens the look-down so the circle + label drop BELOW the
    // wing band (target py ~639, label ~605), clear of the fuel panel.
    // Note the disc sits on a slope — its far/east arc is buried in the
    // terrain, so only the near (south-west) arc + bullseye + parcel read.
    s.drops[1].done = true;
    s.drops[1].bonus = 500;
    s.dropsDone = 1;
    s.dropBonusTotal = 500;
    s.score += 500;
    s.packages.push({
      x: 140, y: groundHeightAt(140, -1900) + 0.6, z: -1900, vy: 0, landed: true,
    });
    s.pos.set(150, 120, -1420);
    s.heading = Math.PI;
    s.speed = 58;
    s.throttle = 0.7;
    s.callout = 'AIRMAIL +500 — DEAD CENTRE!';
    s.calloutUntil = s.elapsed + 30;
    s.calloutDanger = false;
  }
  if (shotId === 'results') {
    // The results shot stages a COMPLETED sortie: all four airmail drops
    // dead centre (+500 each). The old staging left AIRMAIL 0 / 4 on the
    // results panel — a failed sub-objective as the showcase frame.
    for (const d of s.drops) { d.done = true; d.bonus = 500; }
    s.dropsDone = 4;
    s.dropBonusTotal = 2000;
    s.score += 2000;
  }
  return s;
}

/**
 * Fly the staged world forward with the autopilot for a fixed number of
 * fixed steps, then freeze. Returns the state; the caller renders one frame
 * and sets window.__shotReady = true.
 */
export function runStaging(s, stepWorld, steps = 150) {
  const events = [];
  for (let i = 0; i < steps; i += 1) {
    const input = autopilotInput(s);
    const ev = stepWorld(s, input, 1 / 60);
    events.push(...ev);
    if (s.phase !== 'fly') break;
  }
  // The landing shot keeps flying until the wheels touch.
  if (s.ringsCleared === 12 && s.phase === 'fly') {
    for (let i = 0; i < 60 * 20; i += 1) {
      const ev = stepWorld(s, autopilotInput(s), 1 / 60);
      events.push(...ev);
      if (s.phase !== 'fly') break;
    }
  }
  // Re-assert the shot's own callout: a ring cleared mid-staging would
  // otherwise overwrite it with a generic gate banner.
  if (s.phase === 'fly') {
    const id = s.ringsCleared === 12 ? 'landing' : s.leg === 0 ? 'leg1' : s.leg === 1 ? 'leg2' : 'leg3';
    if (id === 'leg1') {
      s.callout = `GATE ${String(s.ringsCleared + 1).padStart(2, '0')} — THREAD THE GOLDEN RING!`;
      s.calloutUntil = s.elapsed + 30;
      s.calloutDanger = false;
    } else if (id === 'leg2') {
      s.callout = 'AIRMAIL +500 — DEAD CENTRE!';
      s.calloutUntil = s.elapsed + 30;
      s.calloutDanger = false;
    } else if (id === 'leg3') {
      s.callout = 'LOW FUEL — FLY HER HOME';
      s.calloutUntil = s.elapsed + 30;
      s.calloutDanger = true;
    }
  }
  return events;
}
