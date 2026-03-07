// ── Aliens: 8 types with unique movement patterns ──

import type { GameEntity } from '../engine';
import type { PhysicsBody } from '../physics';
import { applyWraparound } from '../physics';
import { drawSprite, type SpriteName } from '../sprites';

export type AlienPattern =
  | 'meteor'       // 1: straight diagonal
  | 'jellyfish'    // 2: sinusoidal bob
  | 'drone'        // 3: horizontal patrol then dive
  | 'asteroid'     // 4: slow tumble
  | 'solar_flare'  // 5: fast zigzag
  | 'space_pirate' // 6: tracks player X
  | 'magnetic_mine'// 7: slow homing
  | 'dust_devil';  // 8: circular orbit

export interface AlienConfig {
  pattern: AlienPattern;
  speed: number;
  x: number;
  y: number;
  worldW: number;
  worldH: number;
}

const ALIEN_SIZE = 12;

export class Alien implements GameEntity {
  active = true;
  body: PhysicsBody;
  pattern: AlienPattern;
  speed: number;
  private worldW: number;
  private worldH: number;
  private timer = 0;
  private startX: number;
  private startY: number;
  private dirX = 1;
  private dirY = 1;

  // For homing patterns
  targetX = 0;
  targetY = 0;

  constructor(config: AlienConfig) {
    this.pattern = config.pattern;
    this.speed = config.speed;
    this.worldW = config.worldW;
    this.worldH = config.worldH;
    this.startX = config.x;
    this.startY = config.y;
    this.body = {
      x: config.x,
      y: config.y,
      vx: 0,
      vy: 0,
      width: ALIEN_SIZE,
      height: ALIEN_SIZE,
      grounded: false,
    };

    // Random initial direction
    this.dirX = Math.random() > 0.5 ? 1 : -1;
    this.dirY = Math.random() > 0.5 ? 1 : -1;
  }

  update(dt: number) {
    this.timer += dt;
    const { body } = this;
    const s = this.speed;

    switch (this.pattern) {
      case 'meteor':
        body.vx = s * this.dirX;
        body.vy = s * 0.7 * this.dirY;
        break;

      case 'jellyfish':
        body.vx = s * 0.5 * this.dirX;
        body.vy = Math.sin(this.timer * 3) * s * 0.6;
        break;

      case 'drone':
        body.vx = s * this.dirX;
        body.vy = Math.sin(this.timer * 2) > 0.8 ? s * 1.5 : -s * 0.2;
        break;

      case 'asteroid':
        body.vx = s * 0.4 * Math.cos(this.timer * 0.8);
        body.vy = s * 0.4 * Math.sin(this.timer * 0.6);
        break;

      case 'solar_flare':
        body.vx = s * this.dirX;
        body.vy = s * Math.sin(this.timer * 8) * 0.8;
        // Zigzag direction changes
        if (Math.sin(this.timer * 4) > 0.95) this.dirX *= -1;
        break;

      case 'space_pirate': {
        // Track player X
        const dx = this.targetX - body.x;
        body.vx = Math.sign(dx) * Math.min(Math.abs(dx), s * 0.8);
        body.vy = Math.sin(this.timer * 2) * s * 0.3;
        break;
      }

      case 'magnetic_mine': {
        // Slow homing
        const mx = this.targetX - body.x;
        const my = this.targetY - body.y;
        const dist = Math.sqrt(mx * mx + my * my) || 1;
        body.vx = (mx / dist) * s * 0.5;
        body.vy = (my / dist) * s * 0.5;
        break;
      }

      case 'dust_devil': {
        const radius = 40 + Math.sin(this.timer * 0.5) * 20;
        body.x = this.startX + Math.cos(this.timer * 2) * radius;
        body.y = this.startY + Math.sin(this.timer * 2) * radius;
        body.vx = 0;
        body.vy = 0;
        break;
      }
    }

    // Apply velocity (except dust_devil which sets position directly)
    if (this.pattern !== 'dust_devil') {
      body.x += body.vx * dt;
      body.y += body.vy * dt;
    }

    // Wraparound horizontal
    applyWraparound(body, this.worldW);

    // Bounce off top and bottom
    if (body.y < 24) {
      body.y = 24;
      this.dirY = 1;
    }
    if (body.y + body.height > this.worldH - 8) {
      body.y = this.worldH - 8 - body.height;
      this.dirY = -1;
    }
  }

  /** Get the sprite name for this alien type */
  get spriteName(): SpriteName {
    const patternIndex: Record<AlienPattern, number> = {
      meteor: 1,
      jellyfish: 2,
      drone: 3,
      asteroid: 4,
      solar_flare: 5,
      space_pirate: 6,
      magnetic_mine: 7,
      dust_devil: 8,
    };
    return `alien${patternIndex[this.pattern]}` as SpriteName;
  }

  render(ctx: CanvasRenderingContext2D) {
    drawSprite(ctx, this.spriteName, Math.floor(this.body.x), Math.floor(this.body.y));
  }
}

/** Get the alien pattern for a given level (cycles every 8 levels) */
export function getAlienPatternForLevel(level: number): AlienPattern {
  const patterns: AlienPattern[] = [
    'meteor', 'jellyfish', 'drone', 'asteroid',
    'solar_flare', 'space_pirate', 'magnetic_mine', 'dust_devil',
  ];
  return patterns[(level - 1) % 8];
}

/** Spawn a wave of aliens */
export function spawnAlienWave(
  count: number,
  pattern: AlienPattern,
  speed: number,
  worldW: number,
  worldH: number
): Alien[] {
  const aliens: Alien[] = [];
  for (let i = 0; i < count; i++) {
    const x = Math.random() * worldW;
    const y = 30 + Math.random() * (worldH * 0.4);
    aliens.push(new Alien({ pattern, speed, x, y, worldW, worldH }));
  }
  return aliens;
}
