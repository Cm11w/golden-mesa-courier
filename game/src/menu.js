// Golden Mesa Courier — the main menu and the results screen.
// One job: the DOM overlays the canvas game cannot draw itself — the title
// screen (aircraft picker, livery picker, live 3D preview, controls, START)
// and the end-of-sortie panel (grade, score, FLY AGAIN / MAIN MENU).
// Same visual language as the HUD: dark teal panels, gold text, Georgia.

import * as THREE from 'three';
import { buildAircraft } from './aircraft.js';
import {
  AIRCRAFT_MODELS, LIVERIES, liveryFromColor, liveryById, loadSelection,
  modelById, saveSelection, variantFor,
} from './livery.js';

const CSS = `
#gmc-menu, #gmc-results { position: fixed; inset: 0; z-index: 10; display: none;
  font-family: Georgia, serif; color: #f5e9c8; }
#gmc-menu.show, #gmc-results.show { display: flex; }
#gmc-menu { background: linear-gradient(90deg, rgba(8,26,32,0.90) 0%, rgba(8,26,32,0.55) 52%, rgba(8,26,32,0.78) 100%);
  padding: 28px 36px; gap: 28px; }
.gmc-col { display: flex; flex-direction: column; }
.gmc-left { width: 500px; flex: none; }
.gmc-right { flex: 1; min-width: 0; }
.gmc-title { font-size: 46px; font-weight: bold; color: #ffc23d; line-height: 1.02; margin: 2px 0 4px; letter-spacing: 1px; }
.gmc-sub { font-size: 16px; color: rgba(245,233,200,0.85); margin: 0 0 14px; }
.gmc-box { background: rgba(10,38,46,0.92); border: 1.5px solid #3f7d8c; border-radius: 10px;
  padding: 12px 16px; margin-bottom: 12px; }
.gmc-box h3 { margin: 0 0 6px; font-size: 13px; letter-spacing: 2px; color: #ffc23d; }
.gmc-box p { margin: 4px 0; font-size: 15px; line-height: 1.45; }
.gmc-box .dim { color: rgba(245,233,200,0.7); font-size: 13px; }
.gmc-keys { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; font-size: 14px; }
.gmc-keys b { color: #ffc23d; font-weight: bold; white-space: nowrap; }
#gmc-start { margin-top: auto; background: #ffc23d; color: #0a262e; border: none; border-radius: 10px;
  font: bold 24px Georgia, serif; letter-spacing: 2px; padding: 14px 0; cursor: pointer; }
#gmc-start:hover { background: #ffd45e; }
.gmc-hint { text-align: center; font-size: 12px; color: rgba(245,233,200,0.6); margin-top: 8px; }
.gmc-cards { display: flex; gap: 10px; }
.gmc-card { flex: 1; background: rgba(10,38,46,0.92); border: 1.5px solid #3f7d8c; border-radius: 10px;
  padding: 10px 8px 8px; cursor: pointer; text-align: center; }
.gmc-card.active { border-color: #ffc23d; box-shadow: 0 0 0 2px #ffc23d inset; }
.gmc-card svg { width: 100%; height: 64px; }
.gmc-card .nm { font-weight: bold; font-size: 16px; color: #ffc23d; margin-top: 4px; }
.gmc-card .ds { font-size: 12px; color: rgba(245,233,200,0.75); line-height: 1.3; margin-top: 2px; }
.gmc-swatches { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.gmc-swatch { width: 38px; height: 38px; border-radius: 50%; border: 2px solid rgba(245,233,200,0.4);
  cursor: pointer; padding: 0; }
.gmc-swatch.active { border-color: #ffc23d; box-shadow: 0 0 0 3px #ffc23d; }
.gmc-custom { display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(245,233,200,0.8); }
.gmc-custom input[type=color] { width: 38px; height: 38px; border: 2px solid rgba(245,233,200,0.4);
  border-radius: 50%; padding: 0; background: none; cursor: pointer; }
#gmc-preview-wrap { position: relative; flex: 1; min-height: 0; margin-top: 12px;
  background: rgba(10,38,46,0.92); border: 1.5px solid #3f7d8c; border-radius: 10px; overflow: hidden; }
#gmc-preview { width: 100%; height: 100%; display: block; }
#gmc-preview-label { position: absolute; left: 12px; bottom: 10px; font-size: 14px; color: #ffc23d;
  text-shadow: 0 1px 3px #000; pointer-events: none; }
#gmc-results { background: rgba(8,26,32,0.72); align-items: center; justify-content: center; }
.gmc-panel { background: rgba(10,38,46,0.96); border: 1.5px solid #3f7d8c; border-radius: 14px;
  padding: 28px 40px; text-align: center; min-width: 520px; }
.gmc-panel h1 { margin: 0 0 6px; font-size: 40px; color: #ffc23d; }
.gmc-grade { font-size: 30px; font-weight: bold; color: #7ee2a0; margin: 6px 0 12px; letter-spacing: 2px; }
.gmc-grade.bad { color: #ff5a4e; }
.gmc-rows { font-size: 20px; line-height: 1.7; margin-bottom: 20px; }
.gmc-rows b { color: #ffc23d; }
.gmc-btns { display: flex; gap: 12px; justify-content: center; }
.gmc-btns button { font: bold 20px Georgia, serif; padding: 12px 26px; border-radius: 10px; cursor: pointer; }
#gmc-again { background: #ffc23d; color: #0a262e; border: none; }
#gmc-again:hover { background: #ffd45e; }
#gmc-tomenu { background: transparent; color: #f5e9c8; border: 1.5px solid #3f7d8c; }
#gmc-tomenu:hover { border-color: #ffc23d; }
`;

