// ── Effects: explosions, particles, launch flames ──

import type { GameEntity } from './engine';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  colour: string;
  size: number;
}

const ZX_EXPLOSION_COLOURS = ['#ff331c', '#ffea00', '#ff8800', '#ffffff', '#ff40ff'];
const ZX_SPARKLE_COLOURS = ['#00fbfe', '#ffffff', '#00f92f', '#ffea00'];

export class ParticleSystem implements GameEntity {
  active = true;
  private particles: Particle[] = [];

  update(dt: number) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 100 * dt; // gravity on particles
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length === 0) this.active = false;
  }

  render(ctx: CanvasRenderingContext2D) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.colour;
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  get particleCount() {
    return this.particles.length;
  }

  private emit(x: number, y: number, count: number, colours: string[], config: {
    speedMin: number;
    speedMax: number;
    sizeMin: number;
    sizeMax: number;
    lifeMin: number;
    lifeMax: number;
    spread?: number;
  }) {
    const spread = config.spread ?? Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const angle = (Math.random() - 0.5) * spread - Math.PI / 2;
      const speed = config.speedMin + Math.random() * (config.speedMax - config.speedMin);
      const life = config.lifeMin + Math.random() * (config.lifeMax - config.lifeMin);
      const size = config.sizeMin + Math.random() * (config.sizeMax - config.sizeMin);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        colour: colours[Math.floor(Math.random() * colours.length)],
        size: Math.floor(size),
      });
    }
    this.active = true;
  }

  /** Big explosion (alien death, player death) */
  explode(x: number, y: number) {
    this.emit(x, y, 20, ZX_EXPLOSION_COLOURS, {
      speedMin: 30,
      speedMax: 120,
      sizeMin: 1,
      sizeMax: 3,
      lifeMin: 0.3,
      lifeMax: 0.8,
    });
  }

  /** Small sparkle (pickup) */
  sparkle(x: number, y: number) {
    this.emit(x, y, 8, ZX_SPARKLE_COLOURS, {
      speedMin: 20,
      speedMax: 60,
      sizeMin: 1,
      sizeMax: 2,
      lifeMin: 0.2,
      lifeMax: 0.5,
      spread: Math.PI,
    });
  }

  /** Thrust trail */
  thrustTrail(x: number, y: number) {
    this.emit(x, y, 2, ['#ffea00', '#ff331c', '#ff8800'], {
      speedMin: 10,
      speedMax: 40,
      sizeMin: 1,
      sizeMax: 2,
      lifeMin: 0.1,
      lifeMax: 0.25,
      spread: Math.PI * 0.5,
    });
  }

  /** Rocket launch exhaust */
  launchExhaust(x: number, y: number) {
    this.emit(x, y, 5, ['#ffffff', '#ffea00', '#ff331c'], {
      speedMin: 40,
      speedMax: 100,
      sizeMin: 2,
      sizeMax: 4,
      lifeMin: 0.2,
      lifeMax: 0.6,
      spread: Math.PI * 0.3,
    });
  }
}

/** Floating score text that rises and fades */
export class FloatingText implements GameEntity {
  active = true;
  private x: number;
  private y: number;
  private text: string;
  private colour: string;
  private life: number;
  private maxLife: number;

  constructor(x: number, y: number, text: string, colour: string = '#ffea00', life: number = 1) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.colour = colour;
    this.life = life;
    this.maxLife = life;
  }

  update(dt: number) {
    this.y -= 20 * dt;
    this.life -= dt;
    if (this.life <= 0) this.active = false;
  }

  render(ctx: CanvasRenderingContext2D) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.colour;
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText(this.text, Math.floor(this.x), Math.floor(this.y));
    ctx.globalAlpha = 1;
  }
}
