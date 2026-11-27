// Golden Mesa Courier — bootstrap and the render loop.
// One job: put the world on screen — scene, lights, chase camera, HUD,
// sound — and drive the frame loop. Play is interactive by default; with
// ?shot=leg1|leg2|leg3|landing|menu|results&seed=1 the autopilot stages one
// frozen moment for a repeatable screenshot instead.
//
// Screens: 'menu' (title + aircraft/livery picker over a parked plane),
// 'game' (flying), 'results' (end-of-sortie panel). Shot mode bypasses the
// menu so the staged screenshots show the moment itself.

import * as THREE from 'three';
import { PALETTE, WORLD } from './config.js';
import { buildTerrain, groundHeightAt } from './terrain.js';
import { buildAircraft } from './aircraft.js';
import { buildRings } from './rings.js';
import { buildRunway } from './runway.js';
import { drawHud } from './hud.js';
import { buildAudio } from './audio.js';
import { createWorld, dropPackage, stepWorld, hudState } from './world.js';
import { autopilotInput } from './autopilot.js';
import { SHOT_IDS, stageShot, runStaging } from './shots.js';
import { createInput } from './input.js';
import { createMenu } from './menu.js';
import { loadSelection, liveryById, modelById, variantFor } from './livery.js';
import { buildDrops } from './drops.js';

const params = new URLSearchParams(window.location.search);
const shotId = params.get('shot');
const shotMode = SHOT_IDS.includes(shotId);
const seed = Number.parseInt(params.get('seed') || '1', 10) || 1;
void seed; // terrain is seeded from config; the seed rides along for the record.

// ---- Renderer ----
const canvas = document.getElementById('game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
} catch (err) {
  // No WebGL (old browser, blocked GPU): show the fallback note instead of a
  // blank page. The rest of the module never runs without a renderer.
  const fallback = document.getElementById('fallback');
  if (fallback) fallback.style.display = 'flex';
  throw err;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const hudCanvas = document.getElementById('hud');
const hudCtx = hudCanvas.getContext('2d');
function sizeHud() {
  hudCanvas.width = window.innerWidth;
  hudCanvas.height = window.innerHeight;
}
sizeHud();

// ---- Scene ----
const scene = new THREE.Scene();
// Far fog so the layered peaks read on the horizon instead of being
// swallowed: the purple ridge ring is the depth the top entries show.
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.fog), 600, 4200);
const hemi = new THREE.HemisphereLight(PALETTE.skyDusk, '#7a5a44', 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -160;
sun.shadow.camera.right = 160;
sun.shadow.camera.top = 160;
sun.shadow.camera.bottom = -160;
sun.shadow.camera.far = 700;
scene.add(sun, sun.target);

const terrain = buildTerrain();
scene.add(terrain.group);
const rings = buildRings();
scene.add(rings.group);
const runway = buildRunway();
scene.add(runway.group);
const drops = buildDrops();
scene.add(drops.group);

// ---- Aircraft + selection ----
// The menu's choice (or ?model=/?color= overrides, used by the screenshots)
// decides which plane is built; changing it rebuilds the plane in place.
let selection = loadSelection();
const urlModel = params.get('model');
const urlColor = params.get('color');
if (urlModel && modelById(urlModel).id === urlModel) selection = { ...selection, model: urlModel };
if (urlColor) {
  const livery = /^#[0-9a-fA-F]{6}$/.test(urlColor)
    ? { id: `custom:${urlColor.toLowerCase()}` }
    : liveryById(urlColor);
  selection = { ...selection, livery: livery.id };
}
let aircraft = buildAircraft(variantFor(selection));
scene.add(aircraft.group);

function rebuildAircraft(sel) {
  selection = { ...sel };
  scene.remove(aircraft.group);
  aircraft = buildAircraft(variantFor(selection));
  scene.add(aircraft.group);
  placeAircraft();
}

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 6000);
const camPos = new THREE.Vector3(0, 110, -240);
const camTarget = new THREE.Vector3(0, 96, -160);
camera.position.copy(camPos);
camera.lookAt(camTarget);

// ---- State ----
let state = shotMode ? stageShot(shotId) : createWorld();
let screen = shotMode ? 'shot' : 'menu'; // menu | game | results | shot
const input = createInput(canvas);
const audio = buildAudio();
let frame = 0;
let lookYaw = 0;
let lookPitch = 0;
let menuAngle = 0.6;

function placeAircraft() {
  const g = aircraft.group;
  g.position.copy(state.pos);
  g.rotation.order = 'YXZ';
  g.rotation.y = state.heading;
  g.rotation.x = -state.pitch;
  g.rotation.z = state.roll;
  // The gear shows only when it is down (the HUD says GEAR UP in flight).
  aircraft.gear.visible = state.gearDown;
  aircraft.propeller.rotation.z += 0.5;
  aircraft.propeller.rotation.z %= Math.PI * 2;
}

