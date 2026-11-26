// Golden Mesa Courier — keyboard + mouse input.
// One job: turn keys and the mouse into flight controls and camera looks.
// W/S throttle, arrows pitch and roll, R restart, G gear, drag to look.

export function createInput(canvas) {
  const keys = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let interacted = false;

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
      if (restart) keys.delete('KeyR');
      if (gear) keys.delete('KeyG');
      return { pitch, roll, throttle: next, restart, gear };
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
