// Golden Mesa Courier — canyon terrain, sky and dressing.
// One job: build the golden-hour desert the courier flies through, from a seed.

import * as THREE from 'three';
import { MESAS, PALETTE, PEAKS, RIVER_PATH, WORLD } from './config.js';

/** Deterministic random stream (mulberry32) so a seed always builds the same canyon. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise over a grid, for rolling ground. */
function makeNoise(rng) {
  const grid = [];
  for (let i = 0; i < 64; i += 1) {
    grid.push([]);
    for (let j = 0; j < 64; j += 1) grid[i].push(rng());
  }
  const smooth = (t) => t * t * (3 - 2 * t);
  return function noise(x, z) {
    const gx = x / 420 + 32;
    const gz = z / 420 + 32;
    const x0 = Math.max(0, Math.min(62, Math.floor(gx)));
    const z0 = Math.max(0, Math.min(62, Math.floor(gz)));
    const fx = smooth(gx - x0);
    const fz = smooth(gz - z0);
    const a = grid[x0][z0];
    const b = grid[x0 + 1][z0];
    const c = grid[x0][z0 + 1];
    const d = grid[x0 + 1][z0 + 1];
    return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
  };
}

/** The one shared noise field: the rendered ground and the flight model
 *  must agree on every height, so both read this same instance. */
const SHARED_NOISE = makeNoise(makeRng(WORLD.seed));

/** Distance from (x, z) to the river spline, and the nearest spline point. */
function riverDistance(x, z) {
  let best = Infinity;
  let bestPoint = RIVER_PATH[0];
  for (let i = 0; i < RIVER_PATH.length - 1; i += 1) {
    const [ax, az] = RIVER_PATH[i];
    const [bx, bz] = RIVER_PATH[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; bestPoint = [px, pz]; }
  }
  return { distance: best, point: bestPoint };
}

function mesaLift(x, z) {
  let lift = 0;
  for (const [mx, mz, radius, height] of MESAS) {
    const d = Math.hypot(x - mx, z - mz) / radius;
    if (d < 1) {
      const edge = Math.max(0, Math.min(1, (1 - d) / 0.22));
      const top = edge * edge * (3 - 2 * edge);
      lift = Math.max(lift, height * top);
    }
  }
  return lift;
}

/**
 * Ground height at (x, z): rolling desert, a river canyon carved along the
 * spline, flat-topped mesas, a flattened home plateau by the runway, and a
 * ring of high peaks far out.
 */
export function groundHeightAt(x, z, noise = SHARED_NOISE) {
  const roll = (noise(x, z) - 0.5) * 46 + (noise(x * 0.31 + 90, z * 0.31 - 40) - 0.5) * 22;
  const river = riverDistance(x, z);
  const carve = -62 * (1 - Math.min(1, river.distance / 260));
  const mesa = mesaLift(x, z);
  let height = 58 + roll + carve + mesa;
  // Home plateau: flatten the ground around the runway so landings read.
  const rd = Math.hypot(x - WORLD.runway.x, z - WORLD.runway.z);
  if (rd < 520) {
    const t = Math.max(0, Math.min(1, (520 - rd) / 300));
    const blend = t * t * (3 - 2 * t);
    height = height * (1 - blend) + WORLD.runway.y * blend;
  }
  // Far peaks rise toward the horizon in every direction, measured from
  // the terrain's own centre (0, -1700) — never along the course itself.
  const r = Math.hypot(x, z + 1700);
  if (r > 2300) height += (r - 2300) * 0.55;
  return height;
}

function strataColor(height, slope, out) {
  // Layered canyon bands: pale sand on top, rust bands, dark rock low.
  if (height > 150) out.set(PALETTE.mesaTop);
  else if (height > 110) out.set(PALETTE.mesaBandA);
  else if (height > 70) out.set(PALETTE.sand);
  else if (height > 34) out.set(PALETTE.sandDark);
  else out.set(PALETTE.mesaBandB);
  if (slope > 0.55) out.multiplyScalar(0.82); // steep faces read darker
  return out;
}

