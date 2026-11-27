// Golden Mesa Courier — keyboard + mouse input.
// One job: turn keys and the mouse into flight controls and camera looks.
// W/S throttle, arrows pitch and roll, SPACE airmail drop, R restart,
// G gear, C cockpit/chase view, ENTER/click to start from the title screen
// (and to fly again), drag to look.

export function createInput(canvas) {
  const keys = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let interacted = false;
  let clicked = false;

  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    interacted = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    interacted = true;
    clicked = true;
  });
  window.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    mouseDX += e.clientX - lastX;
    mouseDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('blur', () => keys.clear());

  return {
    /** Flight controls for this frame; `throttle` carries the current value. */
    read(throttle) {
      let next = throttle;
      if (keys.has('KeyW')) next = Math.min(1, next + 0.008);
      if (keys.has('KeyS')) next = Math.max(0, next - 0.008);
      const pitch = (keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0);
      const roll = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0);
      const restart = keys.has('KeyR');
      const gear = keys.has('KeyG');
      const cockpit = keys.has('KeyC');
      // Afterburner: hold either Shift (or B) — live, not edge-triggered.
      const afterburner = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyB');
      // Edge-triggered actions: consumed once per press, never held.
      const drop = keys.has('Space');
      const start = keys.has('Enter') || clicked;
      if (restart) keys.delete('KeyR');
      if (gear) keys.delete('KeyG');
      if (cockpit) keys.delete('KeyC');
      if (drop) keys.delete('Space');
      if (keys.has('Enter')) keys.delete('Enter');
      clicked = false;
      return { pitch, roll, throttle: next, restart, gear, cockpit, drop, start, afterburner };
    },
    /** Mouse look offset in radians; decays back to centre when released. */
    look() {
      const yaw = mouseDX * 0.0035;
      const pitch = mouseDY * 0.002;
      mouseDX *= 0.86;
      mouseDY *= 0.86;
      return { yaw, pitch };
    },
    get interacted() {
      return interacted;
    },
  };
}
