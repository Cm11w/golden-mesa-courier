// Golden Mesa Courier — the home runway and its field.
// One job: the strip the courier lands on, with markings, lights, windsock
// and a little tower, so the final leg ends somewhere that reads as home.

import * as THREE from 'three';
import { PALETTE, WORLD } from './config.js';

function windsockTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const bands = ['#e8722a', '#f5e9c8', '#e8722a', '#f5e9c8'];
  for (let i = 0; i < 4; i += 1) {
    ctx.fillStyle = bands[i];
    ctx.fillRect(i * 32, 0, 32, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Build the runway field; returns { group, windsock, thresholdY }. */
export function buildRunway() {
  const group = new THREE.Group();
  const { x, z, y, length, width } = WORLD.runway;

  // Asphalt strip.
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(width, length),
    new THREE.MeshStandardMaterial({ color: '#33302e', roughness: 0.95 }),
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(x, y + 0.15, z);
  strip.receiveShadow = true;
  group.add(strip);

  // Centreline dashes + threshold bars + side stripes.
  const paint = new THREE.MeshBasicMaterial({ color: '#f5e9c8' });
  for (let d = -length / 2 + 30; d < length / 2 - 20; d += 44) {
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 18), paint);
    dash.rotation.x = -Math.PI / 2;
    dash.position.set(x, y + 0.3, z + d);
    group.add(dash);
  }
  for (const side of [-1, 1]) {
    for (const off of [-14, -7, 0, 7, 14]) {
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(4, 22), paint);
      bar.rotation.x = -Math.PI / 2;
      bar.position.set(x + off, y + 0.3, z + side * (length / 2 - 24));
      group.add(bar);
    }
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(1.2, length), paint);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(x + side * (width / 2 - 1.5), y + 0.3, z);
    group.add(edge);
  }
  // Runway number "36" painted at the southern threshold: the strip is
  // landed northbound (heading 180, -Z), and runway numbers are heading / 10.
  const numCanvas = document.createElement('canvas');
  numCanvas.width = 256; numCanvas.height = 128;
  const nctx = numCanvas.getContext('2d');
  nctx.fillStyle = '#f5e9c8';
  nctx.font = 'bold 96px Georgia, serif';
  nctx.textAlign = 'center';
  nctx.textBaseline = 'middle';
  nctx.fillText('36', 128, 68);
  const numTex = new THREE.CanvasTexture(numCanvas);
  numTex.colorSpace = THREE.SRGBColorSpace;
  const number = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 13),
    new THREE.MeshBasicMaterial({ map: numTex, transparent: true }),
  );
  number.rotation.x = -Math.PI / 2;
  number.rotation.z = Math.PI;
  number.position.set(x, y + 0.32, z + length / 2 - 62);
  group.add(number);

  // Edge lights: warm lamps on short posts down both sides.
  const lampMat = new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ffb347', emissiveIntensity: 2.2 });
  const postMat = new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.8 });
  for (let d = -length / 2 + 12; d <= length / 2 - 12; d += 52) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.4, 6), postMat);
      post.position.set(x + side * (width / 2 + 4), y + 1.2, z + d);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampMat);
      lamp.position.set(x + side * (width / 2 + 4), y + 2.6, z + d);
      group.add(post, lamp);
    }
  }

  // Windsock: striped cone on a mast, swinging with the wind.
  const windsock = new THREE.Group();
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 14, 8), postMat);
  mast.position.y = 7;
  windsock.add(mast);
  const sock = new THREE.Mesh(
    new THREE.ConeGeometry(1.7, 7.5, 12, 1, true),
    new THREE.MeshStandardMaterial({ map: windsockTexture(), side: THREE.DoubleSide, roughness: 0.8 }),
  );
  sock.rotation.z = Math.PI / 2;
  sock.position.set(3.9, 13.4, 0);
  windsock.add(sock);
  windsock.position.set(x + width / 2 + 26, y, z + length / 2 - 40);
  windsock.userData.sock = sock;
  group.add(windsock);

  // Little tower: drum cab on a tapering mast, glass band, blinking beacon.
  const tower = new THREE.Group();
  const mastMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.4, 26, 10), new THREE.MeshStandardMaterial({ color: '#c9b18a', roughness: 0.9 }));
  mastMesh.position.y = 13;
  mastMesh.castShadow = true;
  const cab = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 4.0, 5, 10),
    new THREE.MeshStandardMaterial({ color: '#8a6a52', roughness: 0.85 }),
  );
  cab.position.y = 28;
  const glassBand = new THREE.Mesh(
    new THREE.CylinderGeometry(4.65, 4.65, 2.4, 10, 1, true),
    new THREE.MeshPhongMaterial({ color: '#9fd8e8', transparent: true, opacity: 0.6, shininess: 100, side: THREE.DoubleSide }),
  );
  glassBand.position.y = 28;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.4, 10), new THREE.MeshStandardMaterial({ color: '#a85f38', roughness: 0.9 }));
  roof.position.y = 31.6;
  const beacon = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 6),
    new THREE.MeshStandardMaterial({ color: '#ff2e2e', emissive: '#ff2e2e', emissiveIntensity: 2.5 }),
  );
  beacon.position.y = 33.4;
  tower.add(mastMesh, cab, glassBand, roof, beacon);
  tower.position.set(x - width / 2 - 34, y, z + length / 2 - 60);
  tower.userData.beacon = beacon;
  group.add(tower);

  return { group, windsock, tower, thresholdY: y };
}
