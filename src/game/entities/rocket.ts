// ── Rocket: multi-piece assembly + fuel + launch ──

import type { GameEntity } from '../engine';
import { drawSprite } from '../sprites';

export type RocketPhase = 'building' | 'fuelling' | 'ready' | 'launching' | 'gone';

export interface RocketPart {
  type: 'base' | 'mid' | 'top';
  placed: boolean;
}

const ROCKET_W = 16;
const PIECE_H = 32;
const FUEL_NEEDED = 3;

export class Rocket implements GameEntity {
  active = true;
  phase: RocketPhase = 'building';

  // Position of rocket base on the ground
  x: number;
  y: number; // bottom of the base

  parts: RocketPart[] = [
    { type: 'base', placed: false },
    { type: 'mid', placed: false },
    { type: 'top', placed: false },
  ];

  fuel = 0;
  fuelNeeded = FUEL_NEEDED;
  launchTimer = 0;
  launchY = 0;

  // Callbacks
  onLaunchComplete?: () => void;

  constructor(x: number, groundY: number) {
    this.x = x;
    this.y = groundY;
  }

  /** Place the next unplaced part. Returns true if placed. */
  placePart(partType: 'base' | 'mid' | 'top'): boolean {
    // Must place in order: base → mid → top
    const nextIdx = this.parts.findIndex((p) => !p.placed);
    if (nextIdx === -1) return false;
    if (this.parts[nextIdx].type !== partType) return false;

    this.parts[nextIdx].placed = true;

    // If all parts placed, move to fuelling phase
    if (this.parts.every((p) => p.placed)) {
      this.phase = 'fuelling';
    }

    return true;
  }

  /** Add fuel. Returns true if fuelling is complete. */
  addFuel(): boolean {
    if (this.phase !== 'fuelling') return false;
    this.fuel++;
    if (this.fuel >= this.fuelNeeded) {
      this.phase = 'ready';
      return true;
    }
    return false;
  }

  /** Begin launch sequence */
  startLaunch() {
    if (this.phase !== 'ready') return;
    this.phase = 'launching';
    this.launchTimer = 0;
    this.launchY = 0;
  }

  get placedCount(): number {
    return this.parts.filter((p) => p.placed).length;
  }

  /** The top Y of the built rocket so far */
  get topY(): number {
    const count = this.placedCount;
    return this.y - count * PIECE_H;
  }

  /** The bounding box of the built rocket (for pickup drop zone) */
  get dropZone(): { x: number; y: number; width: number; height: number } {
    const count = this.placedCount;
    if (count === 0) {
      // When no parts placed, use a generous zone around the launch pad
      return {
        x: this.x - 12,
        y: this.y - 48,
        width: ROCKET_W + 24,
        height: 56,
      };
    }
    return {
      x: this.x - 8,
      y: this.topY - 8,
      width: ROCKET_W + 16,
      height: count * PIECE_H + 16,
    };
  }

  /** Next part type needed, or null if all placed */
  get nextPartNeeded(): 'base' | 'mid' | 'top' | null {
    const next = this.parts.find((p) => !p.placed);
    return next?.type ?? null;
  }

