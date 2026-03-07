// ── Platforms: the solid ledges in each level ──

import type { GameEntity } from '../engine';
import type { PlatformRect } from '../physics';

export interface PlatformConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  colour?: string;
}

const DEFAULT_COLOUR = '#00c525'; // ZX dark green

export class Platform implements GameEntity {
  active = true;
  readonly rect: PlatformRect;
  private colour: string;

  constructor(config: PlatformConfig) {
    this.rect = {
      x: config.x,
      y: config.y,
      width: config.width,
      height: config.height,
    };
    this.colour = config.colour ?? DEFAULT_COLOUR;
  }

  update(_dt: number) {
    // Platforms are static
  }

  render(ctx: CanvasRenderingContext2D) {
    const { x, y, width, height } = this.rect;

    // 8-bit retro brick platform
    ctx.fillStyle = this.colour;
    ctx.fillRect(x, y, width, height);

    // Brick mortar lines — vertical
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    const brickW = 12;
    for (let bx = x; bx < x + width; bx += brickW) {
      ctx.fillRect(bx, y, 1, height);
    }
    // Brick mortar — horizontal (for taller surfaces)
    if (height > 4) {
      for (let by = y; by < y + height; by += 4) {
        ctx.fillRect(x, by, width, 1);
      }
    }
    // Bright top edge
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x, y, width, 1);
    // Dark bottom + right edge
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y + height - 1, width, 1);
  }
}

/** 5-platform layout with varied sizes scattered around the screen */
export function createJetpacPlatforms(worldW: number, worldH: number, colour?: string): Platform[] {
  const floorY = worldH - 8;
  const platH = 6;
  const c = colour ?? '#00c525';

  return [
    // Floor
    new Platform({ x: 0, y: floorY, width: worldW, height: 8, colour: c }),
    // 1) Lower-left shelf
    new Platform({ x: 15, y: floorY - 55, width: 100, height: platH, colour: c }),
    // 2) Lower-right shelf (slightly higher)
    new Platform({ x: worldW - 115, y: floorY - 65, width: 100, height: platH, colour: c }),
    // 3) Mid-left shelf
    new Platform({ x: 50, y: floorY - 125, width: 85, height: platH, colour: c }),
    // 4) Mid-right shelf
    new Platform({ x: worldW - 145, y: floorY - 135, width: 95, height: platH, colour: c }),
    // 5) Upper-centre wide shelf
    new Platform({ x: (worldW - 130) / 2, y: floorY - 195, width: 130, height: platH, colour: c }),
  ];
}
