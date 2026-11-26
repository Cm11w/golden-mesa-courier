// Golden Mesa Courier — the airmail drop targets and parcels.
// One job: the painted target circles on the ground (one per DROP_SPOTS
// entry) and the little mail parcels that fall when SPACE is pressed.
// A done target turns green; the next target of the current leg pulses.

import * as THREE from 'three';
import { DROP_RADIUS, DROP_SPOTS, PALETTE } from './config.js';
import { groundHeightAt } from './terrain.js';

function dropLabelTexture(text) {
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
  ctx.font = 'bold 44px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Build the drop targets; returns { group, targets, parcels, update }. */
export function buildDrops() {
  const group = new THREE.Group();
  const ringMat = new THREE.MeshBasicMaterial({
    color: PALETTE.gold, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
  });
  const discMat = new THREE.MeshBasicMaterial({
    color: PALETTE.gold, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
  });
  const doneMat = new THREE.MeshBasicMaterial({
    color: '#7ee2a0', transparent: true, opacity: 0.85, side: THREE.DoubleSide,
  });
  const targets = [];
  DROP_SPOTS.flatMap((legSpots, leg) => legSpots.map(([x, z, label]) => ({ x, z, label, leg })))
    .forEach((spot) => {
      const y = groundHeightAt(spot.x, spot.z) + 0.4;
      const t = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CircleGeometry(DROP_RADIUS, 40), discMat);
      disc.rotation.x = -Math.PI / 2;
      const ring = new THREE.Mesh(new THREE.RingGeometry(DROP_RADIUS - 1.6, DROP_RADIUS, 48), ringMat);
      ring.rotation.x = -Math.PI / 2;
      const bull = new THREE.Mesh(new THREE.CircleGeometry(4, 24),
        new THREE.MeshBasicMaterial({ color: PALETTE.gold, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      bull.rotation.x = -Math.PI / 2;
      bull.position.y = 0.1;
      const labelTex = dropLabelTexture(`DROP · ${spot.label}`);
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(34, 8.5),
        new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
      );
      label.position.y = 16;
      t.add(disc, ring, bull, label);
      t.position.set(spot.x, y, spot.z);
      group.add(t);
      targets.push({ ...spot, group: t, ring, bull, label, labelTex, y });
    });

  // One reusable parcel mesh per drop (hidden until its parcel falls).
  const parcelGeo = new THREE.BoxGeometry(2.2, 1.6, 2.2);
  const parcelMat = new THREE.MeshStandardMaterial({ color: '#c98a4b', roughness: 0.8 });
  const strapMat = new THREE.MeshStandardMaterial({ color: '#8a2f2f', roughness: 0.7 });
  const parcels = [];
  for (let i = 0; i < 4; i += 1) {
    const p = new THREE.Group();
    const box = new THREE.Mesh(parcelGeo, parcelMat);
    box.castShadow = true;
    const strap = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.65, 0.5), strapMat);
    p.add(box, strap);
    p.visible = false;
    group.add(p);
    parcels.push(p);
  }

  function update(state, time) {
    // Targets follow the world drop state (same order as world.drops).
    state.drops.forEach((d, i) => {
      const t = targets[i];
      if (!t) return;
      const done = d.done;
      t.ring.material = done ? doneMat : ringMat;
      t.bull.material.color.set(done ? '#7ee2a0' : PALETTE.gold);
      const isNext = !done && d.leg === state.leg
        && state.drops.findIndex((o) => !o.done && o.leg === state.leg) === i;
      const pulse = 1 + (isNext ? 0.08 * Math.sin(time * 3) : 0);
      t.ring.scale.setScalar(pulse);
      t.label.lookAt(state.pos.x, t.group.position.y + 16, state.pos.z);
    });
    // Parcels follow the falling parcels in the world state.
    state.packages.forEach((p, i) => {
      const mesh = parcels[i];
      if (!mesh) return;
      mesh.visible = true;
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.y += p.landed ? 0 : 0.06;
    });
  }

  return { group, targets, parcels, update };
}