function resetCamera() {
  // Snap the chase camera behind the (fresh) plane so a restart does not
  // leave the camera flying back from the crash site for seconds.
  const yaw = state.heading;
  camPos.set(
    state.pos.x - Math.sin(yaw) * 12.5,
    state.pos.y + 4.2,
    state.pos.z - Math.cos(yaw) * 12.5,
  );
  camTarget.set(
    state.pos.x + Math.sin(yaw) * 40,
    state.pos.y,
    state.pos.z + Math.cos(yaw) * 40,
  );
  lookYaw = 0;
  lookPitch = 0;
}

function updateCamera(dt) {
  const fwd = new THREE.Vector3(Math.sin(state.heading), 0, Math.cos(state.heading));
  const look = input.look();
  lookYaw = THREE.MathUtils.clamp(lookYaw + look.yaw, -1.1, 1.1);
  lookPitch = THREE.MathUtils.clamp(lookPitch + look.pitch, -0.35, 0.5);
  if (!shotMode) {
    lookYaw *= Math.max(0, 1 - dt * 0.8);
    lookPitch *= Math.max(0, 1 - dt * 0.8);
  }
  const yaw = state.heading + lookYaw;
  const behind = new THREE.Vector3(
    state.pos.x - Math.sin(yaw) * 12.5,
    state.pos.y + 4.2 + lookPitch * 8,
    state.pos.z - Math.cos(yaw) * 12.5,
  );
  const ground = groundHeightAt(behind.x, behind.z) + 3;
  if (behind.y < ground) behind.y = ground;
  camPos.lerp(behind, 1 - Math.exp(-dt * 5));
  camera.position.copy(camPos);
  const ahead = new THREE.Vector3(
    state.pos.x + Math.sin(yaw) * 40,
    state.pos.y + Math.sin(state.pitch) * 24 + lookPitch * 10,
    state.pos.z + Math.cos(yaw) * 40,
  );
  camTarget.lerp(ahead, 1 - Math.exp(-dt * 7));
  camera.lookAt(camTarget);
  // The sun shadow follows the plane so the canyon stays lit near us.
  sun.position.set(state.pos.x + 140, state.pos.y + 190, state.pos.z - 90);
  sun.target.position.copy(state.pos);
  // The sunset disc rides ahead-left of the plane, low on the horizon, so
  // every shot has the golden-hour sun in frame (the top entries all do).
  // It is a flat disc, so it turns to face the camera each frame.
  terrain.sun.position.set(state.pos.x - 1050, state.pos.y + 420, state.pos.z - 1750);
  terrain.sun.lookAt(camera.position);
}

function menuCamera(dt) {
  // Slow orbit around the parked plane: the menu backdrop is a living scene,
  // not a still. The sun disc rides along so the golden hour stays in frame.
  menuAngle += dt * 0.12;
  const r = 17;
  camera.position.set(
    state.pos.x + Math.sin(menuAngle) * r,
    state.pos.y + 5.5,
    state.pos.z + Math.cos(menuAngle) * r,
  );
  camera.lookAt(state.pos.x, state.pos.y + 0.5, state.pos.z);
  sun.position.set(state.pos.x + 140, state.pos.y + 190, state.pos.z - 90);
  sun.target.position.copy(state.pos);
  terrain.sun.position.set(state.pos.x - 1050, state.pos.y + 420, state.pos.z - 1750);
  terrain.sun.lookAt(camera.position);
}

function handleEvents(events) {
  for (const e of events) {
    if (e === 'ring') audio.ring();
    else if (e === 'leg') audio.leg();
    else if (e === 'warn') audio.warn();
    else if (e === 'landed') audio.land();
    else if (e === 'thud') audio.thud();
    else if (e === 'drop') audio.drop();
  }
}

function renderFrame(withHud = true) {
  frame += 1;
  placeAircraft();
  const nextRing = state.ringsCleared < 12 ? rings.rings[state.ringsCleared] : null;
  // Cleared rings turn green so the course shows how far the sortie has got.
  rings.rings.forEach((ring, i) => { ring.cleared = i < state.ringsCleared; });
  rings.update(state.pos, nextRing, state.elapsed);
  if (nextRing && frame % 10 === 0) {
    rings.setLabelDistance(nextRing, state.pos.distanceTo(nextRing.centre));
  }
  // Windsock swings with the leg wind; tower beacon blinks.
  runway.windsock.rotation.y = Math.sin(state.elapsed * 0.7) * 0.4 + 0.6;
  runway.tower.userData.beacon.material.emissiveIntensity = 1.5 + 1.5 * Math.sin(state.elapsed * 3);
  // Drop targets follow the world drop state (done = green, next = pulsing)
  // and the parcels follow the falling mail.
  drops.update(state, state.elapsed);
  renderer.render(scene, camera);
  if (withHud) drawHud(hudCtx, hudState(state), hudCanvas.width, hudCanvas.height);
  else hudCtx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
}

