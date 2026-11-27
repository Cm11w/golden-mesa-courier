// Golden Mesa Courier — the cockpit.
// One job: the frame a pilot sees from the canopy. A dark dashboard panel
// with a glareshield hood, a cream nose cowling sloping away below it, and
// two canopy pillars + a top bar framing the view. The group is a child of
// the camera (camera local space: ahead is -Z), so it rides with the view
// and never needs per-frame positioning. The live gauges (IAS, ALT, THR,
// HULL) are drawn by the 2D HUD in cockpit mode, sitting on this panel —
// crisper than canvas textures, and they reuse the HUD's own dials.
// The aircraft itself is HIDDEN in cockpit mode (main.js): the camera
// would otherwise sit inside the fuselage and the lathe interior fills
// the frame. The nose cowling here is the nose the pilot sees.
// Sizes are computed from the camera FOV (58° vertical): at z = -0.9 the
// visible half-height is ~0.5 m, half-width ~0.89 m — every part is placed
// inside that window, or it never shows.

import * as THREE from 'three';

/** Build the cockpit frame; returns { group }. Attach to the camera. */
export function buildCockpit() {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: '#1c2626', roughness: 0.85, metalness: 0.1 });
  const darker = new THREE.MeshStandardMaterial({ color: '#121a1a', roughness: 0.9, metalness: 0.05 });
  const cream = new THREE.MeshStandardMaterial({ color: '#faf3dd', roughness: 0.55, metalness: 0.08 });
  const goldTrim = new THREE.MeshStandardMaterial({ color: '#ffc23d', roughness: 0.4, metalness: 0.4 });

  // Dashboard: wide panel across the lower view, top edge at ~70% screen
  // height (y = -0.2 at z = -0.9), bleeding off both sides and below the
  // frame. Short enough that the nose cowling shows over it.
  const dash = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.34, 0.22), dark);
  dash.position.set(0, -0.37, -0.9);
  dash.rotation.x = 0.12; // tilted back toward the pilot
  group.add(dash);
  // Gold pinstripe along the dashboard top edge.
  const trim = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.03, 0.02), goldTrim);
  trim.position.set(0, -0.19, -0.82);
  trim.rotation.x = 0.12;
  group.add(trim);

  // Glareshield: a hood over the dashboard top, jutting toward the pilot
  // so the panel reads as a real coaming, not a floating slab.
  const shield = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 0.3), darker);
  shield.position.set(0, -0.14, -0.78);
  shield.rotation.x = 0.28;
  group.add(shield);

  // Nose cowling: cream, sloping down-forward, tall enough that its top
  // crests over the dashboard (top at y = -0.375, above the dashboard's
  // -0.2 top edge on the sightline), so the pilot sits behind a visible
  // nose instead of a black slab.
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.65, 2.2), cream);
  nose.position.set(0, -0.7, -1.9);
  nose.rotation.x = 0.42;
  group.add(nose);
  // Cowling centre stripe (the livery cheatline continues over the nose).
  const noseStripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 2.2), new THREE.MeshStandardMaterial({ color: '#c22e2e', roughness: 0.5 }));
  noseStripe.position.set(0, -0.36, -1.9);
  noseStripe.rotation.x = 0.42;
  group.add(noseStripe);

  // Canopy pillars + top bar: thin dark struts framing the view, inside
  // the visible window (half-width 0.89 m at z = -0.85).
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), darker);
    pillar.position.set(side * 0.72, 0.1, -0.85);
    pillar.rotation.z = -side * 0.08;
    group.add(pillar);
  }
  const topBar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.07), darker);
  topBar.position.set(0, 0.44, -0.85);
  group.add(topBar);

  group.visible = false;
  return { group };
}
