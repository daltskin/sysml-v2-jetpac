// ── ZX Spectrum-style pixel art sprite renderer ──
// All sprites are drawn procedurally — no external assets needed

export type SpriteName =
  | 'spaceman_idle'
  | 'spaceman_walk1'
  | 'spaceman_walk2'
  | 'spaceman_thrust'
  | 'spaceman_carry'
  | 'rocket_base'
  | 'rocket_mid'
  | 'rocket_top'
  | 'rocket_assembled'
  | 'fuel_cell'
  | 'laser'
  | 'gem'
  | 'alien1'
  | 'alien2'
  | 'alien3'
  | 'alien4'
  | 'alien5'
  | 'alien6'
  | 'alien7'
  | 'alien8'
  | 'explosion_particle'
  | 'thrust_flame'
  | 'star'
  | 'flag';

// ZX Spectrum bright colours + extended palette
const C = {
  black: '#000000',
  blue: '#0044ff',
  red: '#ff2222',
  magenta: '#ff44ff',
  green: '#00ee33',
  cyan: '#00ddff',
  yellow: '#ffee00',
  white: '#ffffff',
  darkBlue: '#0022aa',
  darkRed: '#bb1111',
  darkGreen: '#009922',
  darkCyan: '#009999',
  darkYellow: '#ccaa00',
  grey: '#bbbbbb',
  orange: '#ff8800',
  // Extended
  gold: '#ffdd44',
  darkGold: '#cc9900',
  skin: '#ffcc88',
  darkOrange: '#cc5500',
  lightGrey: '#dddddd',
  darkGrey: '#666666',
  navy: '#001166',
  pink: '#ff88bb',
  lightGreen: '#66ff66',
  silver: '#ccccdd',
  darkSilver: '#9999aa',
  skyBlue: '#44aaff',
  purple: '#8833cc',
  darkPurple: '#5511aa',
  lime: '#aaff00',
};

type PixelGrid = (string | null)[][];

function drawPixelGrid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  grid: PixelGrid,
  scale: number = 1,
  flipX: boolean = false
) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  // Pass 1 — 8-bit style: black outline around every filled pixel
  ctx.fillStyle = '#000000';
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      if (!grid[row][col]) continue;
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = row + dr, nc = col + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || !grid[nr]?.[nc]) {
          const drawC = flipX ? cols - 1 - nc : nc;
          ctx.fillRect(
            Math.floor(x + drawC * scale),
            Math.floor(y + nr * scale),
            scale,
            scale
          );
        }
      }
    }
  }

  // Pass 2 — actual sprite pixels on top
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const colour = grid[row][col];
      if (!colour) continue;
      const drawCol = flipX ? grid[row].length - 1 - col : col;
      ctx.fillStyle = colour;
      ctx.fillRect(
        Math.floor(x + drawCol * scale),
        Math.floor(y + row * scale),
        scale,
        scale
      );
    }
  }
}

// ── Colour shorthand ──
const _ = null;
const W = C.white;
const B = C.blue;
const R = C.red;
const Y = C.yellow;
const Cy = C.cyan;
const G = C.green;
const M = C.magenta;
const Gr = C.grey;
const O = C.orange;
const Gd = C.gold;
const DGd = C.darkGold;
const Sk = C.skin;
const DO = C.darkOrange;
const Lg = C.lightGrey;
const Dg = C.darkGrey;
const Nv = C.navy;
const Pk = C.pink;
const LG = C.lightGreen;
const Sv = C.silver;
const DS = C.darkSilver;
const SB = C.skyBlue;
const Pp = C.purple;
const DP = C.darkPurple;
const DR = C.darkRed;
const DB = C.darkBlue;
const DG = C.darkGreen;
const DY = C.darkYellow;
const Lm = C.lime;

// ══════════════════════════════════════════════════════════════
// SPACEMAN — 16×16 cartoon astronaut
// Gold reflective visor, visible face, white suit, green jetpack,
// orange gloves, chunky magnetic boots
// ══════════════════════════════════════════════════════════════