// Side-view silhouettes for the aircraft cards (schematic jet, one per model).
function silhouette(modelId) {
  const common = '<circle cx="168" cy="34" r="13" fill="none" stroke="#ffc23d" stroke-width="2.5"/>';
  if (modelId === 'racer') {
    // STRIKE: swept wing, single fin, pointed nose, twin flame.
    return `<svg viewBox="0 0 180 70"><path d="M20 40 L150 34 L168 38 L150 44 L20 46 Z" fill="#f5e9c8"/><path d="M70 38 L118 12 L124 38 Z" fill="#c22e2e"/><path d="M96 34 L112 8 L118 34 Z" fill="#e8722a"/><path d="M14 38 L2 34 L2 42 L14 42 Z" fill="#ff7a1a"/>${common}</svg>`;
  }
  if (modelId === 'hauler') {
    // HAULER: fat body, wide wing, twin fins, cargo pod, twin flame.
    return `<svg viewBox="0 0 180 70"><ellipse cx="90" cy="38" rx="62" ry="16" fill="#f5e9c8"/><rect x="48" y="12" width="84" height="5" rx="2" fill="#c22e2e"/><path d="M34 28 L52 10 L56 28 Z" fill="#e8722a"/><path d="M126 28 L144 10 L148 28 Z" fill="#e8722a"/><ellipse cx="90" cy="56" rx="26" ry="7" fill="#b98a4e"/><path d="M14 38 L2 34 L2 42 L14 42 Z" fill="#ff7a1a"/>${common}</svg>`;
  }
  // INTERCEPTOR: big delta wing, canards, pointed nose, twin flame.
  return `<svg viewBox="0 0 180 70"><path d="M22 40 L150 34 L168 38 L150 44 L22 46 Z" fill="#f5e9c8"/><path d="M58 38 L132 14 L138 38 Z" fill="#c22e2e"/><path d="M128 32 L146 20 L148 32 Z" fill="#e8722a"/><path d="M14 38 L2 34 L2 42 L14 42 Z" fill="#ff7a1a"/>${common}</svg>`;
}