// ---- Menu + results (interactive mode only; shot mode stages directly) ----
const menu = createMenu({
  onStart(sel) {
    rebuildAircraft(sel);
    state = createWorld();
    resetCamera();
    menu.hideMenu();
    menu.hideResults();
    screen = 'game';
  },
  onFlyAgain() {
    state = createWorld();
    resetCamera();
    menu.hideResults();
    screen = 'game';
  },
  onMainMenu() {
    state = createWorld();
    resetCamera();
    menu.hideResults();
    menu.showMenu();
    screen = 'menu';
  },
  onSelectionChange(sel) {
    rebuildAircraft(sel);
  },
});
menu.setSelection(selection);

// Test hooks (used by the CDP flow test, not by the game itself).
window.__gmc = {
  screen: () => screen,
  phase: () => state.phase,
  score: () => state.score,
  grade: () => state.landingGrade,
  rings: () => state.ringsCleared,
  selection: () => ({ ...selection }),
  pos: () => [state.pos.x, state.pos.y, state.pos.z],
  start: () => menuElStart(),
  resultsVisible: () => !!document.querySelector('#gmc-results.show'),
  menuVisible: () => !!document.querySelector('#gmc-menu.show'),
  // Test hook: jump the interactive game straight to the results screen
  // (landed, PERFECT) so the panel + R restart can be exercised without
  // flying the whole 144 s course in the test.
  forceResults: () => {
    state.phase = 'landed';
    state.landingGrade = 'PERFECT';
    state.ringsCleared = 12;
    state.score = 16670;
    state.cargoKg = 144;
  },
};
function menuElStart() {
  const btn = document.querySelector('#gmc-start');
  if (btn) btn.click();
}

// ---- Shot mode: stage, freeze, flag ready ----
if (shotMode) {
  if (shotId === 'menu') {
    // Title screen: parked plane, showcase camera, menu overlay, no HUD.
    menu.showMenu();
    menu.renderPreviewOnce();
    menu.renderPreviewOnce();
    menu.renderPreviewOnce();
    const p = state.pos;
    camera.position.set(p.x + 13, p.y + 4.5, p.z - 12);
    camera.lookAt(p.x, p.y + 0.5, p.z);
    terrain.sun.position.set(p.x - 1050, p.y + 420, p.z - 1750);
    terrain.sun.lookAt(camera.position);
    sun.position.set(p.x + 140, p.y + 190, p.z - 90);
    sun.target.position.copy(p);
    renderFrame(false);
    renderFrame(false);
    window.__shotReady = true;
    window.__gameReady = true;
  } else if (shotId === 'results') {
    // End of sortie: fly the final approach to touchdown, then the results panel.
    const events = runStaging(state, stepWorld);
    handleEvents(events);
    updateCamera(1);
    renderFrame();
    updateCamera(1);
    renderFrame();
    menu.showResults(state);
    window.__shotReady = true;
    window.__gameReady = true;
  } else {
    const events = runStaging(state, stepWorld);
    handleEvents(events);
    updateCamera(1);
    renderFrame();
    updateCamera(1);
    renderFrame();
    window.__shotReady = true;
    window.__gameReady = true;
  }
} else {
  // ---- Interactive mode ----
  menu.showMenu();
  const clock = new THREE.Clock();
  window.addEventListener('keydown', () => audio.unlock(), { once: true });
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    sizeHud();
  });

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const controls = input.read(state.throttle);
    if (screen === 'menu') {
      menuCamera(dt);
      renderFrame(false);
      window.__gameReady = true;
      return;
    }
    if (controls.restart && state.phase !== 'fly') {
      state = createWorld();
      resetCamera();
      menu.hideResults();
      screen = 'game';
    }
    // Enter (or a click) on the results screen flies again — same as the
    // FLY AGAIN button. The menu screen itself handles Enter in menu.js,
    // so it is deliberately not repeated here (one press = one start).
    if (screen === 'results' && controls.start) {
      document.querySelector('#gmc-again')?.click();
    }
    if (controls.gear && screen === 'game') state.gearDown = !state.gearDown;
    if (screen === 'game' && state.phase === 'fly') {
      // SPACE drops the mail — edge-triggered, only while flying.
      if (controls.drop) {
        const bonus = dropPackage(state);
        if (bonus !== null) handleEvents(['drop']);
      }
      const events = stepWorld(state, controls, dt);
      handleEvents(events);
    }
    if (screen === 'game' && (state.phase === 'landed' || state.phase === 'over')) {
      menu.showResults(state);
      screen = 'results';
    }
    if (input.interacted) audio.unlock();
    audio.update(state.throttle, state.speed / 88);
    updateCamera(dt);
    renderFrame();
    window.__gameReady = true;
  }
  loop();
}
