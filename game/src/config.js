// Golden Mesa Courier — shared constants: course, legs, physics, palette.
// One job: every number the rest of the game agrees on lives here.

export const WORLD = {
  seed: 1337, // terrain noise seed (terrain.js builds from this)
  // Course runs north (-Z) from the start line to the home runway.
  start: { x: 0, y: 205, z: 120 },
  startHeading: Math.PI, // facing -Z (north)
  runway: { x: 0, z: -3620, y: 120, length: 420, width: 46, heading: Math.PI },
  courseLength: 3740,
  timeLimit: 240, // seconds on the mission clock
};

export const LEGS = [
  {
    name: 'CANYON RUN',
    tag: 'LEG 1 / 3',
    rings: 4,
    cargoKg: 24,
    crosswind: 0, // m/s, from the west
    callout: 'CANYON RUN — THREAD THE GOLDEN GATES',
  },
  {
    name: 'RIVER BEND',
    tag: 'LEG 2 / 3',
    rings: 4,
    cargoKg: 60,
    crosswind: 4, // m/s from the west = 8 kt on the HUD
    callout: 'RIVER BEND — THE WIND IS UP',
  },
  {
    name: 'MESA GATES',
    tag: 'LEG 3 / 3',
    rings: 4,
    cargoKg: 144,
    crosswind: 8, // m/s from the west = 16 kt on the HUD
    callout: 'MESA GATES — HOLD YOUR LINE',
  },
];

export const RING_COUNT = 12;
export const RING_RADIUS = 24; // pass when within 92% (22.1 m) of the centre
// Ring award: 1000 + 100 * (leg + 1) + time bonus (world.js); a gate also
// tops the tank up by FUEL_RING_BONUS. No leg-completion bonus is awarded.
export const FUEL_RING_BONUS = 2; // % topped up at each gate station
export const LOW_FUEL_AT = 25; // % — LOW FUEL banner
// Aircraft identity, carried on the livery and lifted into the HUD/title.
export const CALLSIGN = 'N427GM';
export const SHIP_NAME = 'GOLDEN MESA';
// Airmail drop targets: [x, z, label] per leg — a painted circle on the
// ground where SPACE drops the mail. 1 in leg 1, 2 in leg 2, 1 in leg 3.
export const DROP_SPOTS = [
  [[40, -800, 'CANYON POST']],
  [[140, -1900, 'RIVER POST'], [40, -2400, 'BEND POST']],
  [[190, -3100, 'MESA POST']],
];
export const DROP_RADIUS = 25; // m — the painted target circle
export const DROP_COUNT = 4;

export const PALETTE = {
  skyTop: '#4a2a68',
  skyMid: '#b34a6b',
  skyLow: '#ff9a52',
  skyDusk: '#e8956d',
  fog: '#c97a63',
  sun: '#ffb347',
  sunCore: '#fff3c4',
  sunGlow: '#ffb347',
  sandLight: '#e8b06a',
  sand: '#d99a55',
  sandDark: '#b97a45',
  mesaTop: '#c98a4b',
  mesaBandA: '#a85f38',
  mesaBandB: '#7d4a30',
  rock: '#8a6a52',
  river: '#2fa8b8',
  riverDeep: '#1d7f92',
  cactus: '#3e7d4a',
  cactusDark: '#2c5c36',
  tree: '#4a7d3a',
  treeLight: '#6da24a',
  cloud: '#ffd9c2',
  gold: '#ffc23d',
  goldDeep: '#e8960f',
  cream: '#f5e9c8',
  panel: 'rgba(10, 38, 46, 0.82)',
  panelLine: '#3f7d8c',
  danger: '#ff5a4e',
  ok: '#7ee2a0',
};

// Waypoints the river (and the course) winds through, from south to north.
export const RIVER_PATH = [
  [0, 200],
  [140, -300],
  [-120, -800],
  [180, -1300],
  [40, -1800],
  [-190, -2300],
  [120, -2800],
  [-40, -3300],
  [0, -3700],
];

// Ring gates: [x, y, z] centres, laid along the course in leg order.
export const RING_SPOTS = [
  // Leg 1 — Canyon Run
  [60, 215, -280],
  [-70, 235, -620],
  [90, 225, -980],
  [-40, 245, -1330],
  // Leg 2 — River Bend
  [120, 230, -1680],
  [-90, 250, -2010],
  [60, 235, -2330],
  [-110, 255, -2640],
  // Leg 3 — Mesa Gates
  [80, 260, -2930],
  [-60, 275, -3170],
  [40, 250, -3380],
  [0, 225, -3560],
];

// Mesa plateaus: [x, z, radius, height] — kept clear of the ring line.
export const MESAS = [
  [-420, -500, 260, 120],
  [480, -900, 300, 150],
  [-520, -1500, 280, 130],
  [540, -1900, 320, 170],
  [-460, -2500, 300, 150],
  [500, -2900, 280, 140],
  [-380, -3300, 240, 110],
];

// Far mountain ring: [angle, distance, height, radius]
export const PEAKS = [
  [0.4, 2600, 520, 700],
  [1.1, 2800, 640, 800],
  [1.9, 2500, 480, 650],
  [2.6, 2900, 700, 850],
  [3.4, 2700, 560, 750],
  [4.2, 2800, 610, 800],
  [5.0, 2600, 500, 700],
  [5.8, 2900, 660, 820],
];
