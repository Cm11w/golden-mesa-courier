// Golden Mesa Courier — the golden gate rings and the guide path.
// One job: the twelve glowing rings the courier threads, and the dotted line
// that always points at the next one.

import * as THREE from 'three';
import { PALETTE, RING_RADIUS, RING_SPOTS } from './config.js';

function ringLabelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(10, 38, 46, 0.85)';
  ctx.beginPath();
  ctx.roundRect(6, 14, 500, 100, 18);
  ctx.fill();
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 52px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Build the twelve rings; returns { group, rings, update }. */
export function buildRings() {
  const group = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({
    color: PALETTE.gold, emissive: PALETTE.goldDeep, emissiveIntensity: 1.6,
    roughness: 0.3, metalness: 0.6,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: PALETTE.gold, transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const doneMat = new THREE.MeshStandardMaterial({
    color: '#7ee2a0', emissive: '#2fae6e', emissiveIntensity: 0.8,
    roughness: 0.4, metalness: 0.3,
  });
  const rings = [];
  for (let i = 0; i < RING_SPOTS.length; i += 1) {
    const [x, y, z] = RING_SPOTS[i];
    const ring = new THREE.Group();
    const torus = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS, 1.4, 14, 48), goldMat);
    torus.castShadow = true;
    const halo = new THREE.Mesh(new THREE.TorusGeometry(RING_RADIUS + 2.2, 2.6, 10, 48), glowMat);
    ring.add(torus, halo);
    // Label plate above the ring: GATE 03, refreshed with the live distance.
    const labelTex = ringLabelTexture(`GATE ${String(i + 1).padStart(2, '0')}`);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 8.5),
      new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    );
    label.position.y = RING_RADIUS + 12;
    ring.add(label);
    ring.position.set(x, y, z);
    // Rings stand upright across the course: face the incoming plane (south).
    ring.rotation.y = 0;
    group.add(ring);
    rings.push({ group: ring, torus, halo, label, labelTex, centre: new THREE.Vector3(x, y, z), cleared: false, index: i, size: i < 2 ? 1.3 : 1 });
  }

  // Guide path: a dashed golden line from the plane to the next ring.
  const guideGeo = new THREE.BufferGeometry();
  guideGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(2 * 3), 3));
  const guide = new THREE.Line(guideGeo, new THREE.LineDashedMaterial({
    color: PALETTE.gold, dashSize: 9, gapSize: 6, transparent: true, opacity: 0.9,
  }));
  guide.frustumCulled = false;
  group.add(guide);

  function update(planePos, nextRing, time) {
    for (const ring of rings) {
      const pulse = (1 + 0.06 * Math.sin(time * 2.4 + ring.index)) * ring.size;
      ring.torus.scale.setScalar(ring.cleared ? ring.size : pulse);
      ring.halo.material.opacity = ring.cleared ? 0.05 : 0.16 + 0.08 * Math.sin(time * 2.4 + ring.index);
      ring.torus.material = ring.cleared ? doneMat : goldMat;
    }
    if (nextRing) {
      const pos = guide.geometry.attributes.position;
      pos.setXYZ(0, planePos.x, planePos.y - 1, planePos.z);
      pos.setXYZ(1, nextRing.centre.x, nextRing.centre.y, nextRing.centre.z);
      pos.needsUpdate = true;
      guide.computeLineDistances();
      guide.visible = true;
      // Face the next ring's label at the plane so it always reads.
      nextRing.label.lookAt(planePos.x, nextRing.centre.y + RING_RADIUS + 12, planePos.z);
    } else {
      guide.visible = false;
    }
  }

  function setLabelDistance(ring, metres) {
    const text = `GATE ${String(ring.index + 1).padStart(2, '0')} · ${Math.round(metres)} m`;
    const canvas = ring.labelTex.image;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = 'rgba(10, 38, 46, 0.85)';
    ctx.beginPath();
    ctx.roundRect(6, 14, 500, 100, 18);
    ctx.fill();
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 46px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 66);
    ring.labelTex.needsUpdate = true;
  }

  return { group, rings, update, setLabelDistance };
}
