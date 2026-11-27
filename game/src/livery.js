// Golden Mesa Courier — aircraft models, liveries, and the player's choice.
// One job: what the menu offers (3 models, 6 preset colours + a custom
// picker), and remembering the choice in localStorage so it survives a
// return to the menu. Pure data + tiny helpers; no DOM, no THREE, so the
// node tests can import it too.

export const AIRCRAFT_MODELS = [
  {
    id: 'courier',
    name: 'INTERCEPTOR',
    desc: 'Jet delta · tercepat · lincah di ring',
    // Shape knobs read by buildAircraft(): fuselage radius/length scale,
    // wing height, cargo pod size (0 = none), twin tail fins, wing span,
    // leading-edge sweep (m) and canard foreplanes.
    radius: 0.85,
    length: 1.1,
    wingY: 0.15,
    pod: 0,
    twinFin: false,
    span: 5.2,
    sweep: 3.2,
    rootChord: 3.4,
    tipChord: 0.5,
    canard: true,
  },
  {
    id: 'racer',
    name: 'STRIKE',
    desc: 'Jet swept-wing · seimbang · serbaguna',
    radius: 0.8,
    length: 1.12,
    wingY: 0.05,
    pod: 0,
    twinFin: false,
    span: 6.0,
    sweep: 1.8,
    rootChord: 2.2,
    tipChord: 0.9,
    canard: false,
  },
  {
    id: 'hauler',
    name: 'HAULER',
    desc: 'Jet kargo · badan besar · sirip ganda',
    radius: 1.2,
    length: 1.0,
    wingY: 0.15,
    pod: 1.35,
    twinFin: true,
    span: 7.2,
    sweep: 1.0,
    rootChord: 2.6,
    tipChord: 1.2,
    canard: false,
  },
];

// A livery is the paint the fuselage texture, fin and accents wear:
// base = fuselage body, stripe = cheatline, accent = fin / spinner / tips.
export const LIVERIES = [
  { id: 'cream', name: 'Krem Emas', swatch: '#e8722a', base: '#faf3dd', stripe: '#c22e2e', accent: '#e8722a' },
  { id: 'red', name: 'Merah', swatch: '#c22e2e', base: '#e59a8a', stripe: '#c22e2e', accent: '#c22e2e' },
  { id: 'blue', name: 'Biru', swatch: '#2563eb', base: '#9db8dd', stripe: '#2563eb', accent: '#2563eb' },
  { id: 'green', name: 'Hijau', swatch: '#2e7d32', base: '#a4c9a4', stripe: '#2e7d32', accent: '#2e7d32' },
  { id: 'purple', name: 'Ungu', swatch: '#7c3aed', base: '#c3aee0', stripe: '#7c3aed', accent: '#7c3aed' },
  { id: 'black', name: 'Hitam', swatch: '#1c1a18', base: '#c9c9c9', stripe: '#1c1a18', accent: '#1c1a18' },
];

export const DEFAULT_MODEL = 'courier';
export const DEFAULT_LIVERY = 'cream';

const STORAGE_KEY = 'gmc-aircraft-v1';

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mix a colour toward white by `amount` (0 = unchanged, 1 = white). */
export function lighten(hex, amount) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** A custom colour from the picker becomes a full livery. */
export function liveryFromColor(hex) {
  const safe = /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : '#c22e2e';
  return {
    id: `custom:${safe}`,
    name: 'Kustom',
    swatch: safe,
    base: lighten(safe, 0.62),
    stripe: safe,
    accent: safe,
  };
}

export function modelById(id) {
  return AIRCRAFT_MODELS.find((m) => m.id === id) || AIRCRAFT_MODELS[0];
}

export function liveryById(id) {
  if (typeof id === 'string' && id.startsWith('custom:')) return liveryFromColor(id.slice(7));
  return LIVERIES.find((l) => l.id === id) || LIVERIES[0];
}

export function loadSelection() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { model: DEFAULT_MODEL, livery: DEFAULT_LIVERY };
    const parsed = JSON.parse(raw);
    return {
      model: modelById(parsed.model).id,
      livery: liveryById(parsed.livery).id,
    };
  } catch {
    return { model: DEFAULT_MODEL, livery: DEFAULT_LIVERY };
  }
}

export function saveSelection(selection) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // Private mode / no storage: the choice still applies this session.
  }
}

/** The buildAircraft() variant for a selection: model params + livery. */
export function variantFor(selection) {
  const model = modelById(selection.model);
  const livery = liveryById(selection.livery);
  return { ...model, livery };
}