  update(dt: number) {
    if (this.phase === 'launching') {
      this.launchTimer += dt;
      // Acceleration ramp
      const speed = 30 + this.launchTimer * 200;
      this.launchY += speed * dt;

      if (this.launchY > 500) {
        this.phase = 'gone';
        this.onLaunchComplete?.();
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.phase === 'gone') return;

    const baseY = this.y - PIECE_H;
    const launchOffset = this.phase === 'launching' ? -this.launchY : 0;

    // Always draw the launch pad
    this.renderLaunchPad(ctx);

    // During building phase, show ghost outline for unplaced parts
    if (this.phase === 'building') {
      ctx.save();
      ctx.globalAlpha = 0.15 + 0.05 * Math.sin(Date.now() / 600);
      for (let i = 0; i < this.parts.length; i++) {
        if (this.parts[i].placed) continue;
        const pieceY = baseY - i * PIECE_H;
        const spriteName = `rocket_${this.parts[i].type}` as any;
        drawSprite(ctx, spriteName, this.x, pieceY);
      }
      ctx.restore();
    }

    // Draw placed parts from bottom up
    for (let i = 0; i < this.parts.length; i++) {
      if (!this.parts[i].placed) continue;
      const pieceY = baseY - i * PIECE_H + launchOffset;
      const spriteName = `rocket_${this.parts[i].type}` as any;
      drawSprite(ctx, spriteName, this.x, pieceY);
    }

    // Draw fuel filling up inside the rocket body (bottom to top)
    if ((this.phase === 'fuelling' || this.phase === 'ready') && this.fuel > 0) {
      const totalH = 3 * PIECE_H; // full assembled rocket height
      const rocketTopY = baseY - 2 * PIECE_H + launchOffset;
      const rocketBottomY = baseY + PIECE_H + launchOffset;
      const fillFraction = this.fuel / this.fuelNeeded;
      const fillH = fillFraction * totalH;
      const fillTopY = rocketBottomY - fillH;

      // Clip to the rocket silhouette (cols 3-12 interior)
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.x + 3, rocketTopY, 10, totalH);
      ctx.clip();

      // Glowing fuel liquid
      const isReady = this.phase === 'ready';
      const baseColor = isReady ? 'rgba(0,249,47,' : 'rgba(0,238,51,';
      const grad = ctx.createLinearGradient(0, fillTopY, 0, rocketBottomY);
      grad.addColorStop(0, baseColor + '0.45)');
      grad.addColorStop(0.4, baseColor + '0.7)');
      grad.addColorStop(1, baseColor + '0.55)');
      ctx.fillStyle = grad;
      ctx.fillRect(this.x + 3, fillTopY, 10, fillH);

      // Bright meniscus line at the top of the fuel
      ctx.fillStyle = isReady ? '#88ffaa' : '#66ff88';
      ctx.fillRect(this.x + 3, fillTopY, 10, 1);

      // Animated bubbles inside the fuel
      const t = Date.now() / 400;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 3; i++) {
        const bx = this.x + 4 + ((i * 3.7 + t * (1 + i * 0.5)) % 8);
        const by = fillTopY + ((i * 11.3 + t * 6) % Math.max(1, fillH - 2));
        if (by > fillTopY && by < rocketBottomY - 1) {
          ctx.fillRect(Math.floor(bx), Math.floor(by), 1, 1);
        }
      }

      ctx.restore();
    }

    // Flame effect during launch
    if (this.phase === 'launching') {
      const flameY = baseY + launchOffset;
      const flameH = 8 + Math.random() * 12;
      ctx.fillStyle = '#ff331c';
      ctx.fillRect(this.x + 4, flameY, 8, flameH);
      ctx.fillStyle = '#ffea00';
      ctx.fillRect(this.x + 5, flameY, 6, flameH * 0.6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this.x + 6, flameY, 4, flameH * 0.3);
    }
  }

  /** Render a visible launch pad / landing zone indicator */
  private renderLaunchPad(ctx: CanvasRenderingContext2D) {
    const padX = this.x - 4;
    const padY = this.y - 4;
    const padW = ROCKET_W + 8;
    const padH = 4;

    // Solid pad base
    ctx.fillStyle = '#444466';
    ctx.fillRect(padX, padY, padW, padH);
    // Top highlight
    ctx.fillStyle = '#666688';
    ctx.fillRect(padX, padY, padW, 1);
    // Side stripes (hazard markings)
    ctx.fillStyle = '#ffea00';
    ctx.fillRect(padX, padY + 1, 2, 2);
    ctx.fillRect(padX + padW - 2, padY + 1, 2, 2);

    // If building, show a pulsing arrow/indicator above the pad
    if (this.phase === 'building' && this.placedCount === 0) {
      const blink = Math.sin(Date.now() / 300) > 0;
      if (blink) {
        ctx.fillStyle = '#00fbfe';
        // Small down-arrow
        ctx.fillRect(this.x + 6, padY - 14, 4, 8);
        ctx.fillRect(this.x + 4, padY - 6, 8, 2);
        ctx.fillRect(this.x + 6, padY - 4, 4, 2);
      }
      // "PAD" label
      ctx.fillStyle = 'rgba(0, 251, 254, 0.6)';
      ctx.font = '6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAD', this.x + ROCKET_W / 2, padY - 16);
      ctx.textAlign = 'left';
    }
  }
}
