// ── Collectibles: fuel cells, gems, rocket parts that fall and can be carried ──

import type { GameEntity } from '../engine';
import type { PhysicsBody, PlatformRect } from '../physics';
import { applyGravity, applyVelocity, collidePlatform, collideFloor } from '../physics';
import { drawSprite, type SpriteName } from '../sprites';

export type CollectibleType = 'fuel_cell' | 'gem' | 'rocket_part';

export interface CollectibleConfig {
  type: CollectibleType;
  x: number;
  y: number;
  subtype?: string; // e.g. 'rocket_base', 'rocket_mid', 'rocket_top'
}

const SIZE_MAP: Record<CollectibleType, { w: number; h: number }> = {
  fuel_cell: { w: 8, h: 8 },
  gem: { w: 8, h: 8 },
  rocket_part: { w: 16, h: 32 },
};

export class Collectible implements GameEntity {
  active = true;
  body: PhysicsBody;
  type: CollectibleType;
  subtype?: string;
  private landed = false;
  private sparkle = 0;

  constructor(config: CollectibleConfig) {
    this.type = config.type;
    this.subtype = config.subtype;
    const size = SIZE_MAP[config.type];
    this.body = {
      x: config.x,
      y: config.y,
      vx: 0,
      vy: 0,
      width: size.w,
      height: size.h,
      grounded: false,
    };
  }

  update(dt: number) {
    if (!this.landed) {
      applyGravity(this.body, dt);
      applyVelocity(this.body, dt);
    }
    this.sparkle += dt;
  }

  /** Resolve collisions with platforms and floor */
  collidePlatforms(platforms: PlatformRect[], floorY: number) {
    if (this.landed) return;

    if (collideFloor(this.body, floorY)) {
      this.landed = true;
      return;
    }
    for (const p of platforms) {
      if (collidePlatform(this.body, p)) {
        this.landed = true;
        return;
      }
    }
  }

  get spriteName(): SpriteName {
    if (this.type === 'rocket_part' && this.subtype) {
      return this.subtype as SpriteName;
    }
    return this.type as SpriteName;
  }

  render(ctx: CanvasRenderingContext2D) {
    const x = Math.floor(this.body.x);
    const y = Math.floor(this.body.y);
    drawSprite(ctx, this.spriteName, x, y);

    // Sparkle effect for gems
    if (this.type === 'gem' && Math.sin(this.sparkle * 8) > 0.7) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 2, y - 1, 1, 1);
      ctx.fillRect(x + 5, y + 1, 1, 1);
    }
  }
}

/** Spawn a collectible that falls from the top of the screen */
export function spawnFalling(type: CollectibleType, worldW: number, subtype?: string): Collectible {
  const x = 20 + Math.random() * (worldW - 40);
  return new Collectible({ type, x, y: -10, subtype });
}
