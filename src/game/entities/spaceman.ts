// ── Spaceman: the player character (Jetman) ──

import type { GameEntity } from '../engine';
import type { PhysicsBody, PlatformRect } from '../physics';
import {
  applyGravity,
  applyVelocity,
  applyWraparound,
  collidePlatform,
  collideFloor,
  collideCeiling,
} from '../physics';
import type { InputHandler } from '../input';
import { drawSprite } from '../sprites';

const MOVE_SPEED = 120;    // px/s horizontal
const THRUST_ACCEL = 450;  // px/s² upward
const MAX_RISE = -180;     // px/s terminal upward
const PLAYER_W = 16;
const PLAYER_H = 16;

export type CarriedItem = {
  type: 'rocket_part' | 'fuel_cell' | 'gem';
  subtype?: string;
};

export class Spaceman implements GameEntity {
  active = true;
  body: PhysicsBody;
  facingLeft = false;
  thrusting = false;
  carrying: CarriedItem | null = null;
  lives = 3;
  score = 0;
  invulnerable = 0; // seconds of invulnerability remaining
  insideRocket = false; // hidden inside rocket awaiting launch

  private input: InputHandler;
  private worldW: number;
  private worldH: number;
  private animTimer = 0;
  private walkFrame = 0;

  // Callbacks
  onDeath?: () => void;
  onPickup?: (item: CarriedItem) => void;
  onDrop?: (x: number, y: number, item: CarriedItem) => void;
  /** X position used for initial spawn and respawn after death */
  spawnX: number;

  constructor(input: InputHandler, worldW: number, worldH: number) {
    this.input = input;
    this.worldW = worldW;
    this.worldH = worldH;
    this.spawnX = worldW / 2 - PLAYER_W / 2;
    this.body = {
      x: this.spawnX,
      y: worldH - 40,
      vx: 0,
      vy: 0,
      width: PLAYER_W,
      height: PLAYER_H,
      grounded: false,
    };
  }

  reset(x: number, y: number) {
    this.body.x = x;
    this.body.y = y;
    this.body.vx = 0;
    this.body.vy = 0;
    this.body.grounded = false;
    this.carrying = null;
    this.invulnerable = 1.5;
  }

  update(dt: number) {
    // Skip updates when inside the rocket
    if (this.insideRocket) return;

    const { body, input } = this;

    // Invulnerability timer
    if (this.invulnerable > 0) {
      this.invulnerable -= dt;
    }

    // Horizontal movement
    body.vx = 0;
    if (input.isHeld('left')) {
      body.vx = -MOVE_SPEED;
      this.facingLeft = true;
    }
    if (input.isHeld('right')) {
      body.vx = MOVE_SPEED;
      this.facingLeft = false;
    }

    // Thrust (jetpack)
    this.thrusting = false;
    if (input.isHeld('thrust')) {
      body.vy -= THRUST_ACCEL * dt;
      if (body.vy < MAX_RISE) body.vy = MAX_RISE;
      this.thrusting = true;
      body.grounded = false;
    }

    // Gravity
    if (!body.grounded) {
      applyGravity(body, dt);
    }

    // Apply velocity
    applyVelocity(body, dt);

    // Wraparound
    applyWraparound(body, this.worldW);

    // Walk animation
    if (body.grounded && body.vx !== 0) {
      this.animTimer += dt;
      if (this.animTimer > 0.15) {
        this.animTimer = 0;
        this.walkFrame = (this.walkFrame + 1) % 2;
      }
    } else {
      this.walkFrame = 0;
      this.animTimer = 0;
    }
  }

  /** Call after update to resolve platform collisions */
  collidePlatforms(platforms: PlatformRect[], floorY: number) {
    this.body.grounded = false;
    collideFloor(this.body, floorY);
    collideCeiling(this.body, 24); // leave room for HUD
    for (const p of platforms) {
      collidePlatform(this.body, p);
    }
  }

  /** Take damage (lose a life) */
  hit() {
    if (this.invulnerable > 0) return;
    this.lives--;
    if (this.carrying) {
      this.onDrop?.(this.body.x, this.body.y, this.carrying);
      this.carrying = null;
    }
    if (this.lives <= 0) {
      this.active = false;
      this.onDeath?.();
    } else {
      this.invulnerable = 2;
      this.reset(this.spawnX, this.worldH - 40);
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    // Hidden inside the rocket
    if (this.insideRocket) return;

    // Blink when invulnerable
    if (this.invulnerable > 0 && Math.floor(this.invulnerable * 10) % 2 === 0) {
      return;
    }

    const spriteName = this.thrusting
      ? 'spaceman_thrust'
      : this.walkFrame === 1
        ? 'spaceman_walk2'
        : 'spaceman_idle';

    drawSprite(
      ctx,
      spriteName as any,
      Math.floor(this.body.x),
      Math.floor(this.body.y),
      1,
      this.facingLeft
    );

    // Draw carried item above head
    if (this.carrying) {
      const carryX = this.body.x + 4;
      const carryY = this.body.y - 10;
      if (this.carrying.type === 'fuel_cell') {
        drawSprite(ctx, 'fuel_cell', carryX, carryY);
      } else if (this.carrying.type === 'gem') {
        drawSprite(ctx, 'gem', carryX, carryY);
      } else if (this.carrying.type === 'rocket_part') {
        // Rocket parts are bigger, offset more
        drawSprite(ctx, this.carrying.subtype as any ?? 'rocket_mid', carryX - 4, carryY - 16);
      }
    }
  }

  get cx() { return this.body.x + this.body.width / 2; }
  get cy() { return this.body.y + this.body.height / 2; }
}