const SPACEMAN_IDLE: PixelGrid = [
  [_, _, _, _, _, Lg, Lg, Lg, Lg, _, _, _, _, _, _, _],
  [_, _, _, _, Lg, W, W, W, W, Lg, _, _, _, _, _, _],
  [_, _, _, Lg, W, Gd, Gd, Gd, Gd, W, Lg, _, _, _, _, _],
  [_, _, _, Lg, Gd, DGd, Y, Y, DGd, Gd, Lg, _, _, _, _, _],
  [_, _, _, Lg, Gd, Y, W, W, Y, Gd, Lg, _, _, _, _, _],
  [_, _, _, Lg, W, Gd, Gd, Gd, Gd, W, Lg, _, _, _, _, _],
  [_, _, _, _, Lg, Lg, Lg, Lg, Lg, Lg, _, _, _, _, _, _],
  [_, _, _, G, DG, W, W, W, W, W, DG, G, _, _, _, _],
  [_, _, O, G, DG, W, B, W, B, W, DG, G, O, _, _, _],
  [_, _, _, G, W, W, W, W, W, W, W, G, _, _, _, _],
  [_, _, _, _, W, W, Y, Y, Y, W, W, _, _, _, _, _],
  [_, _, _, _, W, Lg, W, W, W, Lg, W, _, _, _, _, _],
  [_, _, _, _, _, W, W, _, W, W, _, _, _, _, _, _],
  [_, _, _, _, _, W, W, _, W, W, _, _, _, _, _, _],
  [_, _, _, _, B, DB, B, _, B, DB, B, _, _, _, _, _],
  [_, _, _, B, Nv, DB, B, _, B, DB, Nv, B, _, _, _, _],
];

const SPACEMAN_WALK1: PixelGrid = [
  [_, _, _, _, _, Lg, Lg, Lg, Lg, _, _, _, _, _, _, _],
  [_, _, _, _, Lg, W, W, W, W, Lg, _, _, _, _, _, _],
  [_, _, _, Lg, W, Gd, Gd, Gd, Gd, W, Lg, _, _, _, _, _],
  [_, _, _, Lg, Gd, DGd, Y, Y, DGd, Gd, Lg, _, _, _, _, _],
  [_, _, _, Lg, Gd, Y, W, W, Y, Gd, Lg, _, _, _, _, _],
  [_, _, _, Lg, W, Gd, Gd, Gd, Gd, W, Lg, _, _, _, _, _],
  [_, _, _, _, Lg, Lg, Lg, Lg, Lg, Lg, _, _, _, _, _, _],
  [_, _, _, G, DG, W, W, W, W, W, DG, G, _, _, _, _],
  [_, _, O, G, DG, W, B, W, B, W, DG, G, O, _, _, _],
  [_, _, _, G, W, W, W, W, W, W, W, G, _, _, _, _],
  [_, _, _, _, W, W, Y, Y, Y, W, W, _, _, _, _, _],
  [_, _, _, _, W, Lg, W, W, W, Lg, W, _, _, _, _, _],
  [_, _, _, _, _, W, W, _, _, W, W, _, _, _, _, _],
  [_, _, _, _, B, DB, _, _, _, _, W, W, _, _, _, _],
  [_, _, _, B, Nv, B, _, _, _, _, B, DB, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, B, Nv, B, B, _, _, _],
];

const SPACEMAN_THRUST: PixelGrid = [
  [_, _, _, _, _, Lg, Lg, Lg, Lg, _, _, _, _, _, _, _],
  [_, _, _, _, Lg, W, W, W, W, Lg, _, _, _, _, _, _],
  [_, _, _, Lg, W, Gd, Gd, Gd, Gd, W, Lg, _, _, _, _, _],
  [_, _, _, Lg, Gd, DGd, Y, Y, DGd, Gd, Lg, _, _, _, _, _],
  [_, _, _, Lg, Gd, Y, W, W, Y, Gd, Lg, _, _, _, _, _],
  [_, _, _, Lg, W, Gd, Gd, Gd, Gd, W, Lg, _, _, _, _, _],
  [_, _, _, _, Lg, Lg, Lg, Lg, Lg, Lg, _, _, _, _, _, _],
  [_, _, _, G, DG, W, W, W, W, W, DG, G, _, _, _, _],
  [_, _, O, G, DG, W, B, W, B, W, DG, G, O, _, _, _],
  [_, _, _, G, W, W, W, W, W, W, W, G, _, _, _, _],
  [_, _, _, _, W, W, Y, Y, Y, W, W, _, _, _, _, _],
  [_, _, _, _, W, Lg, W, W, W, Lg, W, _, _, _, _, _],
  [_, _, _, _, B, DB, B, _, B, DB, B, _, _, _, _, _],
  [_, _, _, _, O, Y, O, _, O, Y, O, _, _, _, _, _],
  [_, _, _, _, Y, R, Y, _, Y, R, Y, _, _, _, _, _],
  [_, _, _, _, _, R, _, _, _, R, _, _, _, _, _, _],
];

