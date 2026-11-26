// Golden Mesa Courier — the instrument panel and callouts.
// One job: draw the whole HUD on a 2D overlay canvas: top bar, leg panel,
// compass, bottom dials, fuel, throttle, and the big in-scene callouts.
// The dials are drawn with ticks, numbers and needles — never blank squares.

import { DROP_COUNT, FUEL_RING_BONUS, LEGS, LOW_FUEL_AT, RING_COUNT } from './config.js';

const CREAM = '#f5e9c8';
const GOLD = '#ffc23d';
// Solid, not translucent: at 0.82 alpha a distant fog-tinted cloud showed
// through the top bar as a dark olive smudge behind HDG (leg1 + leg2 shots),
// and the next ring's 3D GATE label ghosted through the callout banner.
// Opaque panels keep the sky out of the instruments entirely.
const PANEL = 'rgba(10, 38, 46, 1)';
const LINE = '#3f7d8c';
const RED = '#ff5a4e';
const GREEN = '#7ee2a0';

function panel(ctx, x, y, w, h, radius = 10) {
  ctx.fillStyle = PANEL;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function dial(ctx, cx, cy, r, label, sub) {
  panel(ctx, cx - r - 8, cy - r - 8, (r + 8) * 2, (r + 8) * 2, (r + 8));
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0e2f38';
  ctx.fill();
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  // Tick ring.
  for (let i = 0; i <= 12; i += 1) {
    const a = -Math.PI * 0.75 + (i / 12) * Math.PI * 1.5;
    const major = i % 3 === 0;
    ctx.strokeStyle = major ? CREAM : 'rgba(245, 233, 200, 0.55)';
    ctx.lineWidth = major ? 2.5 : 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - (major ? 12 : 8)), cy + Math.sin(a) * (r - (major ? 12 : 8)));
    ctx.lineTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
    ctx.stroke();
  }
  ctx.fillStyle = CREAM;
  ctx.font = 'bold 11px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + r + 24);
  if (sub) {
    ctx.font = '10px Georgia, serif';
    ctx.fillStyle = 'rgba(245, 233, 200, 0.7)';
    ctx.fillText(sub, cx, cy + r + 38);
  }
}

function needle(ctx, cx, cy, r, angle, color = GOLD, width = 3) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angle) * (r - 14), cy + Math.sin(angle) * (r - 14));
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
}

/** Personal best: staged shots carry a fixed one; interactive play reads
 *  and writes localStorage (guarded — some embeds block it). */
function personalBest(s) {
  if (s.personalBest > 0) return s.personalBest;
  try {
    return Number(window.localStorage.getItem('golden-mesa-best') || 0) || 0;
  } catch (err) {
    return 0;
  }
}

function savePersonalBest(s) {
  if (s.staged) return;
  try {
    const prev = Number(window.localStorage.getItem('golden-mesa-best') || 0) || 0;
    if (s.score > prev) window.localStorage.setItem('golden-mesa-best', String(s.score));
  } catch (err) { /* storage unavailable — the best still shows this run */ }
}

/** Draw the HUD for one frame. `s` is the world state, `w`/`h` the canvas
 *  size. `gateScreen` (optional) is the next gate's projected screen
 *  position { x, y, visible, dist, label } for the off-screen edge arrow. */
