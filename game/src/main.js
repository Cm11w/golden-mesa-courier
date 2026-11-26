// Golden Mesa Courier — bootstrap and the render loop.
// One job: put the world on screen — scene, lights, chase camera, HUD,
// sound — and drive the frame loop. Play is interactive by default; with
// ?shot=leg1|leg2|leg3|landing&seed=1 the autopilot stages one frozen moment
// for a repeatable screenshot instead.

import * as THREE from 'three';
import { PALETTE, WORLD } from './config.js';
import { buildTerrain, groundHeightAt } from './terrain.js';
import { buildAircraft } from './aircraft.js';
import { buildRings } from './rings.js';
import { buildRunway } from './runway.js';
import { drawHud } from './hud.js';
import { buildAudio } from './audio.js';
import { createWorld, stepWorld, hudState } from './world.js';
import { autopilotInput } from './autopilot.js';
import { SHOT_IDS, stageShot, runStaging } from './shots.js';
import { createInput } from './input.js';

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
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.fog), 420, 1800);
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
const aircraft = buildAircraft();
scene.add(aircraft.group);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 6000);
const camPos = new THREE.Vector3(0, 110, -240);
const camTarget = new THREE.Vector3(0, 96, -160);
camera.position.copy(camPos);
camera.lookAt(camTarget);

// ---- State ----
let state = shotMode ? stageShot(shotId) : createWorld();
const input = createInput(canvas);
const audio = buildAudio();
let frame = 0;
let lookYaw = 0;
let lookPitch = 0;

function placeAircraft() {
  const g = aircraft.group;
  g.position.copy(state.pos);
  g.rotation.order = 'YXZ';
  g.rotation.y = state.heading;
  g.rotation.x = -state.pitch;
  g.rotation.z = -state.roll;
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
    state.pos.x - Math.sin(yaw) * 14,
    state.pos.y + 4.5,
    state.pos.z - Math.cos(yaw) * 14,
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
    state.pos.x - Math.sin(yaw) * 14,
    state.pos.y + 4.5 + lookPitch * 8,
    state.pos.z - Math.cos(yaw) * 14,
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
}

function handleEvents(events) {
  for (const e of events) {
    if (e === 'ring') audio.ring();
    else if (e === 'leg') audio.leg();
    else if (e === 'warn') audio.warn();
    else if (e === 'landed') audio.land();
    else if (e === 'thud') audio.thud();
  }
}

function renderFrame() {
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
  renderer.render(scene, camera);
  drawHud(hudCtx, hudState(state), hudCanvas.width, hudCanvas.height);
}

// ---- Shot mode: stage, freeze, flag ready ----
if (shotMode) {
  const events = runStaging(state, stepWorld);
  handleEvents(events);
  updateCamera(1);
  renderFrame();
  updateCamera(1);
  renderFrame();
  window.__shotReady = true;
  window.__gameReady = true;
} else {
  // ---- Interactive mode ----
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
    if (controls.restart && state.phase !== 'fly') {
      state = createWorld();
      resetCamera();
    }
    if (controls.gear) state.gearDown = !state.gearDown;
    if (state.phase === 'fly') {
      const events = stepWorld(state, controls, dt);
      handleEvents(events);
    }
    if (input.interacted) audio.unlock();
    audio.update(state.throttle, state.speed / 88);
    updateCamera(dt);
    renderFrame();
    window.__gameReady = true;
  }
  loop();
}
