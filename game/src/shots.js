// Golden Mesa Courier — the screenshot staging.
// One job: given ?shot=title|leg2|leg3|landing&seed=1, put the world into
// that moment of a real sortie and let the autopilot fly it with fixed
// steps, so every screenshot is a repeatable render of the real rules being
// played — never a posed frame. Interactive play ignores this file entirely.

import * as THREE from 'three';
import { LEGS, RING_SPOTS, WORLD } from './config.js';
import { createWorld } from './world.js';
import { autopilotInput } from './autopilot.js';
import { groundHeightAt } from './terrain.js';

export const SHOT_IDS = ['title', 'leg2', 'leg3', 'landing'];

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

/** The four staged moments. Score rises across the shots, as a real run would. */
export function stageShot(shotId) {
  const s = createWorld();
  s.staged = true; // fixed personal best, no localStorage writes in shots
  s.personalBest = shotId === 'landing' ? 10840 : 0;

  if (shotId === 'title') {
    // The title screen over the canyon at the start line: no flight yet.
    s.phase = 'title';
    s.titleTime = 1.2;
    s.callout = '';
    return s;
  }

  s.phase = 'fly';
  const leg = shotId === 'leg2' ? 1 : 2;
  const cleared = shotId === 'landing' ? 12 : leg * 4 + 1;
  s.leg = shotId === 'landing' ? 2 : leg;
  s.ringsCleared = cleared;
  s.cargoKg = LEGS[s.leg].cargoKg;
  s.crosswind = LEGS[s.leg].crosswind;
  // Leg 3 is staged late (elapsed 232 s) so the tank is genuinely low by the
  // drain rule below — the LOW FUEL banner in that shot is earned, not posed.
  s.elapsed = shotId === 'leg2' ? 96 : shotId === 'leg3' ? 232 : 262;
  s.score = stagedScore(cleared, s.elapsed);
  // Fuel from the real drain: 0.40 %/s at cruise throttle 0.7 (world.js drains
  // 0.12 + 0.40 * throttle), plus 2% topped up at each gate cleared.
  s.fuel = Math.round(100 - s.elapsed * 0.40 + 2 * cleared);
  s.timeLimit = WORLD.timeLimit + cleared * 8;
  s.gearDown = shotId === 'landing';

  // Start a little behind the next ring, on the course line, mid-flight.
  // The course runs north (-z), so "behind" is south (+z) of the ring.
  // 280 m back: after the staging flight the ring still stands ~130 m
  // ahead, big and glowing, instead of swallowing the camera.
  const next = RING_SPOTS[Math.min(cleared, 11)];
  const back = shotId === 'landing' ? null : new THREE.Vector3(next[0], next[1] + 4, next[2] + 280);
  if (shotId === 'landing') {
    // On final approach, 420 m out, descending toward the threshold.
    const r = WORLD.runway;
    s.pos.set(r.x + 8, r.y + 42, r.z + r.length / 2 + 420);
    s.heading = Math.PI;
    s.speed = 44;
    s.throttle = 0.42;
  } else if (shotId === 'leg2') {
    // The airmail shot: one ring into leg 2, between GATE 05 and GATE 06
    // and lined up on it, with a parcel already dead-centre on RIVER POST
    // (+500, DROPS 1/2 on the HUD) off to the right of the course.
    s.drops[1].done = true;
    s.drops[1].bonus = 500;
    s.dropsDone = 1;
    s.dropBonusTotal = 500;
    s.score += 500;
    s.packages.push({
      x: 140, y: groundHeightAt(140, -1900) + 0.6, z: -1900, vy: 0, landed: true,
    });
    s.pos.set(20, 242, -1850);
    s.heading = Math.atan2(-90 - 20, -2010 + 1850);
    s.speed = 58;
    s.throttle = 0.7;
  } else {
    s.pos.copy(back);
    s.heading = Math.atan2(next[0] - back.x, next[2] - back.z);
    s.speed = 58;
    s.throttle = 0.7;
  }
  s.pitch = 0;
  s.roll = 0;

  // Per-shot callout, as the real game would show it.
  if (shotId === 'leg2') {
    s.callout = 'AIRMAIL +500 — DEAD CENTRE!';
    s.calloutUntil = s.elapsed + 30;
  } else if (shotId === 'leg3') {
    s.callout = 'LOW FUEL — FLY HER HOME';
    s.calloutUntil = s.elapsed + 30;
    s.calloutDanger = true;
  } else {
    s.callout = '';
  }
  return s;
}

/**
 * Fly the staged world forward with the autopilot for a fixed number of
 * fixed steps, then freeze. Returns the state; the caller renders one frame
 * and sets window.__shotReady = true.
 */
export function runStaging(s, stepWorld, steps = 150) {
  // The title shot never flies: it is the title screen, frozen as loaded.
  if (s.phase === 'title') return [];
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
    if (id === 'leg2') {
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
