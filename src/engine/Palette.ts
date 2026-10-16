/**
 * The film's colour discipline. Everything on screen should be drawn from
 * these ramps so the five scenes read as one production.
 *
 *  - Bunker: cold concrete greys, sodium-amber desk lamps, phosphor green.
 *  - Surface: near-black blues, wet slate, dead-sodium orange, rust.
 *  - Thermal: the classic black→violet→red→amber→white "ironbow" ramp.
 */

export const P = {
  // Absolute blacks and the darkest tones
  black: '#030405',
  ink: '#07090b',
  night: '#0a0d12',
  nightBlue: '#0e141d',
  deepBlue: '#131c28',

  // Concrete / bunker greys
  concrete0: '#15181a',
  concrete1: '#1f2326',
  concrete2: '#2b3034',
  concrete3: '#3a4044',
  concrete4: '#4c5358',
  concrete5: '#656d73',

  // Warm bunker light (sodium/incandescent)
  amber0: '#3a2a12',
  amber1: '#6b4a1c',
  amber2: '#a37428',
  amber3: '#d9a441',
  amber4: '#f3d58a',

  // Phosphor green (displays)
  phos0: '#0b1a12',
  phos1: '#12301c',
  phos2: '#1f5a30',
  phos3: '#38a04c',
  phos4: '#7fe08a',
  phos5: '#c8ffd0',

  // Alert reds
  red0: '#3a0a0a',
  red1: '#7a1410',
  red2: '#c0392b',
  red3: '#ff4a3a',
  red4: '#ffb3a7',

  // Caution yellow
  yellow1: '#7a6a12',
  yellow2: '#d6b534',
  yellow3: '#ffe66d',

  // Surface palette: wet slate, rust, sodium remnants
  slate0: '#0d1117',
  slate1: '#161d26',
  slate2: '#212a35',
  slate3: '#2e3a47',
  slate4: '#415062',
  slate5: '#5a6b7f',
  mist: '#7d8ea3',
  rust0: '#2a1a12',
  rust1: '#4a2a18',
  rust2: '#6d3f21',
  moss0: '#141c12',
  moss1: '#1f2d1a',
  moss2: '#2f4426',
  moss3: '#46613a',
  sodium: '#c57a2a',
  sodiumDim: '#6a4218',
  water0: '#070b11',
  water1: '#0d141d',
  water2: '#15212c',
  water3: '#213244',

  // Skin / clothing for operators (British/Scottish forces, 2033)
  skin0: '#4a3324',
  skin1: '#7a5538',
  skin2: '#a87a55',
  skin3: '#caa07a',
  skinPale1: '#7f6350',
  skinPale2: '#b3927a',
  skinPale3: '#d7bba2',
  uniform0: '#15190f',
  uniform1: '#232a18',
  uniform2: '#343d22',
  uniform3: '#4a5530',
  hair0: '#120d08',
  hair1: '#2c1f14',
  hair2: '#5a4530',
  hairGrey: '#8a8c86',

  // Creature
  flesh0: '#07060a',
  flesh1: '#14101a',
  flesh2: '#231a2a',
  flesh3: '#3b2b3b',
  bone: '#8a7f78',
  boneDim: '#5a524e',

  // Thermal ramp handled in Thermal.ts
  white: '#f4f1ea',
  paper: '#d9d2c4',
} as const;

export type PaletteKey = keyof typeof P;

/** "ironbow" thermal ramp — 0 cold, 1 hot. */
export const THERMAL_RAMP: string[] = [
  '#000004', '#06021a', '#12053a', '#230857', '#3a0a6e', '#52107a', '#6c1a7b', '#881f72',
  '#a12962', '#b8364f', '#cc4639', '#dc5a22', '#e8740f', '#f08f08', '#f6ab12', '#fac52d',
  '#fcdc55', '#fdee8e', '#fef9c6', '#ffffff',
];

/** Parses '#rrggbb' into [r,g,b]. */
export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export function shade(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * factor, g * factor, b * factor);
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