function buildGround(noise) {
  const size = 5200;
  const segments = 220;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -1700);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const tmp = new THREE.Vector3();
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = groundHeightAt(x, z, noise);
    pos.setY(i, h);
    // Slope from a small forward sample, for the strata shading.
    const ahead = groundHeightAt(x, z - 18, noise);
    const slope = Math.abs(h - ahead) / 18;
    strataColor(h, slope, c);
    // Speckle so the sand is never one flat tone.
    const speckle = 0.94 + 0.12 * noise(x * 2.7, z * 2.7);
    colors[i * 3] = c.r * speckle;
    colors[i * 3 + 1] = c.g * speckle;
    colors[i * 3 + 2] = c.b * speckle;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function buildRiver() {
  // A ribbon of water following the river spline, riding just above the
  // canyon floor it carved — never buried under the terrain. A wider sandy
  // bank ribbon runs underneath so the channel reads as a river, not a line.
  const group = new THREE.Group();
  const points = [];
  for (let i = 0; i < RIVER_PATH.length; i += 1) {
    const [x, z] = RIVER_PATH[i];
    points.push(new THREE.Vector3(x, groundHeightAt(x, z) + 2, z));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const segments = 220;
  const up = new THREE.Vector3(0, 1, 0);
  const ribbon = (width, yOff) => {
    const positions = [];
    const indices = [];
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const p = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      const side = new THREE.Vector3().crossVectors(tangent, up).normalize();
      positions.push(p.x - side.x * width / 2, p.y + yOff, p.z - side.z * width / 2);
      positions.push(p.x + side.x * width / 2, p.y + yOff, p.z + side.z * width / 2);
      if (i < segments) {
        const a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  };
  const bank = new THREE.Mesh(
    ribbon(200, -1),
    new THREE.MeshStandardMaterial({ color: PALETTE.sandLight, roughness: 1, metalness: 0 }),
  );
  group.add(bank);
  const water = new THREE.Mesh(
    ribbon(120, 0),
    new THREE.MeshStandardMaterial({
      color: PALETTE.river, roughness: 0.2, metalness: 0.35,
      transparent: true, opacity: 0.95, emissive: PALETTE.riverDeep, emissiveIntensity: 0.6,
    }),
  );
  group.add(water);
  return group;
}

function buildSkyDome() {
  // Vertical gradient dome: deep purple overhead, pink, orange at the horizon.
  const canvas = document.createElement('canvas');
  canvas.width = 4; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, PALETTE.skyTop);
  grad.addColorStop(0.38, PALETTE.skyMid);
  grad.addColorStop(0.68, PALETTE.skyLow);
  grad.addColorStop(1.0, '#ffcf8a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(3200, 24, 16);
  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
  const dome = new THREE.Mesh(geo, mat);
  dome.position.set(0, 0, -1700);
  return dome;
}

function buildSun() {
  // One big low sun with a soft halo, west of the course.
  const group = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.CircleGeometry(200, 48),
    new THREE.MeshBasicMaterial({ color: PALETTE.sunCore, fog: false }),
  );
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(320, 48),
    new THREE.MeshBasicMaterial({
      color: PALETTE.sunGlow, fog: false, transparent: true, opacity: 0.35,
    }),
  );
  halo.position.z = -4;
  group.add(halo, core);
  group.position.set(-2600, 480, -2600);
  group.lookAt(0, 220, -1700);
  return group;
}

function buildClouds(rng) {
  // Flat-bottomed puffs of white, drifting slowly west to east.
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: PALETTE.cloud, roughness: 1, metalness: 0,
    transparent: true, opacity: 0.9, emissive: '#ffb98a', emissiveIntensity: 0.25,
  });
  const puff = new THREE.IcosahedronGeometry(1, 1);
  for (let i = 0; i < 36; i += 1) {
    const cloud = new THREE.Group();
    const count = 3 + Math.floor(rng() * 4);
    for (let j = 0; j < count; j += 1) {
      const s = 40 + rng() * 70;
      const m = new THREE.Mesh(puff, mat);
      m.position.set((j - count / 2) * s * 0.9, (rng() - 0.5) * 18, (rng() - 0.5) * 26);
      m.scale.set(s, s * 0.42, s * 0.7);
      cloud.add(m);
    }
    cloud.position.set((rng() - 0.5) * 5200, 430 + rng() * 330, -4200 + rng() * 4400);
    group.add(cloud);
  }
  group.userData.drift = 1.6; // m/s
  return group;
}

function buildPeaks() {
  const group = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({ color: '#6b4a68', roughness: 1 });
  const snowMat = new THREE.MeshStandardMaterial({ color: '#f2d7e0', roughness: 0.9 });
  for (const [angle, distance, height, radius] of PEAKS) {
    const x = Math.sin(angle) * distance;
    const z = -1700 + Math.cos(angle) * distance;
    const peak = new THREE.Group();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 7), rockMat);
    cone.position.y = height / 2 - 40;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.34, height * 0.3, 7), snowMat);
    cap.position.y = height - 40 - height * 0.15;
    peak.add(cone, cap);
    peak.position.set(x, 0, z);
    group.add(peak);
  }
  return group;
}

function cactusMesh(materials) {
  // A saguaro: ridged trunk, two arms, one blossom — never a plain box.
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.0, 16, 10), materials.trunk);
  trunk.position.y = 8;
  trunk.castShadow = true;
  group.add(trunk);
  for (const side of [-1, 1]) {
    const armBase = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 6, 8), materials.trunk);
    armBase.position.set(side * 3.4, 7.5, 0);
    armBase.rotation.z = side * Math.PI / 2;
    const armUp = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 7, 8), materials.trunk);
    armUp.position.set(side * 6.2, 10.5, 0);
    armUp.castShadow = true;
    group.add(armBase, armUp);
  }
  const blossom = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), materials.blossom);
  blossom.position.y = 16.6;
  group.add(blossom);
  return group;
}

