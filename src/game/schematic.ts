// ── Shuttle Blueprint Schematic ──
// Progressive wireframe → detailed blueprint of Space Shuttle Atlantis.
// Each level's SysML concept maps to a shuttle subsystem that gets
// detailed as the player progresses.

/** Which subsystem sections have been unlocked (by completing a level) */
export interface SchematicState {
  /** Levels completed (1-indexed level ids) */
  completedLevels: Set<number>;
}

// ── Subsystem mapping: level id → shuttle region to detail ──
// Foundation  1-5:  overall structure
// Structure   6-10: interfaces, connections, types
// Behaviour  11-15: engines, states, constraints
// Mastery    16-20: integration & verification
const SUBSYSTEM_MAP: Record<number, SubsystemId> = {
  1: 'frame',        // Package → overall wireframe
  2: 'engine',       // Part def → RocketEngine
  3: 'engine',       // Attribute → engine thrust detail
  4: 'fuselage',     // Part usage → spacecraft body
  5: 'fuselage',     // Comment → documentation labels
  6: 'fuelSystem',   // Port def → fuel ports
  7: 'fuelSystem',   // Connection → tank-to-engine piping
  8: 'fuelSystem',   // Item def → fuel
  9: 'avionics',     // Enum → thrust modes
  10: 'engine',      // Specialisation → IonEngine
  11: 'engine',      // Action def → launch action
  12: 'avionics',    // State def → flight states
  13: 'avionics',    // Transition → state transitions
  14: 'heatShield',  // Constraint → thermal protection
  15: 'fuelSystem',  // Requirement → fuel requirement
  16: 'payload',     // Use case → orbital insertion
  17: 'avionics',    // Allocation → flight computer
  18: 'fuelSystem',  // Flow connection → fuel flow
  19: 'heatShield',  // Verification → thermal verify
  20: 'complete',    // Complete model → full detail
};

type SubsystemId = 'frame' | 'engine' | 'fuselage' | 'fuelSystem' | 'avionics' | 'heatShield' | 'payload' | 'complete';

/** Colour palette for the blueprint */
const BP = {
  bg: '#060818',
  gridLine: 'rgba(0, 100, 180, 0.08)',
  wireframe: 'rgba(0, 180, 220, 0.25)',
  wireBright: 'rgba(0, 220, 255, 0.5)',
  detailed: '#00ddff',
  detailedDim: '#006688',
  highlight: '#00ff88',
  highlightGlow: 'rgba(0, 255, 136, 0.3)',
  label: '#5588aa',
  labelBright: '#88ccee',
  accent: '#ff8844',
  accentDim: '#884422',
  white: '#ddeeff',
};

