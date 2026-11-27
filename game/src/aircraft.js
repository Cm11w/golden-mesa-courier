// Golden Mesa Courier — the detailed courier aeroplane.
// One job: build the plane the camera chases. Nose faces +Z; heading rotates it.
// No boxes for the airframe: lathe fuselage, extruded wings, spun propeller.
//
// buildAircraft(variant) takes the menu's choice: one of three models
// (courier / racer / hauler) and a livery { base, stripe, accent }.
// Called with no arguments it builds the original courier in the cream
// livery, so the default game and every existing screenshot are unchanged.

import * as THREE from 'three';

const DEFAULT_LIVERY = { base: '#faf3dd', stripe: '#c22e2e', accent: '#e8722a' };
const DEFAULT_MODEL = { radius: 1.0, length: 1.0, wingY: 0.62, pod: 1.0, twinFin: false, prop: 1.0 };

function fuselageTexture(base, stripe) {
  // Painted around the fuselage: body colour, a cheatline, gold pinstripes,
  // the operator name and the registration on both flanks, plus panel lines.
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 1024, 256);
  // Panel lines (v runs tail at canvas bottom, nose at canvas top).
  ctx.strokeStyle = 'rgba(120, 84, 48, 0.35)';
  ctx.lineWidth = 2;
  for (let y = 24; y < 256; y += 28) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke();
  }
  // Cheatline + gold pinstripes across the cabin band: the livery stripe
  // reads at a glance against the orange desert, where orange did not.
  ctx.fillStyle = stripe;
  ctx.fillRect(0, 96, 1024, 42);
  ctx.fillStyle = '#ffc23d';
  ctx.fillRect(0, 90, 1024, 5);
  ctx.fillRect(0, 140, 1024, 5);
  // Operator name and registration, once per flank.
  ctx.fillStyle = '#20303a';
  ctx.font = 'bold 44px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('GOLDEN MESA', 256, 66);
  ctx.fillText('GOLDEN MESA', 768, 66);
  ctx.font = 'bold 34px Georgia, serif';
  ctx.fillText('N427GM', 256, 196);
  ctx.fillText('N427GM', 768, 196);
  // Mail diamonds on the stripe.
  ctx.fillStyle = '#fff3c4';
  for (const cx of [128, 384, 640, 896]) {
    ctx.save();
    ctx.translate(cx, 117);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function finTexture(accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#ffc23d';
  ctx.fillRect(0, 118, 256, 10);
  ctx.fillStyle = '#f5e9c8';
  ctx.font = 'bold 52px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('N427', 128, 88);
  ctx.fillText('GM', 128, 178);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function wingHalf(span, rootChord, tipChord, thickness, material) {
  // Tapered, round-tipped half wing, extruded so it has a real airfoil edge.
  const shape = new THREE.Shape();
  shape.moveTo(0, -rootChord / 2);
  shape.lineTo(span - 0.9, -tipChord / 2);
  shape.quadraticCurveTo(span, 0, span - 0.9, tipChord / 2);
  shape.lineTo(0, rootChord / 2);
  shape.quadraticCurveTo(-0.25, 0, 0, -rootChord / 2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.08, bevelSegments: 2 });
  geo.rotateX(Math.PI / 2); // chord -> Z, thickness -> Y
  // After rotateX the slab sits low (y in [-thickness-0.03, +0.03]); shift it
  // up by half the thickness so the slab is centred on the chord plane.
  geo.translate(0, thickness / 2, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

function bladeShape() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -0.16);
  shape.quadraticCurveTo(0.7, -0.22, 2.6, -0.1);
  shape.quadraticCurveTo(2.85, 0, 2.6, 0.1);
  shape.quadraticCurveTo(0.7, 0.22, 0, 0.16);
  shape.quadraticCurveTo(-0.12, 0, 0, -0.16);
  return shape;
}

/**
 * Build the plane; returns { group, propeller, navLights, gear }.
 * `variant` = { radius, length, wingY, pod, twinFin, prop, livery }.
 * With no argument: the original courier in the cream livery.
 */
export function buildAircraft(variant = {}) {
  const v = { ...DEFAULT_MODEL, ...variant };
  const livery = { ...DEFAULT_LIVERY, ...(variant.livery || {}) };
  const R = v.radius; // fuselage radius scale
  const L = v.length; // fuselage length scale
  const group = new THREE.Group();
  const cream = new THREE.MeshStandardMaterial({ map: fuselageTexture(livery.base, livery.stripe), roughness: 0.55, metalness: 0.08 });
  // Plain body colour for wings and stabilisers: the fuselage texture carries
  // the operator name and cheatline, which would smear across the wing surfaces.
  const creamPlain = new THREE.MeshStandardMaterial({ color: livery.base, roughness: 0.55, metalness: 0.08 });
  const accent = new THREE.MeshStandardMaterial({ color: livery.accent, roughness: 0.5, metalness: 0.1 });
  const stripe = new THREE.MeshStandardMaterial({ color: livery.stripe, roughness: 0.5, metalness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.6, metalness: 0.3 });
  const glass = new THREE.MeshPhongMaterial({ color: '#9fd8e8', transparent: true, opacity: 0.55, shininess: 120 });
  const steel = new THREE.MeshStandardMaterial({ color: '#8a8f96', roughness: 0.35, metalness: 0.8 });
  const tire = new THREE.MeshStandardMaterial({ color: '#1c1a18', roughness: 0.95 });

  // Fuselage: lathe profile, tail tip -> nose tip, then laid along Z.
  const profile = [
    [0.02, -4.2], [0.42, -4.05], [0.62, -3.6], [0.78, -2.9], [0.92, -2.0],
    [1.02, -1.0], [1.05, 0.0], [1.0, 0.9], [0.88, 1.9], [0.66, 2.9],
    [0.42, 3.6], [0.18, 4.15], [0.02, 4.3],
  ].map(([r, y]) => new THREE.Vector2(r * R, y * L));
  const fuselage = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), cream);
  fuselage.rotation.x = Math.PI / 2; // axis -> Z, nose at +Z
  fuselage.castShadow = true;
  group.add(fuselage);

  // Belly cargo pod: a smooth capsule slung under the cabin (racer has none).
  if (v.pod > 0) {
    const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.55 * v.pod, 2.4, 6, 12), new THREE.MeshStandardMaterial({ color: '#b98a4e', roughness: 0.8 }));
    pod.rotation.x = Math.PI / 2;
    pod.position.set(0, -0.95 * R, 0.4 * L);
    pod.castShadow = true;
    group.add(pod);
  }

  // Canopy: a glass bubble sunk into the cabin top.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), glass);
  canopy.scale.set(0.82 * R, 0.62 * R, 1.5 * L);
  canopy.position.set(0, 0.78 * R, 1.15 * L);
  group.add(canopy);
  // Canopy frame: two thin hoops over the bubble. The half-torus already
  // arches across the fuselage in the XY plane; rotating it about Y would
  // turn the hoops fore-aft like a mohawk.
  for (const z of [0.35, 1.55]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.78 * R, 0.05, 8, 24, Math.PI), dark);
    hoop.position.set(0, 0.72 * R, z * L);
    hoop.rotation.z = 0;
    group.add(hoop);
  }

  // Wing, two halves with dihedral, stripe tips, struts to the belly.
  // wingHalf spans +X only, so the -X half is mirrored with rotation.y = PI;
  // with the default XYZ Euler order Rz runs before Ry, so the same +0.07
  // dihedral lifts BOTH tips (a mirrored side * -0.07 would droop one).
  // A low wing (racer) sits near the belly and needs no struts.
  const DIHEDRAL = 0.07;
  const tipY = v.wingY + Math.sin(DIHEDRAL) * 6.35;
  for (const side of [-1, 1]) {
    const half = wingHalf(6.4, 2.1, 1.15, 0.16, creamPlain);
    half.position.set(side * 0.1, v.wingY, 0.35 * L);
    if (side < 0) half.rotation.y = Math.PI; // mirror to -X
    half.rotation.z = DIHEDRAL;
    group.add(half);
    // Stripe tip: starts where the main wing ends and keeps the same dihedral,
    // so its root sits at the main wing's tip height.
    const tip = wingHalf(1.0, 1.15, 0.9, 0.17, stripe);
    tip.position.set(side * 6.35, tipY, 0.35 * L);
    if (side < 0) tip.rotation.y = Math.PI;
    tip.rotation.z = DIHEDRAL;
    group.add(tip);
    if (v.wingY > 0.3) {
      // Strut from the wing underside (x = 2.6, y = 0.72) down to the belly
      // (x = 0.7, y = -0.74): length ~2.6, leaning OUT as it rises.
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 8), steel);
      strut.position.set(side * 1.65, -0.01, 0.55 * L);
      strut.rotation.z = -side * 0.92;
      group.add(strut);
    }
  }

  // Tail: stabiliser + fin(s), accent tips, registration plates on the fin.
  // Same mirror + dihedral as the main wing: the -X half is mirrored so both
  // stabilisers rise to the same height.
  for (const side of [-1, 1]) {
    const stab = wingHalf(2.6, 1.25, 0.7, 0.11, creamPlain);
    stab.position.set(side * 0.08, 0.28 * R, -3.55 * L);
    if (side < 0) stab.rotation.y = Math.PI; // mirror to -X
    stab.rotation.z = 0.07;
    group.add(stab);
  }
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(1.5, 0.12);
  finShape.lineTo(1.15, 1.9);
  finShape.quadraticCurveTo(0.9, 2.15, 0.55, 2.0);
  finShape.lineTo(-0.35, 0.35);
  finShape.quadraticCurveTo(-0.2, 0, 0, 0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.1, bevelEnabled: false });
  // The extrude runs the chord along X and the thickness along Z; rotate it
  // so the chord runs fore-aft (Z, leading edge forward) and the 0.1 thickness
  // sits centred on x = 0.
  finGeo.rotateY(Math.PI / 2);
  finGeo.translate(-0.05, 0, 0);
  const plateTex = finTexture(livery.accent);
  if (v.twinFin) {
    // Hauler: two fins, one on each side of the tail, no centre fin.
    for (const side of [-1, 1]) {
      const fin = new THREE.Mesh(finGeo, accent);
      fin.scale.setScalar(0.85);
      fin.position.set(side * 0.5, 0.35 * R, -2.75 * L);
      fin.castShadow = true;
      group.add(fin);
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 1.1),
        new THREE.MeshBasicMaterial({ map: plateTex, transparent: true }),
      );
      plate.position.set(side * 0.56, 1.1 * R, -3.35 * L);
      plate.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      group.add(plate);
    }
  } else {
    const fin = new THREE.Mesh(finGeo, accent);
    fin.position.set(0, 0.35 * R, -2.75 * L); // chord spans z in [-4.25, -2.4], over the tail
    fin.castShadow = true;
    group.add(fin);
    for (const side of [-1, 1]) {
      // Square plate so the registration text is not stretched; sits 0.01 proud
      // of the fin face (fin is 0.1 thick, faces at x = +/-0.05) and inside the
      // fin chord at this height (z in [-4.13, -2.62]).
      const plate = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 1.1),
        new THREE.MeshBasicMaterial({ map: plateTex, transparent: true }),
      );
      plate.position.set(side * 0.06, 1.1 * R, -3.35 * L);
      plate.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      plate.rotation.x = 0;
      group.add(plate);
    }
  }

  // Propeller: spinner cone, hub, two twisted blades with yellow tips.
  const propeller = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 16), accent);
  spinner.rotation.x = Math.PI / 2;
  spinner.position.z = 0.45;
  propeller.add(spinner);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 12), dark);
  hub.rotation.x = Math.PI / 2;
  propeller.add(hub);
  for (const angle of [0, Math.PI]) {
    const blade = new THREE.Group();
    const bladeMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape(), { depth: 0.07, bevelEnabled: false }), dark);
    bladeMesh.rotation.x = -0.35; // pitch twist
    blade.add(bladeMesh);
    const tip = new THREE.Mesh(new THREE.ExtrudeGeometry(bladeShape(), { depth: 0.075, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: '#ffc23d', roughness: 0.5 }));
    tip.scale.set(0.32, 1, 1);
    tip.position.set(2.0, 0, -0.005);
    tip.rotation.x = -0.35;
    blade.add(tip);
    blade.rotation.z = angle;
    blade.scale.setScalar(v.prop);
    propeller.add(blade);
  }
  propeller.position.set(0, 0, 4.35 * L);
  // Blur disc: a faint translucent disc at the prop plane so the spinning
  // propeller reads as a disc in stills, not a thin stick.
  const blurDisc = new THREE.Mesh(
    new THREE.CircleGeometry(2.9 * v.prop, 32),
    new THREE.MeshBasicMaterial({
      color: '#2b2622', transparent: true, opacity: 0.14,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  blurDisc.position.z = 0.5;
  propeller.add(blurDisc);
  group.add(propeller);

  // Exhaust stubs under the nose, seated in the cowling: the fuselage radius
  // at z = 3.55 is ~0.42, so the stubs sit at radial distance 0.38, their
  // inner ends embedded in the cowling (the old position floated 0.36 clear).
  for (const side of [-1, 1]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.5, 8), dark);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(side * 0.27 * R, -0.27 * R, 3.55 * L);
    group.add(pipe);
  }

  // Landing gear: legs, torus tyres, hubs, tail wheel — kept in its own
  // group so the gear hides when it is retracted (gearDown = false).
  // The whole gear scales with the fuselage radius.
  const gear = new THREE.Group();
  gear.scale.setScalar(R);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.9, 8), steel);
    leg.position.set(side * 0.95, -1.35, 1.35);
    leg.rotation.z = side * 0.18;
    gear.add(leg);
    const wheel = new THREE.Group();
    const tyreMesh = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.19, 10, 20), tire);
    const hubMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.2, 12), steel);
    hubMesh.rotation.x = Math.PI / 2;
    wheel.add(tyreMesh, hubMesh);
    wheel.position.set(side * 1.3, -2.25, 1.35);
    wheel.rotation.y = Math.PI / 2;
    gear.add(wheel);
  }
  // Tail wheel: its top must touch the fuselage belly (radius ~0.5 at
  // z = -3.8), so the wheel centre sits at y = -0.72 on a short strut.
  const tailStrut = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), steel);
  tailStrut.position.set(0, -0.6, -3.8);
  gear.add(tailStrut);
  const tailWheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.09, 8, 14), tire);
  tailWheel.position.set(0, -0.72, -3.8);
  tailWheel.rotation.y = Math.PI / 2;
  gear.add(tailWheel);
  group.add(gear);

  // Navigation lights: red left (port), green right (starboard), white tail.
  // The nose faces +Z, so the plane's left side is +X in local space — the
  // red light sits at +7.35 and the green at -7.35, not the other way round.
  // The wingtip lights sit at the tip's outer end (tipY with dihedral);
  // the tail light sits on the tail tip itself.
  const navLights = {};
  const lightGeo = new THREE.SphereGeometry(0.09, 8, 6);
  navLights.left = new THREE.Mesh(lightGeo, new THREE.MeshStandardMaterial({ color: '#ff2e2e', emissive: '#ff2e2e', emissiveIntensity: 2.5 }));
  navLights.left.position.set(7.35, tipY + 0.05, 0.35 * L);
  navLights.right = new THREE.Mesh(lightGeo, new THREE.MeshStandardMaterial({ color: '#2eff5a', emissive: '#2eff5a', emissiveIntensity: 2.5 }));
  navLights.right.position.set(-7.35, tipY + 0.05, 0.35 * L);
  navLights.tail = new THREE.Mesh(lightGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 2 }));
  navLights.tail.position.set(0, 0.12, -4.22 * L);
  group.add(navLights.left, navLights.right, navLights.tail);

  return { group, propeller, navLights, gear };
}