// ══════════════════════════════════════════════════════════════
// ROCKET PIECES — Space Shuttle Atlantis — 16×32 each
// White orbiter with black nose/tiles, orange external tank (ET),
// white SRBs, delta wings
// ══════════════════════════════════════════════════════════════

// Shuttle-specific palette
const SH = {
  orbiterW: '#e8e8f0',    // bright orbiter white
  orbiterS: '#c0c0d0',    // shaded orbiter side
  orbiterD: '#9898aa',     // dark orbiter edge
  tileBlk: '#1a1a24',     // black heat-shield tiles
  tileDk: '#2a2a3a',      // dark tile highlight
  noseBlk: '#0e0e18',     // nose RCC black
  orange: '#e87020',       // ET orange foam
  orangeD: '#c05818',      // ET dark orange shading
  orangeL: '#f09040',      // ET highlight
  srbW: '#d8d8e0',         // SRB white
  srbD: '#a0a0b0',         // SRB shadow
  srbNoz: '#555566',       // SRB nozzle grey
  wingEdge: '#222230',     // wing leading-edge black
  cockpit: '#44aaff',      // cockpit window blue
  cockpitD: '#2266cc',     // cockpit window dark blue
  red: '#cc2200',          // NASA red stripe detail
  flag: '#003399',         // flag blue canton
};

const ROCKET_BASE: PixelGrid = (() => {
  // Bottom piece: 3 engine bells (SSMEs) + SRB aft skirts + black tile belly
  const grid: PixelGrid = [];
  for (let r = 0; r < 32; r++) {
    const row: (string | null)[] = new Array(16).fill(null);
    if (r < 8) {
      // Delta wing roots — wide triangular section with black leading edge
      const wingExtra = Math.floor((8 - r) * 0.8);
      const left = Math.max(0, 2 - wingExtra);
      const right = Math.min(15, 13 + wingExtra);
      for (let c = left; c <= right; c++) {
        if (c < 2 || c > 13) {
          // Wing extensions — black leading edge with white body
          row[c] = (c === left || c === right) ? SH.wingEdge : SH.orbiterW;
        } else if (c === 2 || c === 13) {
          row[c] = SH.orbiterD;
        } else {
          // Underbelly — black thermal tiles
          if (c >= 5 && c <= 10) {
            if ((r + c) % 3 === 0) row[c] = SH.tileDk;
            else row[c] = SH.tileBlk;
          } else {
            row[c] = SH.orbiterS;
          }
        }
      }
    } else if (r < 20) {
      // Main aft body — orbiter sides with black tile belly centre
      for (let c = 2; c < 14; c++) {
        if (c === 2 || c === 13) { row[c] = SH.orbiterD; continue; }
        // Centre belly tiles
        if (c >= 5 && c <= 10) {
          if ((r + c) % 3 === 0) row[c] = SH.tileDk;
          else row[c] = SH.tileBlk;
        } else if (c <= 4) {
          row[c] = SH.orbiterW;
        } else {
          row[c] = SH.orbiterS;
        }
      }
      // SRBs on the sides
      if (r >= 10 && r < 20) {
        row[0] = SH.srbD; row[1] = SH.srbW;
        row[14] = SH.srbW; row[15] = SH.srbD;
      }
    } else if (r < 26) {
      // Engine section — 3 SSME nozzles + SRB nozzles
      for (let c = 3; c < 13; c++) {
        if (c === 3 || c === 12) { row[c] = SH.orbiterD; continue; }
        row[c] = SH.tileBlk;
      }
      // SSME bells (three circular nozzles)
      const bRow = r - 20;
      if (bRow < 5) {
        // Left SSME
        if (bRow >= 1) { row[5] = C.darkGrey; row[6] = C.grey; }
        // Centre SSME
        if (bRow >= 0) { row[7] = C.darkGrey; row[8] = C.grey; }
        // Right SSME
        if (bRow >= 1) { row[9] = C.darkGrey; row[10] = C.grey; }
      }
      // SRB aft skirts
      row[0] = SH.srbNoz; row[1] = SH.srbD;
      row[14] = SH.srbD; row[15] = SH.srbNoz;
    } else {
      // Nozzle exits — engine glow zone
      if (r < 29) {
        row[5] = C.darkGrey; row[6] = C.orange;
        row[7] = C.darkGrey; row[8] = C.orange;
        row[9] = C.darkGrey; row[10] = C.orange;
        row[0] = SH.srbNoz; row[15] = SH.srbNoz;
      }
    }
    grid.push(row);
  }
  return grid;
})();

