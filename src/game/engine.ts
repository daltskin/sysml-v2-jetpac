// ── Game engine: fixed-timestep loop with Canvas 2D rendering ──

export interface GameEntity {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  active: boolean;
}

export class GameEngine {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private entities: GameEntity[] = [];
  private lastTime = 0;
  private accumulator = 0;
  private readonly FIXED_DT = 1 / 60; // 60 Hz physics
  private running = false;
  paused = false;
  private _shakeOffset = { x: 0, y: 0 };
  private _shakeTime = 0;
  private _shakeMagnitude = 0;

  // Virtual resolution (Jetpac was ~256×192, we scale up)
  readonly VIRTUAL_W = 480;
  readonly VIRTUAL_H = 360;

  // Callbacks
  onUpdate?: (dt: number) => void;
  onRender?: (ctx: CanvasRenderingContext2D) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const parent = this.canvas.parentElement!;
    // Temporarily clear inline size so the parent can resize freely
    this.canvas.style.width = '';
    this.canvas.style.height = '';
    const rect = parent.getBoundingClientRect();
    // Keep pixel-perfect ratio
    const scale = Math.min(rect.width / this.VIRTUAL_W, rect.height / this.VIRTUAL_H);
    this.canvas.width = this.VIRTUAL_W;
    this.canvas.height = this.VIRTUAL_H;
    this.canvas.style.width = `${this.VIRTUAL_W * scale}px`;
    this.canvas.style.height = `${this.VIRTUAL_H * scale}px`;
    this.canvas.style.margin = 'auto';
    this.ctx.imageSmoothingEnabled = false;
  }

  addEntity(entity: GameEntity) {
    this.entities.push(entity);
  }

  removeEntity(entity: GameEntity) {
    const idx = this.entities.indexOf(entity);
    if (idx !== -1) this.entities.splice(idx, 1);
  }

  clearEntities() {
    this.entities = [];
  }

  getEntities(): readonly GameEntity[] {
    return this.entities;
  }

  shake(magnitude: number, duration: number) {
    this._shakeMagnitude = magnitude;
    this._shakeTime = duration;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  stop() {
    this.running = false;
  }

  private loop(time: number) {
    if (!this.running) return;

    const frameTime = Math.min((time - this.lastTime) / 1000, 0.1); // cap at 100ms
    this.lastTime = time;
    this.accumulator += frameTime;

    // Fixed-step updates
    if (!this.paused) {
      while (this.accumulator >= this.FIXED_DT) {
        this.update(this.FIXED_DT);
        this.accumulator -= this.FIXED_DT;
      }
    } else {
      this.accumulator = 0; // discard accumulated time while paused
    }

    // Render
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number) {
    // Screen shake decay
    if (this._shakeTime > 0) {
      this._shakeTime -= dt;
      this._shakeOffset.x = (Math.random() - 0.5) * this._shakeMagnitude * 2;
      this._shakeOffset.y = (Math.random() - 0.5) * this._shakeMagnitude * 2;
      if (this._shakeTime <= 0) {
        this._shakeOffset.x = 0;
        this._shakeOffset.y = 0;
      }
    }

    // Update all entities
    for (const entity of this.entities) {
      if (entity.active) entity.update(dt);
    }

    // Remove dead entities
    this.entities = this.entities.filter((e) => e.active);

    this.onUpdate?.(dt);
  }

  private render() {
    const { ctx } = this;
    ctx.save();
    ctx.translate(this._shakeOffset.x, this._shakeOffset.y);

    // Clear with deep space background
    ctx.fillStyle = '#000008';
    ctx.fillRect(-2, -2, this.VIRTUAL_W + 4, this.VIRTUAL_H + 4);

    // Draw stars (static pattern based on level seed)
    this.drawStarfield(ctx);

    // Render all entities
    for (const entity of this.entities) {
      if (entity.active) entity.render(ctx);
    }

    this.onRender?.(ctx);

    ctx.restore();
  }

  private drawStarfield(ctx: CanvasRenderingContext2D) {
    // Deterministic star positions
    const seed = 42;
    for (let i = 0; i < 60; i++) {
      const x = ((seed * (i + 1) * 7919) % this.VIRTUAL_W);
      const y = ((seed * (i + 1) * 104729) % this.VIRTUAL_H);
      const brightness = 0.2 + (i % 5) * 0.15;
      const size = i % 7 === 0 ? 2 : 1;
      ctx.fillStyle = `rgba(200, 200, 255, ${brightness})`;
      ctx.fillRect(x, y, size, size);
    }
  }
}