export function drawHud(ctx, s, w, h, gateScreen) {
  ctx.clearRect(0, 0, w, h);
  const leg = LEGS[s.leg];
  const timeLeft = Math.max(0, s.timeLimit - s.elapsed);
  const mm = Math.floor(timeLeft / 60);
  const ss = String(Math.floor(timeLeft % 60)).padStart(2, '0');

  // ---- Top bar ----
  panel(ctx, 12, 10, w - 24, 56, 10);
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'left';
  ctx.font = 'bold 24px Georgia, serif';
  ctx.fillText('GOLDEN MESA', 28, 36);
  ctx.font = '11px Georgia, serif';
  ctx.fillStyle = 'rgba(245, 233, 200, 0.75)';
  ctx.fillText('N427GM · COURIER', 28, 54);
  const stats = [
    ['ALT', `${Math.round(s.altitudeFt)}`, 'FT'],
    ['SPD', `${Math.round(s.speedKt)}`, 'KT'],
    ['HDG', `${String(Math.round(s.headingDeg)).padStart(3, '0')}°`, ''],
    ['SCORE', String(s.score).padStart(6, '0'), ''],
    ['RINGS', `${s.ringsCleared} / ${RING_COUNT}`, ''],
    ['DROPS', `${s.dropsDone} / ${DROP_COUNT}`, ''],
    ['TIME', `${mm}:${ss}`, ''],
    ['CARGO', `${s.cargoKg} KG`, ''],
  ];
  let sx = 300;
  for (const [label, value, unit] of stats) {
    ctx.textAlign = 'left';
    ctx.font = '10px Georgia, serif';
    ctx.fillStyle = 'rgba(245, 233, 200, 0.7)';
    ctx.fillText(label, sx, 28);
    ctx.font = 'bold 24px Georgia, serif';
    ctx.fillStyle = CREAM;
    ctx.fillText(value, sx, 54);
    if (unit) {
      ctx.font = '11px Georgia, serif';
      ctx.fillStyle = 'rgba(245, 233, 200, 0.7)';
      ctx.fillText(unit, sx + ctx.measureText(value).width + 6, 54);
    }
    sx += 118;
  }

  // ---- Leg panel (left, under the bar) ----
  panel(ctx, 12, 78, 218, 74, 10);
  ctx.textAlign = 'left';
  ctx.font = '11px Georgia, serif';
  ctx.fillStyle = 'rgba(245, 233, 200, 0.75)';
  ctx.fillText(`${leg.tag} · N427GM`, 26, 100);
  ctx.font = 'bold 20px Georgia, serif';
  ctx.fillStyle = GOLD;
  ctx.fillText(leg.name, 26, 126);
  ctx.font = '12px Georgia, serif';
  ctx.fillStyle = CREAM;
  ctx.fillText(`RING ${Math.min(s.ringsCleared + 1, RING_COUNT)} / ${RING_COUNT}`, 26, 144);
  for (let i = 0; i < RING_COUNT; i += 1) {
    ctx.fillStyle = i < s.ringsCleared ? GREEN : 'rgba(245, 233, 200, 0.35)';
    ctx.beginPath();
    ctx.arc(150 + i * 7, 140, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Compass strip (top centre) ----
  panel(ctx, w / 2 - 190, 78, 380, 34, 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(w / 2 - 190, 78, 380, 34);
  ctx.clip();
  ctx.fillStyle = CREAM;
  ctx.font = '13px Georgia, serif';
  ctx.textAlign = 'center';
  for (let deg = -60; deg <= 60; deg += 10) {
    const hdg = (Math.round(s.headingDeg) + deg + 360) % 360;
    const x = w / 2 + deg * 2.6;
    // Heading 0 faces +Z (south, back down the course) and 180 faces -Z
    // (north, up the course); 90 is east (+X), 270 west (-X).
    const label = hdg === 0 ? 'S' : hdg === 90 ? 'E' : hdg === 180 ? 'N' : hdg === 270 ? 'W' : String(hdg);
    ctx.fillText(label, x, 101);
    ctx.fillRect(x - 0.5, 82, 1, deg % 30 === 0 ? 8 : 4);
  }
  ctx.restore();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 7, 78);
  ctx.lineTo(w / 2 + 7, 78);
  ctx.lineTo(w / 2, 88);
  ctx.fill();

  // ---- Airframe / wind panel (right) ----
  panel(ctx, w - 230, 78, 218, 74, 10);
  ctx.textAlign = 'left';
  ctx.font = '12px Georgia, serif';
  ctx.fillStyle = CREAM;
  ctx.fillText(`AIRFRAME   ${s.airframe}%`, w - 216, 104);
  ctx.fillStyle = s.crosswind > 0 ? GOLD : CREAM;
  // Crosswind is stored in m/s; the HUD reports knots (1 m/s = 1.944 kt):
  // leg 2 shows 8 kt, leg 3 shows 16 kt — the same numbers the banners use.
  ctx.fillText(s.crosswind > 0 ? `WIND  ${Math.round(s.crosswind * 1.94384)} KT XWIND` : 'WIND  CALM', w - 216, 130);
  ctx.fillStyle = 'rgba(245, 233, 200, 0.7)';
  ctx.fillText(s.phase === 'landed' ? 'ON THE GROUND' : `GEAR ${s.gearDown ? 'DOWN' : 'UP'}`, w - 216, 146);

  // ---- Bottom instrument cluster ----
  const by = h - 128;
  // One continuous dashboard strip behind the whole cluster, so the
  // instruments read as a cockpit panel instead of floating boxes.
  // It runs to the bottom edge so the dial labels sit on the panel too.
  panel(ctx, 12, by - 14, w - 24, 140, 12);
  // Throttle bar (left).
  panel(ctx, 12, by - 8, 150, 104, 10);
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px Georgia, serif';
  ctx.fillStyle = CREAM;
  ctx.fillText('THROTTLE', 26, by + 12);
  ctx.fillStyle = '#123a44';
  ctx.fillRect(26, by + 24, 122, 14);
  ctx.fillStyle = GOLD;
  ctx.fillRect(26, by + 24, 122 * s.throttle, 14);
  ctx.font = 'bold 16px Georgia, serif';
  ctx.fillText(`${Math.round(s.throttle * 100)}%`, 26, by + 62);
  ctx.font = '11px Georgia, serif';
  ctx.fillStyle = 'rgba(245, 233, 200, 0.7)';
  ctx.fillText('W / S', 26, by + 82);

  // Airspeed dial.
  dial(ctx, 260, by + 42, 46, 'AIRSPEED', 'KNOTS');
  const spdAngle = -Math.PI * 0.75 + (Math.min(180, s.speedKt) / 180) * Math.PI * 1.5;
  needle(ctx, 260, by + 42, 46, spdAngle);
  ctx.fillStyle = CREAM;
  ctx.font = 'bold 20px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(s.speedKt)), 260, by + 58);

  // Attitude / horizon.
  dial(ctx, 400, by + 42, 46, 'ATTITUDE', `V/S ${s.verticalSpeedFpm >= 0 ? '+' : ''}${Math.round(s.verticalSpeedFpm)} FT/MIN`);
  ctx.save();
  ctx.beginPath();
  ctx.arc(400, by + 42, 46, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(400, by + 42);
  ctx.rotate(-s.roll);
  ctx.translate(0, s.pitch * 120);
  ctx.fillStyle = '#7fb6d9';
  ctx.fillRect(-50, -50, 100, 50);
  ctx.fillStyle = '#8a5a34';
  ctx.fillRect(-50, 0, 100, 50);
  ctx.fillStyle = CREAM;
  ctx.fillRect(-50, -1, 100, 2);
  ctx.restore();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(400 - 18, by + 42);
  ctx.lineTo(400 + 18, by + 42);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(400, by + 42, 46, 0, Math.PI * 2);
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Altimeter dial.
  dial(ctx, 540, by + 42, 46, 'ALTIMETER', 'FEET');
  const altAngle = -Math.PI * 0.75 + ((s.altitudeFt % 1000) / 1000) * Math.PI * 1.5;
  needle(ctx, 540, by + 42, 46, altAngle);
  ctx.fillStyle = CREAM;
  ctx.font = 'bold 18px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.round(s.altitudeFt)), 540, by + 58);

  // Fuel gauge (right).
  panel(ctx, w - 230, by - 8, 218, 104, 10);
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px Georgia, serif';
  ctx.fillStyle = s.fuel <= LOW_FUEL_AT ? RED : CREAM;
  ctx.fillText('FUEL', w - 216, by + 12);
  ctx.fillStyle = '#123a44';
  ctx.fillRect(w - 216, by + 24, 190, 14);
  ctx.fillStyle = s.fuel <= LOW_FUEL_AT ? RED : s.fuel <= 45 ? GOLD : GREEN;
  ctx.fillRect(w - 216, by + 24, 190 * (s.fuel / 100), 14);
  ctx.font = 'bold 16px Georgia, serif';
  ctx.fillStyle = CREAM;
  ctx.fillText(`${Math.round(s.fuel)}%`, w - 216, by + 62);
  ctx.font = '11px Georgia, serif';
  ctx.fillStyle = 'rgba(245, 233, 200, 0.7)';
  ctx.fillText(s.fuel <= LOW_FUEL_AT ? 'LOW FUEL — LAND SOON' : `RINGS TOP UP +${FUEL_RING_BONUS}%`, w - 216, by + 82);

  // ---- Callout banner (centre, under the compass; flight only) ----
  if (s.phase === 'fly' && s.callout && s.calloutUntil > s.elapsed) {
    const alpha = Math.min(1, (s.calloutUntil - s.elapsed) / 0.8);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 30px Georgia, serif';
    const tw = ctx.measureText(s.callout).width;
    panel(ctx, w / 2 - tw / 2 - 26, 128, tw + 52, 48, 10);
    ctx.fillStyle = s.calloutDanger ? RED : GOLD;
    ctx.textAlign = 'center';
    ctx.fillText(s.callout, w / 2, 160);
    ctx.restore();
  }

  // ---- Hint line (first 10 seconds of flight, then it gets out of the way) ----
  if (s.phase === 'fly' && s.elapsed < 10) {
    ctx.fillStyle = 'rgba(245, 233, 200, 0.85)';
    ctx.font = '14px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('W / S — THROTTLE · ← / → — BANK · ↑ / ↓ — PITCH · SPACE — AIRMAIL DROP', w / 2, h - 148);
  }

  // ---- Off-screen gate arrow: when the next gate is out of frame, point at it ----
  if (s.phase === 'fly' && gateScreen && !gateScreen.visible && s.ringsCleared < RING_COUNT) {
    const cx = w / 2;
    const cy = h / 2;
    const ang = Math.atan2(gateScreen.y - cy, gateScreen.x - cx);
    const ex = cx + Math.cos(ang) * (w / 2 - 70);
    const ey = cy + Math.sin(ang) * (h / 2 - 170);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -13);
    ctx.lineTo(-12, 13);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 16px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(gateScreen.label, ex, ey + 34);
  }

  // ---- Title screen ----
  if (s.phase === 'title') {
    ctx.fillStyle = 'rgba(8, 26, 32, 0.55)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText('GOLDEN MESA', w / 2, h / 2 - 150);
    ctx.fillStyle = CREAM;
    ctx.font = 'bold 26px Georgia, serif';
    ctx.fillText('C O U R I E R   ·   N 4 2 7 G M', w / 2, h / 2 - 108);
    ctx.font = '20px Georgia, serif';
    ctx.fillText('A golden-hour mail run through the canyon — 12 gates, 3 legs, land her gently.', w / 2, h / 2 - 62);
    ctx.font = '18px Georgia, serif';
    ctx.fillStyle = 'rgba(245, 233, 200, 0.9)';
    const controls = [
      'W / S — THROTTLE      ← / → — ROLL      ↑ / ↓ — PITCH',
      'G — GEAR      SPACE — AIRMAIL DROP      R — RETRY',
    ];
    controls.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 - 8 + i * 30));
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 26px Georgia, serif';
    const blink = 0.65 + 0.35 * Math.sin((s.titleTime || 0) * 3);
    ctx.save();
    ctx.globalAlpha = blink;
    ctx.fillText('PRESS ENTER TO FLY', w / 2, h / 2 + 78);
    ctx.restore();
    ctx.fillStyle = 'rgba(245, 233, 200, 0.75)';
    ctx.font = '15px Georgia, serif';
    ctx.fillText('or click anywhere to fly', w / 2, h / 2 + 108);
  }

  // ---- End screens ----
  if (s.phase === 'landed' || s.phase === 'over') {
    const best = Math.max(personalBest(s), s.score);
    savePersonalBest(s);
    ctx.fillStyle = 'rgba(8, 26, 32, 0.62)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    if (s.phase === 'landed') {
      ctx.fillStyle = GOLD;
      ctx.font = 'bold 44px Georgia, serif';
      ctx.fillText('A GOLDEN TOUCHDOWN', w / 2, h / 2 - 148);
      ctx.fillStyle = CREAM;
      ctx.font = '20px Georgia, serif';
      ctx.fillText(`LANDING ${s.landingGrade} · CARGO DELIVERED ${s.cargoKg} KG`, w / 2, h / 2 - 112);
      // The final score, big in the middle.
      ctx.fillStyle = GOLD;
      ctx.font = 'bold 84px Georgia, serif';
      ctx.fillText(String(s.score).padStart(6, '0'), w / 2, h / 2 - 18);
      ctx.fillStyle = 'rgba(245, 233, 200, 0.75)';
      ctx.font = '15px Georgia, serif';
      ctx.fillText('F I N A L   S C O R E', w / 2, h / 2 + 8);
      // Breakdown: three columns.
      const cols = [
        ['GATES', `${s.ringsCleared} / ${RING_COUNT}`],
        ['TIME LEFT', `${mm}:${ss}`],
        ['LANDING', s.landingGrade],
      ];
      cols.forEach(([label, value], i) => {
        const cx = w / 2 + (i - 1) * 220;
        ctx.fillStyle = 'rgba(245, 233, 200, 0.7)';
        ctx.font = '13px Georgia, serif';
        ctx.fillText(label, cx, h / 2 + 52);
        ctx.fillStyle = CREAM;
        ctx.font = 'bold 28px Georgia, serif';
        ctx.fillText(value, cx, h / 2 + 88);
      });
      ctx.fillStyle = GOLD;
      ctx.font = 'bold 22px Georgia, serif';
      ctx.fillText(`LANDING BONUS  +${s.landingBonus}`, w / 2, h / 2 + 128);
      ctx.fillStyle = CREAM;
      ctx.font = '20px Georgia, serif';
      ctx.fillText(`PERSONAL BEST  ${String(best).padStart(6, '0')}`, w / 2, h / 2 + 160);
    } else {
      ctx.fillStyle = GOLD;
      ctx.font = 'bold 44px Georgia, serif';
      ctx.fillText('THE CANYON KEEPS THE MAIL', w / 2, h / 2 - 148);
      ctx.fillStyle = CREAM;
      ctx.font = '20px Georgia, serif';
      ctx.fillText(s.overReason, w / 2, h / 2 - 112);
      ctx.fillStyle = GOLD;
      ctx.font = 'bold 84px Georgia, serif';
      ctx.fillText(String(s.score).padStart(6, '0'), w / 2, h / 2 - 18);
      ctx.fillStyle = 'rgba(245, 233, 200, 0.75)';
      ctx.font = '15px Georgia, serif';
      ctx.fillText('S C O R E', w / 2, h / 2 + 8);
      ctx.fillStyle = CREAM;
      ctx.font = 'bold 28px Georgia, serif';
      ctx.fillText(`GATES  ${s.ringsCleared} / ${RING_COUNT}`, w / 2, h / 2 + 56);
      ctx.font = '20px Georgia, serif';
      ctx.fillText(`PERSONAL BEST  ${String(best).padStart(6, '0')}`, w / 2, h / 2 + 96);
    }
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillText('ENTER / CLICK · FLY AGAIN', w / 2, h / 2 + 196);
  }
}