const ROCKET_MID: PixelGrid = (() => {
  // Middle piece: orange External Tank flanked by SRBs, orbiter body on front
  const grid: PixelGrid = [];
  for (let r = 0; r < 32; r++) {
    const row: (string | null)[] = new Array(16).fill(null);
    // Main orbiter fuselage  (cols 3-12)
    for (let c = 3; c < 13; c++) {
      if (c === 3 || c === 12) { row[c] = SH.orbiterD; continue; }
      // Payload bay doors — white top, black belly
      if (c >= 5 && c <= 10) {
        // Centre: orange ET visible through gap
        if (c >= 7 && c <= 8) {
          row[c] = SH.orange;
        } else {
          row[c] = SH.orbiterW;
        }
      } else if (c <= 4) {
        row[c] = SH.orbiterW;
      } else {
        row[c] = SH.orbiterS;
      }
    }

    // "NASA" text stripe — red stripe band across middle
    if (r >= 14 && r <= 16) {
      for (let c = 4; c < 12; c++) {
        if (r === 15) row[c] = SH.red;
        else row[c] = SH.orbiterW;
      }
    }

    // Payload bay hatches — subtle dark lines
    if (r === 5 || r === 10 || r === 22 || r === 27) {
      for (let c = 4; c < 12; c++) row[c] = SH.orbiterD;
    }

    // SRB bodies on the sides
    row[0] = SH.srbD; row[1] = SH.srbW;
    row[14] = SH.srbW; row[15] = SH.srbD;

    // SRB segment separation rings
    if (r === 0 || r === 10 || r === 20 || r === 31) {
      row[0] = SH.srbNoz; row[1] = SH.srbD;
      row[14] = SH.srbD; row[15] = SH.srbNoz;
    }

    grid.push(row);
  }
  return grid;
})();

const ROCKET_TOP: PixelGrid = (() => {
  // Top piece: nose cone, cockpit windows, crew module, SRB nose cones
  const grid: PixelGrid = [];
  for (let r = 0; r < 32; r++) {
    const row: (string | null)[] = new Array(16).fill(null);
    if (r < 12) {
      // Nose cone — tapers from point to full width
      // Black RCC nose with white body transition
      const progress = r / 12;
      const w = Math.max(1, Math.floor(progress * 10));
      const start = 8 - Math.floor(w / 2);
      for (let c = start; c < start + w; c++) {
        if (r < 3) {
          row[c] = SH.noseBlk; // dark RCC nose tip
        } else if (r < 5) {
          row[c] = (c === start || c === start + w - 1) ? SH.noseBlk : SH.tileDk;
        } else if (r < 8) {
          // Transition — black to white
          if (c === start || c === start + w - 1) row[c] = SH.orbiterD;
          else if (c < start + 2 || c > start + w - 3) row[c] = SH.tileBlk;
          else row[c] = SH.orbiterS;
        } else {
          // White body
          if (c === start || c === start + w - 1) row[c] = SH.orbiterD;
          else row[c] = SH.orbiterW;
        }
      }
    } else if (r < 20) {
      // Cockpit / crew module section — full width
      for (let c = 3; c < 13; c++) {
        if (c === 3 || c === 12) { row[c] = SH.orbiterD; continue; }
        // Cockpit windows (row 14-17, cols 5-10)
        if (r >= 14 && r <= 17 && c >= 5 && c <= 10) {
          if (r === 14 || r === 17) {
            row[c] = SH.orbiterD; // window frame top/bottom
          } else if (c === 5 || c === 10) {
            row[c] = SH.orbiterD; // window frame sides
          } else {
            // Glass — gradient blue
            row[c] = (r === 15) ? SH.cockpit : SH.cockpitD;
          }
          continue;
        }
        row[c] = SH.orbiterW;
      }
      // SRB nose cones (start appearing here)
      if (r >= 16) {
        const srbRad = Math.floor((r - 15) * 0.8);
        if (srbRad >= 1) {
          row[0] = SH.srbD; row[1] = SH.srbW;
          row[14] = SH.srbW; row[15] = SH.srbD;
        }
      }
    } else {
      // Forward fuselage — full body
      for (let c = 3; c < 13; c++) {
        if (c === 3 || c === 12) { row[c] = SH.orbiterD; continue; }
        // Small US flag detail (rows 22-25)
        if (r >= 22 && r <= 25 && c >= 9 && c <= 11) {
          if (r === 22 && c <= 10) { row[c] = SH.flag; continue; }
          if (r === 23) { row[c] = (c % 2 === 0) ? SH.red : SH.orbiterW; continue; }
          if (r === 24) { row[c] = (c % 2 === 0) ? SH.orbiterW : SH.red; continue; }
        }
        row[c] = SH.orbiterW;
      }
      // SRBs full-width
      row[0] = SH.srbD; row[1] = SH.srbW;
      row[14] = SH.srbW; row[15] = SH.srbD;
    }
    if (r === 31) {
      for (let c = 3; c < 13; c++) row[c] = SH.orbiterD;
    }
    grid.push(row);
  }
  return grid;
})();

