// Golden Mesa Courier — leg-2 storm weather.
// One job: rain the pilot can see. A Points cloud of falling streaks in a
// box around the camera, visible only on leg 2 (RIVER BEND), plus nothing
// else: the leg-2 mist (terrain lowClouds) and the darker leg-2 atmosphere
// already carry the storm. Deterministic: fixed fall speed, positions wrap
// around the camera — no clock, no randomness at runtime.

import * as THREE from 'three';

function streakTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 8; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 32);
  grad.addColorStop(0, 'rgba(200, 220, 235, 0)');
  grad.addColorStop(0.5, 'rgba(200, 220, 235, 0.85)');
  grad.addColorStop(1, 'rgba(200, 220, 235, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(3, 0, 2, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const COUNT = 900;
const BOX = { x: 140, y: 70, z: 140 };
const FALL = 46; // m/s

/** Build the rain; returns { group, update(camPos, dt, active) }. */
export function buildWeather() {
  const group = new THREE.Group();
  const positions = new Float32Array(COUNT * 3);
  // Fixed pseudo-random scatter from a seeded sequence (no Math.random at
  // runtime — the layout is the same every run).
  let s = 1234567;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < COUNT; i += 1) {
    positions[i * 3] = (rnd() - 0.5) * BOX.x;
    positions[i * 3 + 1] = rnd() * BOX.y;
    positions[i * 3 + 2] = (rnd() - 0.5) * BOX.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    map: streakTexture(), size: 1.6, transparent: true, opacity: 0.55,
    depthWrite: false, sizeAttenuation: true, color: '#c8dceb',
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  group.add(points);
  group.visible = false;

  function update(camPos, dt, active) {
    group.visible = active;
    if (!active) return;
    // Positions are LOCAL to the group, which rides with the camera: the
    // rain only falls (y) and wraps to the top of its box. No x/z motion
    // is needed — the box itself follows the plane.
    const pos = geo.attributes.position.array;
    const fall = FALL * dt;
    for (let i = 0; i < COUNT; i += 1) {
      let py = pos[i * 3 + 1] - fall;
      if (py < 0) py += BOX.y;
      pos[i * 3 + 1] = py;
    }
    group.position.set(camPos.x, Math.max(camPos.y - 10, 0), camPos.z);
    geo.attributes.position.needsUpdate = true;
  }

  return { group, update };
}