export class ShuttleSchematic {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: SchematicState;
  private activeSubsystem: SubsystemId | null = null;
  private animT = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.state = { completedLevels: new Set() };
  }

  /** Mark a level as complete, unlocking its subsystem detail */
  completeLevel(levelId: number) {
    this.state.completedLevels.add(levelId);
  }

  /** Restore from saved progress */
  setCompletedLevels(levels: number[]) {
    this.state.completedLevels = new Set(levels);
  }

  /** Set which subsystem is currently being worked on (glowing highlight) */
  setActiveLevel(levelId: number) {
    this.activeSubsystem = SUBSYSTEM_MAP[levelId] ?? null;
  }

  /** Is a subsystem fully detailed? */
  private isDetailed(sub: SubsystemId): boolean {
    if (sub === 'complete') return this.state.completedLevels.has(20);
    // A subsystem is detailed if ANY of the levels mapping to it are complete
    for (const [lvl, s] of Object.entries(SUBSYSTEM_MAP)) {
      if (s === sub && this.state.completedLevels.has(Number(lvl))) return true;
    }
    return false;
  }

  /** Detail level: how many levels for this subsystem are complete */
  private detailLevel(sub: SubsystemId): number {
    let count = 0;
    for (const [lvl, s] of Object.entries(SUBSYSTEM_MAP)) {
      if (s === sub && this.state.completedLevels.has(Number(lvl))) count++;
    }
    return count;
  }

  /** Full render pass */
  render() {
    this.animT = Date.now() / 1000;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const ctx = this.ctx;

    // Clear
    ctx.fillStyle = BP.bg;
    ctx.fillRect(0, 0, W, H);

    // Blueprint grid
    this.drawGrid(W, H);

    // Centre the shuttle — it draws in a roughly 120×200 zone
    ctx.save();
    const scale = Math.min(W / 160, H / 240);
    ctx.translate(W / 2, H / 2);
    ctx.scale(scale, scale);

    // Draw shuttle from back to front (painter's order)
    this.drawFrame();
    this.drawEngine();
    this.drawFuelSystem();
    this.drawFuselage();
    this.drawHeatShield();
    this.drawAvionics();
    this.drawPayload();

    // Title label
    ctx.restore();
    this.drawTitle(W, H);

    // Completion percentage
    this.drawProgress(W, H);
  }

  // ── Grid background ──
  private drawGrid(W: number, H: number) {
    const ctx = this.ctx;
    ctx.strokeStyle = BP.gridLine;
    ctx.lineWidth = 1;
    const step = 20;
    for (let x = 0; x < W; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  // ── Subsystem helpers ──
  private subStyle(sub: SubsystemId): { stroke: string; fill: string; lineW: number } {
    const active = this.activeSubsystem === sub;
    const detailed = this.isDetailed(sub);
    const pulse = active ? 0.5 + 0.5 * Math.sin(this.animT * 4) : 0;

    if (detailed && active) {
      return { stroke: BP.highlight, fill: BP.highlightGlow, lineW: 1.5 };
    }
    if (detailed) {
      return { stroke: BP.detailed, fill: 'rgba(0, 221, 255, 0.06)', lineW: 1 };
    }
    if (active) {
      const a = (0.3 + pulse * 0.4).toFixed(2);
      return { stroke: `rgba(0, 255, 136, ${a})`, fill: `rgba(0, 255, 136, ${(pulse * 0.1).toFixed(2)})`, lineW: 1.2 };
    }
    return { stroke: BP.wireframe, fill: 'transparent', lineW: 0.5 };
  }

  private applyStyle(sub: SubsystemId) {
    const s = this.subStyle(sub);
    this.ctx.strokeStyle = s.stroke;
    this.ctx.fillStyle = s.fill;
    this.ctx.lineWidth = s.lineW;
  }

  private drawLabel(x: number, y: number, text: string, sub: SubsystemId) {
    const ctx = this.ctx;
    const detailed = this.isDetailed(sub);
    const active = this.activeSubsystem === sub;
    ctx.save();
    ctx.font = '4px monospace';
    ctx.fillStyle = active ? BP.highlight : (detailed ? BP.labelBright : BP.label);
    ctx.globalAlpha = detailed || active ? 1 : 0.4;
    ctx.textAlign = 'left';
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  // ── Frame: overall shuttle outline (level 1) ──
  private drawFrame() {
    const ctx = this.ctx;
    this.applyStyle('frame');

    // Orbiter outline: nose to tail
    ctx.beginPath();
    // Nose
    ctx.moveTo(0, -95);
    ctx.lineTo(-8, -80);
    ctx.lineTo(-18, -60);
    // Fuselage left side
    ctx.lineTo(-20, -40);
    ctx.lineTo(-22, 0);
    // Wing left
    ctx.lineTo(-55, 40);
    ctx.lineTo(-50, 50);
    ctx.lineTo(-22, 35);
    // Engine section
    ctx.lineTo(-22, 60);
    ctx.lineTo(-18, 65);
    // Tail
    ctx.lineTo(0, 70);
    // Right side (mirrored)
    ctx.lineTo(18, 65);
    ctx.lineTo(22, 60);
    ctx.lineTo(22, 35);
    ctx.lineTo(50, 50);
    ctx.lineTo(55, 40);
    ctx.lineTo(22, 0);
    ctx.lineTo(20, -40);
    ctx.lineTo(18, -60);
    ctx.lineTo(8, -80);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Vertical stabiliser (tail fin)
    ctx.beginPath();
    ctx.moveTo(-2, 30); ctx.lineTo(0, -5); ctx.lineTo(2, 30);
    ctx.closePath();
    ctx.stroke();

    // SRBs (left and right)
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 32, -50);
      ctx.lineTo(side * 30, -55);
      ctx.lineTo(side * 30, 60);
      ctx.lineTo(side * 34, 65);
      ctx.lineTo(side * 34, 60);
      ctx.lineTo(side * 34, -50);
      ctx.closePath();
      ctx.stroke();
    }

    // External Tank (centre, behind orbiter)
    ctx.beginPath();
    ctx.moveTo(-8, -70);
    ctx.quadraticCurveTo(-10, -75, 0, -80);
    ctx.quadraticCurveTo(10, -75, 8, -70);
    ctx.lineTo(8, 60);
    ctx.lineTo(-8, 60);
    ctx.closePath();
    ctx.stroke();

    this.drawLabel(-55, -90, 'SHUTTLE ATLANTIS', 'frame');
  }

  // ── Engine subsystem (levels 2, 3, 10, 11) ──
  private drawEngine() {
    const ctx = this.ctx;
    this.applyStyle('engine');
    const dl = this.detailLevel('engine');

    // 3 SSME nozzles
    const nozzles = [[-10, 62], [0, 65], [10, 62]];
    for (const [nx, ny] of nozzles) {
      ctx.beginPath();
      ctx.ellipse(nx, ny, 5, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (dl >= 1) ctx.fill();
    }

    // Engine detail: thrust vector lines
    if (dl >= 2) {
      ctx.save();
      ctx.setLineDash([2, 2]);
      for (const [nx, ny] of nozzles) {
        ctx.beginPath();
        ctx.moveTo(nx, ny + 3);
        ctx.lineTo(nx, ny + 18);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
      this.drawLabel(14, 73, 'SSME ×3', 'engine');
    }

    // Turbo-pump detail
    if (dl >= 3) {
      ctx.beginPath();
      ctx.rect(-14, 52, 28, 8);
      ctx.stroke();
      this.drawLabel(-14, 50, 'TURBO-PUMP', 'engine');
    }

    // Ion engine detail (specialisation)
    if (dl >= 4) {
      ctx.save();
      ctx.strokeStyle = BP.accent;
      ctx.beginPath();
      ctx.moveTo(-6, 68); ctx.lineTo(-6, 78);
      ctx.moveTo(0, 71); ctx.lineTo(0, 82);
      ctx.moveTo(6, 68); ctx.lineTo(6, 78);
      ctx.stroke();
      this.drawLabel(14, 80, 'ION DRIVE', 'engine');
      ctx.restore();
    }

    // SRB nozzles
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(side * 32, 65, 3, 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ── Fuel system (levels 6, 7, 8, 15, 18) ──
  private drawFuelSystem() {
    const ctx = this.ctx;
    this.applyStyle('fuelSystem');
    const dl = this.detailLevel('fuelSystem');

    // External Tank body is already drawn in frame outline
    // Add ET interior detail

    if (dl >= 1) {
      // LOX/LH2 fill lines
      ctx.save();
      ctx.setLineDash([1, 2]);
      ctx.beginPath();
      ctx.moveTo(-6, -60); ctx.lineTo(-6, 50);
      ctx.moveTo(6, -60); ctx.lineTo(6, 50);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      this.drawLabel(12, -65, 'LOX TANK', 'fuelSystem');
    }

    if (dl >= 2) {
      // ET divider (LOX/LH2 boundary)
      ctx.beginPath();
      ctx.moveTo(-7, -10); ctx.lineTo(7, -10);
      ctx.stroke();
      this.drawLabel(12, -8, 'LH₂ TANK', 'fuelSystem');

      // Feed lines to engines
      ctx.save();
      ctx.setLineDash([2, 1]);
      ctx.beginPath();
      ctx.moveTo(-6, 50); ctx.lineTo(-10, 60);
      ctx.moveTo(6, 50); ctx.lineTo(10, 60);
      ctx.moveTo(0, 50); ctx.lineTo(0, 63);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    if (dl >= 3) {
      // Port indicators on ET
      for (const y of [-45, -25, 5, 25]) {
        ctx.beginPath();
        ctx.arc(-7, y, 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(7, y, 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      this.drawLabel(-55, 0, 'FUEL PORTS', 'fuelSystem');
    }

    if (dl >= 4) {
      // Flow arrows
      ctx.save();
      ctx.strokeStyle = BP.accent;
      const arrowY = [20, 30, 40];
      for (const y of arrowY) {
        ctx.beginPath();
        ctx.moveTo(-4, y); ctx.lineTo(-4, y + 6);
        ctx.lineTo(-6, y + 4); ctx.moveTo(-4, y + 6); ctx.lineTo(-2, y + 4);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (dl >= 5) {
      // Requirement badge
      ctx.save();
      ctx.strokeStyle = BP.highlight;
      ctx.beginPath();
      ctx.rect(-4, -55, 8, 6);
      ctx.stroke();
      ctx.font = '3px monospace';
      ctx.fillStyle = BP.highlight;
      ctx.textAlign = 'center';
      ctx.fillText('REQ', 0, -51);
      ctx.restore();
    }
  }

  // ── Fuselage detail (levels 4, 5) ──
  private drawFuselage() {
    const ctx = this.ctx;
    this.applyStyle('fuselage');
    const dl = this.detailLevel('fuselage');

    if (dl >= 1) {
      // Internal bulkhead lines
      ctx.save();
      ctx.setLineDash([3, 3]);
      for (const y of [-50, -20, 10, 35]) {
        ctx.beginPath();
        ctx.moveTo(-18, y); ctx.lineTo(18, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
      this.drawLabel(24, -48, 'FWD BULK', 'fuselage');
      this.drawLabel(24, -18, 'MID SECTION', 'fuselage');
    }

    if (dl >= 2) {
      // Documentation labels on blueprint
      const labels = [
        [-16, -60, 'CREW MODULE'],
        [-16, -30, 'PAYLOAD BAY'],
        [-16, 20, 'AFT SECTION'],
      ];
      for (const [lx, ly, txt] of labels) {
        this.drawLabel(lx as number, ly as number, txt as string, 'fuselage');
      }
    }
  }

  // ── Avionics (levels 9, 12, 13, 17) ──
  private drawAvionics() {
    const ctx = this.ctx;
    this.applyStyle('avionics');
    const dl = this.detailLevel('avionics');

    if (dl >= 1) {
      // Flight computer box in cockpit area
      ctx.beginPath();
      ctx.rect(-12, -75, 24, 10);
      ctx.stroke();
      if (dl >= 2) ctx.fill();
      this.drawLabel(-12, -78, 'AVIONICS BAY', 'avionics');
    }

    if (dl >= 2) {
      // State indicator lights
      const states = [
        [-8, -72, 'IDLE'],
        [-1, -72, 'IGN'],
        [6, -72, 'FLT'],
      ];
      for (const [sx, sy, _label] of states) {
        ctx.beginPath();
        ctx.arc(sx as number + 2, sy as number + 2, 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (dl >= 3) {
      // Wiring harness from avionics to engines
      ctx.save();
      ctx.setLineDash([1, 2]);
      ctx.beginPath();
      ctx.moveTo(0, -65); ctx.lineTo(0, -40);
      ctx.lineTo(-15, 50);
      ctx.moveTo(0, -40); ctx.lineTo(15, 50);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      this.drawLabel(-55, -75, 'WIRE HARNESS', 'avionics');
    }

    if (dl >= 4) {
      // Allocation marker
      ctx.save();
      ctx.strokeStyle = BP.accent;
      ctx.beginPath();
      ctx.moveTo(-12, -70); ctx.lineTo(-25, -70);
      ctx.lineTo(-25, -60); ctx.lineTo(-12, -60);
      ctx.stroke();
      this.drawLabel(-55, -63, 'FLT COMPUTER', 'avionics');
      ctx.restore();
    }
  }

  // ── Heat shield (levels 14, 19) ──
  private drawHeatShield() {
    const ctx = this.ctx;
    this.applyStyle('heatShield');
    const dl = this.detailLevel('heatShield');

    if (dl >= 1) {
      // TPS tile pattern on belly
      ctx.save();
      ctx.globalAlpha = 0.4;
      for (let y = -40; y < 55; y += 6) {
        for (let x = -16; x < 16; x += 4) {
          ctx.strokeRect(x, y, 4, 6);
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      this.drawLabel(-55, 20, 'TPS TILES', 'heatShield');
    }

    if (dl >= 2) {
      // Verification check marks
      ctx.save();
      ctx.strokeStyle = BP.highlight;
      ctx.lineWidth = 1.5;
      const checks = [[-15, -30], [-15, 0], [-15, 30]];
      for (const [cx, cy] of checks) {
        ctx.beginPath();
        ctx.moveTo(cx - 2, cy); ctx.lineTo(cx, cy + 2); ctx.lineTo(cx + 3, cy - 3);
        ctx.stroke();
      }
      ctx.restore();
      this.drawLabel(-55, 35, 'VERIFIED ✓', 'heatShield');
    }
  }

  // ── Payload bay (level 16) ──
  private drawPayload() {
    const ctx = this.ctx;
    this.applyStyle('payload');
    const dl = this.detailLevel('payload');

    if (dl >= 1) {
      // Payload bay doors (open)
      ctx.beginPath();
      ctx.moveTo(-18, -20); ctx.lineTo(-28, -20);
      ctx.lineTo(-28, 10); ctx.lineTo(-18, 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(18, -20); ctx.lineTo(28, -20);
      ctx.lineTo(28, 10); ctx.lineTo(18, 10);
      ctx.stroke();

      // Satellite payload inside
      ctx.beginPath();
      ctx.rect(-6, -15, 12, 20);
      ctx.stroke();
      ctx.beginPath();
      // Solar panel arms
      ctx.moveTo(-6, -5); ctx.lineTo(-14, -5);
      ctx.moveTo(6, -5); ctx.lineTo(14, -5);
      ctx.stroke();

      this.drawLabel(30, -18, 'PAYLOAD', 'payload');
      this.drawLabel(30, -12, 'BAY DOORS', 'payload');
    }
  }

  // ── Title ──
  private drawTitle(W: number, H: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = BP.label;
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.6;
    ctx.fillText('BLUEPRINT', W / 2, 12);
    ctx.restore();
  }

  // ── Progress bar ──
  private drawProgress(W: number, H: number) {
    const ctx = this.ctx;
    const total = 20;
    const done = this.state.completedLevels.size;
    const pct = done / total;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 100, 180, 0.2)';
    ctx.fillRect(8, H - 14, W - 16, 6);
    ctx.fillStyle = pct >= 1 ? BP.highlight : BP.detailed;
    ctx.fillRect(8, H - 14, (W - 16) * pct, 6);
    ctx.strokeStyle = 'rgba(0, 180, 220, 0.3)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(8, H - 14, W - 16, 6);

    ctx.font = '6px monospace';
    ctx.fillStyle = BP.labelBright;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(pct * 100)}%`, W / 2, H - 4);
    ctx.restore();
  }
}
