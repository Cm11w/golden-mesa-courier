// Golden Mesa Courier — the detailed courier JET.
// One job: build the jet the camera chases. Nose faces +Z; heading rotates it.
// No boxes for the airframe: lathe fuselage, extruded swept/delta wings,
// twin afterburner nozzles with flame tongues. No propeller anywhere.
//
// buildAircraft(variant) takes the menu's choice: one of three jet models
// (courier = INTERCEPTOR delta, racer = STRIKE swept, hauler = HAULER
// wide-wing cargo jet) and a livery { base, stripe, accent }.
// Called with no arguments it builds the interceptor in the cream livery.

import * as THREE from 'three';

const DEFAULT_LIVERY = { base: '#faf3dd', stripe: '#c22e2e', accent: '#e8722a' };
const DEFAULT_MODEL = {
  radius: 0.85, length: 1.1, wingY: 0.15, pod: 0, twinFin: false,
  span: 5.2, sweep: 3.2, rootChord: 3.4, tipChord: 0.5, canard: true,
};

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

function wingHalf(span, rootChord, tipChord, thickness, material, sweep = 0, mirror = false) {
  // Tapered, round-tipped half wing, extruded so it has a real airfoil edge.
  // `sweep` slides the tip chord toward the tail (-Z after rotateX), so a
  // delta wing reads as one big swept triangle and a swept wing as a
  // classic fighter planform — never a straight prop-era wing.
  // `mirror` builds the -X half by negating the shape's X coordinates, so
  // the chord keeps its orientation (sweep still toward the tail) on both
  // sides. NEVER mirror with rotation.y = PI: that maps (x,y,z) ->
  // (-x,y,-z), flipping the chord so the -X tip sweeps toward the nose.
  const m = mirror ? -1 : 1;
  const shape = new THREE.Shape();
  shape.moveTo(m * 0, -rootChord / 2);
  shape.lineTo(m * (span - 0.9), -tipChord / 2 - sweep);
  shape.quadraticCurveTo(m * span, -sweep, m * (span - 0.9), tipChord / 2 - sweep);
  shape.lineTo(m * 0, rootChord / 2);
  shape.quadraticCurveTo(m * -0.25, 0, m * 0, -rootChord / 2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.08, bevelSegments: 2 });
  geo.rotateX(Math.PI / 2); // chord -> Z, thickness -> Y
  // After rotateX the slab sits low (y in [-thickness-0.03, +0.03]); shift it
  // up by half the thickness so the slab is centred on the chord plane.
  geo.translate(0, thickness / 2, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

/**
 * Build the jet; returns { group, afterburner, navLights, gear }.
 * `afterburner` is the flame-tongue group at the tail; main.js scales it
 * (small idle flicker, long bright tongues on SHIFT) and hides nothing else.
 * `variant` = { radius, length, wingY, pod, twinFin, span, sweep,
 * rootChord, tipChord, canard, livery }.
 * With no argument: the interceptor in the cream livery.
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

  // Fuselage: slim lathe profile with a pointed nose — a jet, not a
  // courier crate. Tail tip -> nose tip, then laid along Z.
  const profile = [
    [0.02, -4.2], [0.30, -4.05], [0.48, -3.6], [0.62, -2.9], [0.74, -2.0],
    [0.82, -1.0], [0.85, 0.0], [0.80, 0.9], [0.68, 1.9], [0.52, 2.9],
    [0.34, 3.6], [0.16, 4.2], [0.02, 4.55],
  ].map(([r, y]) => new THREE.Vector2(r * R, y * L));
  const fuselage = new THREE.Mesh(new THREE.LatheGeometry(profile, 28), cream);
  fuselage.rotation.x = Math.PI / 2; // axis -> Z, nose at +Z
  fuselage.castShadow = true;
  group.add(fuselage);

  // Belly cargo pod: a smooth capsule slung under the cabin (hauler only).
  if (v.pod > 0) {
    const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.55 * v.pod, 2.4, 6, 12), new THREE.MeshStandardMaterial({ color: '#b98a4e', roughness: 0.8 }));
    pod.rotation.x = Math.PI / 2;
    pod.position.set(0, -0.95 * R, 0.4 * L);
    pod.castShadow = true;
    group.add(pod);
  }

  // Canopy: a glass bubble sunk into the cabin top.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), glass);
  canopy.scale.set(0.7 * R, 0.55 * R, 1.4 * L);
  canopy.position.set(0, 0.68 * R, 1.15 * L);
  group.add(canopy);
  // Canopy frame: two thin hoops over the bubble.
  for (const z of [0.35, 1.55]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.66 * R, 0.05, 8, 24, Math.PI), dark);
    hoop.position.set(0, 0.62 * R, z * L);
    hoop.rotation.z = 0;
    group.add(hoop);
  }

  // Main wing: swept/delta, nearly flat (jets don't need prop dihedral).
  // wingHalf spans +X only, so the -X half is built mirrored (mirror=true);
  // rotation.z is side-signed so the dihedral lifts the tip on both sides.
  const DIHEDRAL = 0.05;
  const wingZ = -0.2 * L;
  const tipY = v.wingY + Math.sin(DIHEDRAL) * (v.span + 1.0);
  // Stripe-tip geometry, shared by the stripe mesh and the nav lights:
  // the stripe root is BURIED 0.7 m inside the main wingtip (overlap,
  // not a butt joint) and the stripe is lengthened by the same 0.7 m,
  // so its outer apex stays where it was. Apex |x| =
  // span - INSET + (LEN - 0.45) + 0.08 = span + 0.63, where 0.45 is how
  // far the quadratic tip curve pulls the apex back from its control
  // point and 0.08 is the extrude bevel. The old root-at-span joint left
  // a 0.06 m gap at mid-chord and ~0.9 m at the chord ends (the round
  // wingtip recedes), so the red read as a floating chip; burying the
  // root overlaps the cream across the full chord.
  const STRIPE_INSET = 0.7;
  const STRIPE_LEN = 1.7;
  const stripeApexX = v.span - STRIPE_INSET + (STRIPE_LEN - 0.45) + 0.08;
  for (const side of [-1, 1]) {
    const half = wingHalf(v.span, v.rootChord, v.tipChord, 0.16, creamPlain, v.sweep, side < 0);
    half.position.set(side * 0.1, v.wingY, wingZ);
    half.rotation.z = side * DIHEDRAL;
    group.add(half);
    // Stripe tip: root buried inside the wingtip (see STRIPE_INSET), same
    // dihedral, so its root sits at the main wing's tip height.
    const tip = wingHalf(STRIPE_LEN, v.tipChord, v.tipChord * 0.8, 0.17, stripe, 0, side < 0);
    tip.position.set(side * (v.span - STRIPE_INSET), tipY, wingZ - v.sweep);
    tip.rotation.z = side * DIHEDRAL;
    group.add(tip);
  }

  // Canard foreplanes (interceptor only): small swept surfaces by the nose.
  if (v.canard) {
    for (const side of [-1, 1]) {
      const canard = wingHalf(1.8, 0.9, 0.45, 0.1, creamPlain, 0.7, side < 0);
      canard.position.set(side * 0.1, 0.3 * R, 2.4 * L);
      canard.rotation.z = side * 0.05;
      group.add(canard);
    }
  }

  // Tail: swept stabilisers + fin(s), accent tips, registration plates.
  for (const side of [-1, 1]) {
    const stab = wingHalf(2.6, 1.25, 0.7, 0.11, creamPlain, 1.2, side < 0);
    stab.position.set(side * 0.08, 0.28 * R, -3.55 * L);
    stab.rotation.z = side * 0.05;
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

  // Twin afterburner: two steel nozzles at the tail + flame tongues.
  // Each flame is a short, wide outer orange cone around a bright yellow
  // core, tilted down-and-out so it clears the fuselage and reads from the
  // chase camera (a flame pointing straight back at the camera is just a
  // dot). A glowing disc caps each nozzle exit so the burner reads even
  // when the tongues are foreshortened. main.js scales the group — short
  // idle flicker, long bright tongues on afterburner.
  const afterburner = new THREE.Group();
  const flameOuterMat = new THREE.MeshBasicMaterial({
    color: '#ff7a1a', transparent: true, opacity: 0.85, depthWrite: false,
  });
  const flameInnerMat = new THREE.MeshBasicMaterial({
    color: '#ffd94a', transparent: true, opacity: 0.95, depthWrite: false,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: '#ff9a3d', transparent: true, opacity: 0.95, depthWrite: false,
  });
  // main.js scales the meshes themselves (never the group): scaling the
  // group would also shove the flames toward the chase camera, where they
  // project below the viewport. Positions stay fixed; only length/width
  // change between idle flicker and full afterburner.
  const abCones = [];
  const abGlows = [];
  for (const side of [-1, 1]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.7, 12), steel);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(side * 0.5 * R, -0.12, -4.2 * L);
    group.add(nozzle);
    const flame = new THREE.Group();
    flame.position.set(side * 0.5 * R, -0.12, -4.55 * L);
    // Level, slightly splayed: the chase camera sits close behind and
    // above, so anything tilted down or pushed a metre further back drops
    // below the viewport — the burner must live at the nozzle exit itself.
    flame.rotation.x = 0;
    flame.rotation.y = -side * 0.08; // splay outward
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.6, 12), flameOuterMat);
    outer.rotation.x = -Math.PI / 2; // cone tip -> -Z (backward)
    outer.position.z = -0.7;
    flame.add(outer);
    abCones.push(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 12), flameInnerMat);
    inner.rotation.x = -Math.PI / 2;
    inner.position.z = -0.5;
    flame.add(inner);
    abCones.push(inner);
    // Glow disc AT the nozzle exit (wider than the nozzle, so an orange
    // ring reads around the dark pipe even when the tongues foreshorten).
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), glowMat);
    glow.rotation.y = Math.PI; // face backward, toward the chase camera
    glow.position.z = -0.15;
    flame.add(glow);
    abGlows.push(glow);
    afterburner.add(flame);
  }
  afterburner.userData = { cones: abCones, glows: abGlows };
  group.add(afterburner);

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
  // red light sits at the +X tip and the green at the -X tip.
  // The bulb sits 0.05 m INSIDE the stripe's real outer apex
  // (stripeApexX = span + 0.63), so the r = 0.09 bulb intersects the red
  // tip instead of floating beyond it. NEVER span + 0.95 again: the
  // stripe apex never reached that far (it stops at span + 0.63).
  const tipX = stripeApexX - 0.05;
  const navLights = {};
  const lightGeo = new THREE.SphereGeometry(0.09, 8, 6);
  navLights.left = new THREE.Mesh(lightGeo, new THREE.MeshStandardMaterial({ color: '#ff2e2e', emissive: '#ff2e2e', emissiveIntensity: 2.5 }));
  navLights.left.position.set(tipX, tipY + 0.05, wingZ - v.sweep);
  navLights.right = new THREE.Mesh(lightGeo, new THREE.MeshStandardMaterial({ color: '#2eff5a', emissive: '#2eff5a', emissiveIntensity: 2.5 }));
  navLights.right.position.set(-tipX, tipY + 0.05, wingZ - v.sweep);
  navLights.tail = new THREE.Mesh(lightGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 2 }));
  navLights.tail.position.set(0, 0.12, -4.22 * L);
  group.add(navLights.left, navLights.right, navLights.tail);

  return { group, afterburner, navLights, gear };
}