// ══════════════════════════════════════════════════════════════
// FUEL CELL — 8×8 bright glowing energy canister
// Vivid green with yellow energy core and white glow centre
// ══════════════════════════════════════════════════════════════

const FUEL_CELL: PixelGrid = [
  [_, _, DG, G, G, DG, _, _],
  [_, DG, G, LG, LG, G, DG, _],
  [DG, G, LG, Y, Y, LG, G, DG],
  [G, LG, Y, W, W, Y, LG, G],
  [G, LG, Y, W, W, Y, LG, G],
  [DG, G, LG, Y, Y, LG, G, DG],
  [_, DG, G, LG, LG, G, DG, _],
  [_, _, DG, G, G, DG, _, _],
];

// ══════════════════════════════════════════════════════════════
// GEM — 8×8 purple sparkling diamond with bright facets
// ══════════════════════════════════════════════════════════════

const GEM: PixelGrid = [
  [_, _, _, Pp, Pp, _, _, _],
  [_, _, Pp, W, Pk, Pp, _, _],
  [_, Pp, W, M, Pp, Pk, Pp, _],
  [Pp, W, M, Pp, DP, Pp, M, Pp],
  [Pp, M, Pp, DP, DP, Pp, M, Pp],
  [_, Pp, Pp, DP, DP, Pp, Pp, _],
  [_, _, Pp, Pp, Pp, Pp, _, _],
  [_, _, _, Pp, Pp, _, _, _],
];

// ══════════════════════════════════════════════════════════════
// ALIENS — 12×12 vivid creatures with bold silhouettes
// ══════════════════════════════════════════════════════════════

