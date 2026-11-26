// Golden Mesa Courier — the autopilot that stages the screenshots.
// One job: fly the course like a steady pilot — steer at the next ring, keep
// a safe height over the canyon, and set up a gentle landing. The interactive
// game never uses it; the ?shot= staging does, so every screenshot shows the
// real rules being played with a fixed seed.

import * as THREE from 'three';
import { RING_COUNT, RING_SPOTS, WORLD } from './config.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/** Return { pitch, roll, throttle } inputs for this frame. */
export function autopilotInput(s) {
  const input = { pitch: 0, roll: 0, throttle: 0.7 };
  let target;
  let approachSpeed = 0.7;
  if (s.ringsCleared < RING_COUNT) {
    const [x, y, z] = RING_SPOTS[s.ringsCleared];
    target = new THREE.Vector3(x, y, z);
  } else {
    // Final approach in two steps, latched. Ring 12 sits 30 m south of the
    // threshold and 90 m above it, so aiming straight at the threshold from
    // there overshoots it and circles the strip at low height (the old code
    // did exactly that — it either landed hard or struck the ground).
    // Instead, first fly to a fix on the extended centreline, 380 m south
    // of the threshold at approach height; once the plane is lined up on a
    // stable final (south of the threshold, near the centreline, heading
    // north, below 40 m) the fix is latched off and the threshold is the
    // target for the rest of the approach — no flip-flopping back to the fix.
    const r = WORLD.runway;
    const fix = new THREE.Vector3(r.x, r.y + 25, r.z + r.length / 2 + 380);
    if (!s.finalSet) {
      const heightAboveStrip = s.pos.y - r.y;
      const linedUp = s.pos.z > r.z + r.length / 2 - 120
        && Math.abs(s.pos.x - r.x) < 60
        && Math.abs(wrapAngle(s.heading - Math.PI)) < 0.9
        && heightAboveStrip < 40;
      if (linedUp) s.finalSet = true;
    }
    target = s.finalSet
      ? new THREE.Vector3(r.x, r.y + 14, r.z + r.length / 2 - 120)
      : fix;
    approachSpeed = 0.42;
  }
  const dx = target.x - s.pos.x;
  const dy = target.y - s.pos.y;
  const dz = target.z - s.pos.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Heading: bank toward the target, proportional to the error.
  const desiredHeading = Math.atan2(dx, dz);
  const err = wrapAngle(desiredHeading - s.heading);
  const desiredRoll = THREE.MathUtils.clamp(-err * 1.4, -0.85, 0.85);
  input.roll = THREE.MathUtils.clamp((desiredRoll - s.roll) * 2.2, -1, 1);

  // Pitch: climb or descend toward the target height.
  let desiredPitch = THREE.MathUtils.clamp(dy * 0.012, -0.22, 0.24);
  if (s.ringsCleared >= RING_COUNT) {
    // Landing: gentle descent, flare near the ground.
    const heightAboveStrip = s.pos.y - WORLD.runway.y;
    if (dist < 160) {
      desiredPitch = heightAboveStrip > 16 ? -0.1 : heightAboveStrip > 7 ? -0.045 : 0.02;
      approachSpeed = heightAboveStrip > 16 ? 0.42 : 0.3;
    } else {
      desiredPitch = THREE.MathUtils.clamp((14 - heightAboveStrip) * 0.01, -0.14, 0.16);
    }
  } else if (dist < 120) {
    // Close in: level out so the ring is threaded, not overshot.
    desiredPitch = THREE.MathUtils.clamp(dy * 0.02, -0.12, 0.12);
  }
  input.pitch = THREE.MathUtils.clamp((desiredPitch - s.pitch) * 2.4, -1, 1);

  // Throttle: ease off when close to a ring so the turn stays clean.
  input.throttle = dist < 140 && s.ringsCleared < RING_COUNT ? 0.55 : approachSpeed;
  return input;
}