function treeMesh(materials, rng) {
  // A cottonwood by the river: leaning trunk, three leafy crowns.
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.9, 12, 8), materials.bark);
  trunk.position.y = 6;
  trunk.rotation.z = (rng() - 0.5) * 0.16;
  trunk.castShadow = true;
  group.add(trunk);
  for (let i = 0; i < 3; i += 1) {
    const crown = new THREE.Mesh(
      new THREE.IcosahedronGeometry(5.5 + rng() * 2.5, 1),
      i === 0 ? materials.leafLight : materials.leaf,
    );
    crown.position.set((rng() - 0.5) * 9, 13 + rng() * 4, (rng() - 0.5) * 9);
    crown.scale.y = 0.72;
    crown.castShadow = true;
    group.add(crown);
  }
  return group;
}

function rockMesh(materials, rng) {
  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2 + rng() * 5, 0),
    materials.rock,
  );
  rock.scale.set(1 + rng() * 0.8, 0.55 + rng() * 0.5, 1 + rng() * 0.8);
  rock.rotation.y = rng() * Math.PI;
  rock.castShadow = true;
  return rock;
}

function buildDressing(noise, rng) {
  // Cacti on the dry benches, cottonwoods by the water, rocks everywhere —
  // all kept clear of the flight line and the runway.
  const group = new THREE.Group();
  const materials = {
    trunk: new THREE.MeshStandardMaterial({ color: PALETTE.cactus, roughness: 0.95 }),
    blossom: new THREE.MeshStandardMaterial({ color: '#ff7d9c', roughness: 0.7, emissive: '#ff7d9c', emissiveIntensity: 0.4 }),
    bark: new THREE.MeshStandardMaterial({ color: '#6b4a33', roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: PALETTE.tree, roughness: 1 }),
    leafLight: new THREE.MeshStandardMaterial({ color: PALETTE.treeLight, roughness: 1 }),
    rock: new THREE.MeshStandardMaterial({ color: PALETTE.rock, roughness: 1 }),
  };
  const clearOfCourse = (x, z) => {
    const river = riverDistance(x, z);
    if (river.distance < 95) return false;
    if (Math.hypot(x - WORLD.runway.x, z - WORLD.runway.z) < 320) return false;
    return true;
  };
  let placed = 0;
  let guard = 0;
  while (placed < 130 && guard < 900) {
    guard += 1;
    const x = (rng() - 0.5) * 3400;
    const z = 300 - rng() * 4200;
    if (!clearOfCourse(x, z)) continue;
    const h = groundHeightAt(x, z, noise);
    if (h < 30 || h > 210) continue;
    const cactus = cactusMesh(materials);
    const s = 0.8 + rng() * 1.1;
    cactus.scale.setScalar(s);
    cactus.position.set(x, h - 0.5, z);
    cactus.rotation.y = rng() * Math.PI;
    group.add(cactus);
    placed += 1;
  }
  placed = 0; guard = 0;
  while (placed < 46 && guard < 700) {
    guard += 1;
    const x = (rng() - 0.5) * 2400;
    const z = 300 - rng() * 4200;
    const river = riverDistance(x, z);
    if (river.distance > 190 || river.distance < 100) continue;
    const h = groundHeightAt(x, z, noise);
    const tree = treeMesh(materials, rng);
    tree.position.set(x, h - 0.5, z);
    tree.rotation.y = rng() * Math.PI;
    group.add(tree);
    placed += 1;
  }
  placed = 0; guard = 0;
  while (placed < 90 && guard < 700) {
    guard += 1;
    const x = (rng() - 0.5) * 3600;
    const z = 300 - rng() * 4200;
    if (!clearOfCourse(x, z)) continue;
    const h = groundHeightAt(x, z, noise);
    const rock = rockMesh(materials, rng);
    rock.position.set(x, h, z);
    group.add(rock);
    placed += 1;
  }
  return group;
}

/** Build the whole static world: sky, sun, ground, river, peaks, clouds, dressing. */
export function buildTerrain(seed = WORLD.seed) {
  const rng = makeRng(seed);
  const noise = SHARED_NOISE;
  const group = new THREE.Group();
  group.add(buildSkyDome());
  const sun = buildSun();
  group.add(sun);
  group.add(buildGround(noise));
  group.add(buildRiver());
  group.add(buildPeaks());
  const clouds = buildClouds(rng);
  group.add(clouds);
  group.add(buildDressing(noise, rng));
  return { group, clouds, sun, groundHeightAt: (x, z) => groundHeightAt(x, z, noise) };
}