function makeAlien(primary: string, secondary: string, pattern: number): PixelGrid {
  const P = primary;
  const S = secondary;
  const grid: PixelGrid = [];
  for (let r = 0; r < 12; r++) {
    const row: (string | null)[] = new Array(12).fill(null);
    const shapes: Record<number, (r: number, c: number) => string | null> = {
      1: (r, c) => { // Meteor — bright fireball with molten core
        const cx = 6, cy = 6;
        const d = Math.sqrt((c - cx) ** 2 + (r - cy) ** 2);
        if (d < 1.2) return C.white;
        if (d < 2.5) return C.yellow;
        if (d < 3.5) return C.orange;
        if (d < 4.5) return P;
        if (d < 5.2) return S;
        // Fire trail
        if (c > 7 && r >= 4 && r <= 8 && (r + c) % 2 === 0) return C.orange;
        return null;
      },
      2: (r, c) => { // Jellyfish — glowing dome with big eyes + tendrils
        // Dome
        if (r >= 0 && r <= 2 && c >= 3 && c <= 8) {
          if (r === 0 && (c === 3 || c === 8)) return null;
          return S;
        }
        if (r >= 3 && r <= 5 && c >= 2 && c <= 9) {
          // Big white eyes with coloured pupils
          if (r === 3 && (c === 4 || c === 7)) return C.white;
          if (r === 4 && (c === 4 || c === 7)) return C.white;
          if (r === 4 && (c === 5 || c === 8)) return C.red;
          return P;
        }
        // Body
        if (r >= 6 && r <= 7 && c >= 3 && c <= 8) return S;
        // Long dangling tendrils
        if (r === 8 && (c === 3 || c === 5 || c === 7 || c === 9)) return P;
        if (r === 9 && (c === 3 || c === 5 || c === 7 || c === 9)) return S;
        if (r === 10 && (c === 3 || c === 7)) return P;
        if (r === 11 && (c === 5 || c === 9)) return S;
        return null;
      },
      3: (r, c) => { // Flying saucer — flat disc with dome + beams
        // Top dome
        if (r >= 1 && r <= 3 && c >= 4 && c <= 7) {
          if (r === 1 && (c === 4 || c === 7)) return null;
          return C.cyan;
        }
        // Main disc
        if (r >= 4 && r <= 7) {
          if (r === 4 || r === 7) {
            if (c >= 2 && c <= 9) return S;
          } else {
            if (c >= 1 && c <= 10) {
              // Flashing lights
              if (r === 5 && (c === 2 || c === 5 || c === 8)) return C.red;
              if (r === 6 && (c === 3 || c === 6 || c === 9)) return C.yellow;
              return P;
            }
          }
        }
        // Tractor beam
        if (r >= 8 && r <= 10 && (c === 5 || c === 6)) return C.yellow;
        if (r === 11 && c >= 4 && c <= 7) return C.darkYellow;
        return null;
      },
      4: (r, c) => { // Asteroid — craggy rock with glowing cracks
        const cx = 6, cy = 6;
        const angle = Math.atan2(r - cy, c - cx);
        const rad = 4.5 + Math.sin(angle * 3) * 1.2 + Math.cos(angle * 5) * 0.8;
        const d = Math.sqrt((c - cx) ** 2 + (r - cy) ** 2);
        if (d > rad) return null;
        // Glowing cracks
        if (Math.abs(c - r) <= 0.5 && d > 2) return C.orange;
        if (Math.abs(c + r - 12) <= 0.5 && d > 2) return C.orange;
        if (d < 2) return C.darkYellow;
        if (d < rad - 1) return P;
        return S;
      },
      5: (r, c) => { // Solar flare — big glowing star shape
        const cx = 6, cy = 6;
        const d = Math.sqrt((c - cx) ** 2 + (r - cy) ** 2);
        if (d < 1.5) return C.white;
        if (d < 2.5) return C.yellow;
        // Cross shape spikes
        if ((r === cy && c >= 0 && c <= 11) || (c === cx && r >= 0 && r <= 11)) {
          if (d < 5) return P;
          return S;
        }
        // Diagonal spikes
        if (Math.abs(r - cy) === Math.abs(c - cx) && d < 4.5) return P;
        // Fill
        if (d < 3.5) return P;
        return null;
      },
      6: (r, c) => { // Space pirate — skull with glowing eyes + hat
        // Pirate hat
        if (r === 0 && c >= 3 && c <= 8) return P;
        if (r === 1 && c >= 2 && c <= 9) return P;
        if (r === 2 && c >= 1 && c <= 10) return S;
        // Skull face
        if (r >= 3 && r <= 5 && c >= 3 && c <= 8) {
          if (r === 4 && (c === 4 || c === 7)) return C.red; // glowing eyes
          if (r === 4 && (c === 5 || c === 6)) return null;  // hollow nose
          if (r === 5 && c >= 4 && c <= 7) return C.white;   // teeth
          return C.white;
        }
        // Body
        if (r >= 6 && r <= 8 && c >= 3 && c <= 8) {
          if (r === 7 && (c === 5 || c === 6)) return C.yellow; // belt buckle
          return S;
        }
        // Cutlass
        if (r >= 5 && r <= 8 && c === 10) return C.lightGrey;
        if (r === 4 && c === 10) return C.yellow; // handle
        // Legs
        if (r >= 9 && r <= 11 && (c >= 3 && c <= 5)) return P;
        if (r >= 9 && r <= 11 && (c >= 6 && c <= 8)) return P;
        return null;
      },
      7: (r, c) => { // Spiky mine — bold danger symbol, big spikes
        const cx = 6, cy = 6;
        const d = Math.sqrt((c - cx) ** 2 + (r - cy) ** 2);
        // Bright danger core
        if (d < 1.5) return C.white;
        if (d < 2.5) return C.yellow;
        if (d < 3.5) return C.red;
        if (d < 4.2) return P;
        // Big cardinal spikes
        if ((r === 0 || r === 1) && (c === 5 || c === 6)) return S;
        if ((r === 10 || r === 11) && (c === 5 || c === 6)) return S;
        if ((c === 0 || c === 1) && (r === 5 || r === 6)) return S;
        if ((c === 10 || c === 11) && (r === 5 || r === 6)) return S;
        // Diagonal spikes
        if ((r === 1 && c === 1) || (r === 1 && c === 10)) return S;
        if ((r === 10 && c === 1) || (r === 10 && c === 10)) return S;
        return null;
      },
      8: (r, c) => { // Ghost — spooky translucent shape with eyes
        // Head dome
        if (r >= 0 && r <= 2 && c >= 3 && c <= 8) {
          if (r === 0 && (c === 3 || c === 8)) return null;
          return P;
        }
        // Body
        if (r >= 3 && r <= 8 && c >= 2 && c <= 9) {
          // Big eyes
          if (r === 4 && (c === 4 || c === 7)) return C.white;
          if (r === 5 && (c === 4 || c === 7)) return C.white;
          if (r === 5 && (c === 5 || c === 8)) return C.cyan;
          // Mouth
          if (r === 7 && c >= 5 && c <= 7) return S;
          return P;
        }
        // Wavy bottom
        if (r === 9 && c >= 2 && c <= 9) return P;
        if (r === 10 && (c === 2 || c === 4 || c === 6 || c === 8)) return P;
        if (r === 11 && (c === 3 || c === 5 || c === 7 || c === 9)) return S;
        return null;
      },
    };

    const shapeFn = shapes[pattern] || shapes[1];
    for (let c = 0; c < 12; c++) {
      row[c] = shapeFn(r, c);
    }
    grid.push(row);
  }
  return grid;
}