/** Build the menu + results overlays. Returns the controller main.js uses. */
export function createMenu(hooks) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const menuEl = document.createElement('div');
  menuEl.id = 'gmc-menu';
  menuEl.innerHTML = `
    <div class="gmc-col gmc-left">
      <div class="gmc-title">GOLDEN MESA<br>COURIER</div>
      <p class="gmc-sub">A golden-hour mail run through the canyon — thread the rings in your jet, land her gently. Callsign N427GM.</p>
      <div class="gmc-box">
        <h3>THE MISSION</h3>
        <p>Fly <b>3 legs</b> — Canyon Run, River Bend, Mesa Gates — and thread <b>12 golden rings</b> in order. Every ring tops up your fuel. Then land on the desert strip: centreline + gentle touchdown earns <b>PERFECT</b>.</p>
        <p class="dim">Watch the fuel: the tank only just covers the course. Rings are your lifeline.</p>
      </div>
      <div class="gmc-box">
        <h3>CONTROLS</h3>
        <div class="gmc-keys">
          <b>W / S</b><span>Throttle up / down</span>
          <b>← →</b><span>Roll / turn</span>
          <b>↑ ↓</b><span>Pitch up / down</span>
          <b>SPACE</b><span>Drop the mail on a golden circle</span>
          <b>SHIFT</b><span>Afterburner — +35% speed, 3× fuel burn</span>
          <b>G</b><span>Landing gear</span>
          <b>R</b><span>Restart sortie</span>
          <b>Drag</b><span>Look around</span>
        </div>
      </div>
      <button id="gmc-start" type="button">▶&nbsp; START FLIGHT</button>
      <div class="gmc-hint">or press Enter — pick your plane and colour first, on the right</div>
    </div>
    <div class="gmc-col gmc-right">
      <div class="gmc-box">
        <h3>PILIH PESAWAT</h3>
        <div class="gmc-cards" id="gmc-cards"></div>
      </div>
      <div class="gmc-box">
        <h3>WARNA PESAWAT</h3>
        <div class="gmc-swatches" id="gmc-swatches"></div>
      </div>
      <div id="gmc-preview-wrap">
        <canvas id="gmc-preview"></canvas>
        <div id="gmc-preview-label"></div>
      </div>
    </div>`;
  document.body.appendChild(menuEl);

  const resultsEl = document.createElement('div');
  resultsEl.id = 'gmc-results';
  resultsEl.innerHTML = `
    <div class="gmc-panel">
      <h1 id="gmc-res-title">A GOLDEN TOUCHDOWN</h1>
      <div class="gmc-grade" id="gmc-res-grade">PERFECT</div>
      <div class="gmc-rows" id="gmc-res-rows"></div>
      <div class="gmc-btns">
        <button id="gmc-again" type="button">FLY AGAIN</button>
        <button id="gmc-tomenu" type="button">MAIN MENU</button>
      </div>
    </div>`;
  document.body.appendChild(resultsEl);

  let selection = loadSelection();
  let previewVisible = false;
  let previewRaf = 0;

  // ---- Preview renderer (its own small scene, the chosen plane turning) ----
  const previewCanvas = menuEl.querySelector('#gmc-preview');
  const previewLabel = menuEl.querySelector('#gmc-preview-label');
  const previewRenderer = new THREE.WebGLRenderer({ canvas: previewCanvas, antialias: true, preserveDrawingBuffer: true });
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const previewScene = new THREE.Scene();
  previewScene.background = new THREE.Color('#0d2f38');
  previewScene.add(new THREE.HemisphereLight('#e8956d', '#3a2a22', 1.1));
  const previewSun = new THREE.DirectionalLight('#ffb347', 2.0);
  previewSun.position.set(6, 10, 8);
  previewScene.add(previewSun);
  const previewCam = new THREE.PerspectiveCamera(42, 1.6, 0.1, 100);
  previewCam.position.set(11, 3.5, 12);
  previewCam.lookAt(0, 0.3, 0);
  let previewPlane = null;
  let previewAngle = 0.6;

  function sizePreview() {
    const wrap = menuEl.querySelector('#gmc-preview-wrap');
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w > 0 && h > 0) {
      previewRenderer.setSize(w, h, false);
      previewCam.aspect = w / h;
      previewCam.updateProjectionMatrix();
    }
  }

  function rebuildPreview() {
    if (previewPlane) {
      previewScene.remove(previewPlane.group);
      previewPlane = null;
    }
    previewPlane = buildAircraft(variantFor(selection));
    previewPlane.gear.visible = true;
    previewPlane.group.rotation.y = previewAngle;
    previewScene.add(previewPlane.group);
    const model = modelById(selection.model);
    const livery = liveryById(selection.livery);
    previewLabel.textContent = `${model.name} · ${livery.name}`;
  }

  function renderPreviewOnce() {
    sizePreview();
    if (!previewPlane) rebuildPreview();
    previewAngle += 0.02;
    previewPlane.group.rotation.y = previewAngle;
    // Idle afterburner flicker in the preview: short tongues, gentle pulse.
    const f = 0.55 + 0.12 * Math.sin(previewAngle * 6);
    for (const c of previewPlane.afterburner.userData.cones) c.scale.set(f, 0.7, f);
    for (const g of previewPlane.afterburner.userData.glows) g.scale.set(f, f, 1);
    previewRenderer.render(previewScene, previewCam);
  }

  function previewLoop() {
    if (!previewVisible) return;
    renderPreviewOnce();
    previewRaf = requestAnimationFrame(previewLoop);
  }

  // ---- Cards + swatches ----
  const cardsEl = menuEl.querySelector('#gmc-cards');
  for (const model of AIRCRAFT_MODELS) {
    const card = document.createElement('div');
    card.className = 'gmc-card';
    card.dataset.model = model.id;
    card.innerHTML = `${silhouette(model.id)}<div class="nm">${model.name}</div><div class="ds">${model.desc}</div>`;
    card.addEventListener('click', () => {
      selection = { ...selection, model: model.id };
      saveSelection(selection);
      refreshSelection();
      hooks.onSelectionChange(selection);
    });
    cardsEl.appendChild(card);
  }

  const swatchesEl = menuEl.querySelector('#gmc-swatches');
  for (const livery of LIVERIES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gmc-swatch';
    btn.dataset.livery = livery.id;
    btn.title = livery.name;
    btn.style.background = livery.swatch;
    btn.addEventListener('click', () => {
      selection = { ...selection, livery: livery.id };
      saveSelection(selection);
      refreshSelection();
      hooks.onSelectionChange(selection);
    });
    swatchesEl.appendChild(btn);
  }
  const customWrap = document.createElement('label');
  customWrap.className = 'gmc-custom';
  customWrap.innerHTML = `<input type="color" id="gmc-custom-color" value="#c22e2e"> Kustom`;
  customWrap.querySelector('input').addEventListener('input', (e) => {
    const livery = liveryFromColor(e.target.value);
    selection = { ...selection, livery: livery.id };
    saveSelection(selection);
    refreshSelection();
    hooks.onSelectionChange(selection);
  });
  swatchesEl.appendChild(customWrap);

  function refreshSelection() {
    cardsEl.querySelectorAll('.gmc-card').forEach((c) => {
      c.classList.toggle('active', c.dataset.model === selection.model);
    });
    swatchesEl.querySelectorAll('.gmc-swatch').forEach((b) => {
      b.classList.toggle('active', b.dataset.livery === selection.livery);
    });
    rebuildPreview();
  }

  // ---- Buttons + keys ----
  menuEl.querySelector('#gmc-start').addEventListener('click', () => hooks.onStart(selection));
  resultsEl.querySelector('#gmc-again').addEventListener('click', () => hooks.onFlyAgain());
  resultsEl.querySelector('#gmc-tomenu').addEventListener('click', () => hooks.onMainMenu());
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && menuEl.classList.contains('show')) hooks.onStart(selection);
  });
  window.addEventListener('resize', () => { if (previewVisible) sizePreview(); });

  refreshSelection();

  return {
    getSelection() {
      return { ...selection };
    },
    setSelection(next) {
      selection = { model: modelById(next.model).id, livery: liveryById(next.livery).id };
      saveSelection(selection);
      refreshSelection();
    },
    showMenu() {
      resultsEl.classList.remove('show');
      menuEl.classList.add('show');
      previewVisible = true;
      sizePreview();
      cancelAnimationFrame(previewRaf);
      previewLoop();
      window.__menuReady = true;
    },
    hideMenu() {
      menuEl.classList.remove('show');
      previewVisible = false;
      cancelAnimationFrame(previewRaf);
    },
    showResults(s) {
      menuEl.classList.remove('show');
      previewVisible = false;
      cancelAnimationFrame(previewRaf);
      const title = resultsEl.querySelector('#gmc-res-title');
      const grade = resultsEl.querySelector('#gmc-res-grade');
      const rows = resultsEl.querySelector('#gmc-res-rows');
      if (s.phase === 'landed') {
        title.textContent = 'A GOLDEN TOUCHDOWN';
        grade.textContent = `LANDING GRADE · ${s.landingGrade}`;
        grade.classList.remove('bad');
        rows.innerHTML = `GATES <b>${s.ringsCleared} / 12</b><br>CARGO DELIVERED <b>${s.cargoKg} KG</b><br>AIRMAIL <b>${s.dropsDone ?? 0} / 4 · +${s.dropBonusTotal ?? 0}</b><br>HULL <b>${s.hull ?? 100}%</b><br>SCORE <b>${String(s.score).padStart(6, '0')}</b>`;
      } else {
        const crashed = (s.overReason || '').includes('HULL BREACH');
        title.textContent = crashed ? 'HULL BREACH' : 'SORTIE OVER';
        grade.textContent = s.overReason || 'SORTIE OVER';
        grade.classList.add('bad');
        rows.innerHTML = `GATES <b>${s.ringsCleared} / 12</b><br>AIRMAIL <b>${s.dropsDone ?? 0} / 4 · +${s.dropBonusTotal ?? 0}</b><br>HULL <b>${s.hull ?? 100}%</b><br>SCORE <b>${String(s.score).padStart(6, '0')}</b>`;
      }
      resultsEl.classList.add('show');
    },
    hideResults() {
      resultsEl.classList.remove('show');
    },
    renderPreviewOnce,
  };
}