// Pre-generate alien sprites with vivid contrasting colours
const ALIEN_SPRITES: PixelGrid[] = [
  makeAlien(C.orange, C.red, 1),           // Fireball meteor
  makeAlien(C.cyan, C.blue, 2),            // Cyan jellyfish
  makeAlien(C.darkGrey, C.blue, 3),        // Metal saucer
  makeAlien(C.darkYellow, C.darkGrey, 4),  // Rocky asteroid
  makeAlien(C.yellow, C.orange, 5),        // Solar flare star
  makeAlien(C.darkRed, C.red, 6),          // Space pirate
  makeAlien(C.magenta, C.red, 7),          // Danger mine
  makeAlien(C.green, C.darkGreen, 8),      // Spooky ghost
];

// ── Public API ──

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  name: SpriteName,
  x: number,
  y: number,
  scale: number = 1,
  flipX: boolean = false
) {
  const grid = getSpriteGrid(name);
  if (grid) drawPixelGrid(ctx, x, y, grid, scale, flipX);
}

export function getSpriteGrid(name: SpriteName): PixelGrid | null {
  switch (name) {
    case 'spaceman_idle':
    case 'spaceman_carry':
      return SPACEMAN_IDLE;
    case 'spaceman_walk1':
      return SPACEMAN_WALK1;
    case 'spaceman_thrust':
    case 'spaceman_walk2':
      return SPACEMAN_THRUST;
    case 'rocket_base':
      return ROCKET_BASE;
    case 'rocket_mid':
      return ROCKET_MID;
    case 'rocket_top':
      return ROCKET_TOP;
    case 'fuel_cell':
      return FUEL_CELL;
    case 'gem':
      return GEM;
    case 'alien1': return ALIEN_SPRITES[0];
    case 'alien2': return ALIEN_SPRITES[1];
    case 'alien3': return ALIEN_SPRITES[2];
    case 'alien4': return ALIEN_SPRITES[3];
    case 'alien5': return ALIEN_SPRITES[4];
    case 'alien6': return ALIEN_SPRITES[5];
    case 'alien7': return ALIEN_SPRITES[6];
    case 'alien8': return ALIEN_SPRITES[7];
    default:
      return null;
  }
}

/** Get sprite dimensions (in pixels at scale=1) */
export function getSpriteSize(name: SpriteName): { w: number; h: number } {
  const grid = getSpriteGrid(name);
  if (!grid || grid.length === 0) return { w: 0, h: 0 };
  return { w: grid[0].length, h: grid.length };
}
