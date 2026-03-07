// ── Entity tests: alien, collectible, spaceman, platform ──

import { describe, it, expect, vi } from 'vitest';
import { Alien, getAlienPatternForLevel, spawnAlienWave } from '../src/game/entities/alien';
import { Collectible, spawnFalling } from '../src/game/entities/collectible';
import { Spaceman } from '../src/game/entities/spaceman';
import type { AlienPattern } from '../src/game/entities/alien';

const WORLD_W = 480;
const WORLD_H = 360;

// ── Alien tests ──
describe('Alien', () => {
  const ALL_PATTERNS: AlienPattern[] = [
    'meteor', 'jellyfish', 'drone', 'asteroid',
    'solar_flare', 'space_pirate', 'magnetic_mine', 'dust_devil',
  ];

  function makeAlien(pattern: AlienPattern = 'meteor', speed = 60) {
    return new Alien({ pattern, speed, x: 100, y: 100, worldW: WORLD_W, worldH: WORLD_H });
  }

  describe('construction', () => {
    it('should initialise with correct pattern and speed', () => {
      const a = makeAlien('jellyfish', 80);
      expect(a.pattern).toBe('jellyfish');
      expect(a.speed).toBe(80);
    });

    it('should have a 12×12 body', () => {
      const a = makeAlien();
      expect(a.body.width).toBe(12);
      expect(a.body.height).toBe(12);
    });

    it('should be active', () => {
      const a = makeAlien();
      expect(a.active).toBe(true);
    });
  });

  describe('movement patterns', () => {
    for (const pattern of ALL_PATTERNS) {
      it(`${pattern} should move after update`, () => {
        const a = makeAlien(pattern, 100);
        const startX = a.body.x;
        const startY = a.body.y;
        // Run several update frames
        for (let i = 0; i < 10; i++) a.update(1 / 60);
        // At least one coordinate should have changed
        const moved = a.body.x !== startX || a.body.y !== startY;
        expect(moved).toBe(true);
      });
    }

    it('space_pirate should track targetX', () => {
      const a = makeAlien('space_pirate', 100);
      a.targetX = 400;
      for (let i = 0; i < 30; i++) a.update(1 / 60);
      // Should have moved toward targetX (right)
      expect(a.body.x).toBeGreaterThan(100);
    });

    it('magnetic_mine should home toward target', () => {
      const a = makeAlien('magnetic_mine', 100);
      a.targetX = 300;
      a.targetY = 200;
      for (let i = 0; i < 30; i++) a.update(1 / 60);
      // Should be closer to the target
      const dx = Math.abs(a.body.x - 300);
      const dy = Math.abs(a.body.y - 200);
      expect(dx).toBeLessThan(200); // moved closer from 100→300
      expect(dy).toBeLessThan(100); // moved closer from 100→200
    });

    it('dust_devil should orbit around start position', () => {
      const a = makeAlien('dust_devil', 100);
      const positions = new Set<string>();
      for (let i = 0; i < 60; i++) {
        a.update(1 / 60);
        positions.add(`${Math.round(a.body.x)},${Math.round(a.body.y)}`);
      }
      // Should visit multiple positions
      expect(positions.size).toBeGreaterThan(5);
    });
  });

  describe('boundary behaviour', () => {
    it('should bounce off the top edge', () => {
      const a = makeAlien('meteor', 200);
      a.body.y = 10;
      a.update(1 / 60);
      expect(a.body.y).toBeGreaterThanOrEqual(24);
    });

    it('should bounce off the bottom edge', () => {
      const a = makeAlien('meteor', 200);
      a.body.y = WORLD_H - 5;
      a.update(1 / 60);
      expect(a.body.y + a.body.height).toBeLessThanOrEqual(WORLD_H);
    });
  });

  describe('spriteName', () => {
    for (let i = 0; i < ALL_PATTERNS.length; i++) {
      it(`${ALL_PATTERNS[i]} → alien${i + 1}`, () => {
        const a = makeAlien(ALL_PATTERNS[i]);
        expect(a.spriteName).toBe(`alien${i + 1}`);
      });
    }
  });
});

describe('getAlienPatternForLevel', () => {
  it('should cycle through 8 patterns', () => {
    const patterns: AlienPattern[] = [];
    for (let level = 1; level <= 8; level++) {
      patterns.push(getAlienPatternForLevel(level));
    }
    expect(new Set(patterns).size).toBe(8);
  });

  it('level 1 → meteor', () => {
    expect(getAlienPatternForLevel(1)).toBe('meteor');
  });

  it('should wrap (level 9 → same as level 1)', () => {
    expect(getAlienPatternForLevel(9)).toBe(getAlienPatternForLevel(1));
  });
});

describe('spawnAlienWave', () => {
  it('should spawn the requested number of aliens', () => {
    const wave = spawnAlienWave(5, 'jellyfish', 60, WORLD_W, WORLD_H);
    expect(wave).toHaveLength(5);
    expect(wave.every((a) => a.pattern === 'jellyfish')).toBe(true);
  });

  it('should place aliens within world bounds', () => {
    const wave = spawnAlienWave(20, 'drone', 80, WORLD_W, WORLD_H);
    for (const a of wave) {
      expect(a.body.x).toBeGreaterThanOrEqual(0);
      expect(a.body.x).toBeLessThan(WORLD_W);
      expect(a.body.y).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── Collectible tests ──
describe('Collectible', () => {
  it('should initialise fuel_cell with 8×8 body', () => {
    const c = new Collectible({ type: 'fuel_cell', x: 50, y: 0 });
    expect(c.body.width).toBe(8);
    expect(c.body.height).toBe(8);
    expect(c.type).toBe('fuel_cell');
  });

  it('should initialise rocket_part with 16×32 body', () => {
    const c = new Collectible({ type: 'rocket_part', x: 50, y: 0, subtype: 'rocket_base' });
    expect(c.body.width).toBe(16);
    expect(c.body.height).toBe(32);
    expect(c.subtype).toBe('rocket_base');
  });

  it('should fall under gravity', () => {
    const c = new Collectible({ type: 'gem', x: 50, y: 0 });
    expect(c.body.vy).toBe(0);
    c.update(1 / 60);
    expect(c.body.vy).toBeGreaterThan(0);
    expect(c.body.y).toBeGreaterThan(0);
  });

  it('should stop on floor', () => {
    const c = new Collectible({ type: 'fuel_cell', x: 50, y: 340 });
    c.update(1 / 60);
    c.collidePlatforms([], 348);
    // Should now be landed
    const yBefore = c.body.y;
    c.update(1 / 60);
    c.collidePlatforms([], 348);
    // If landed, y shouldn't keep increasing
    expect(c.body.y).toBeCloseTo(yBefore, 0);
  });

  it('should stop on platform', () => {
    const c = new Collectible({ type: 'gem', x: 50, y: 90 });
    const platform = { x: 40, y: 100, width: 60, height: 8 };
    // Let it fall
    for (let i = 0; i < 10; i++) {
      c.update(1 / 60);
      c.collidePlatforms([platform], 360);
    }
    expect(c.body.y + c.body.height).toBeLessThanOrEqual(platform.y + 2);
  });

  describe('spriteName', () => {
    it('fuel_cell → fuel_cell', () => {
      const c = new Collectible({ type: 'fuel_cell', x: 0, y: 0 });
      expect(c.spriteName).toBe('fuel_cell');
    });

    it('rocket_part with subtype → subtype', () => {
      const c = new Collectible({ type: 'rocket_part', x: 0, y: 0, subtype: 'rocket_top' });
      expect(c.spriteName).toBe('rocket_top');
    });
  });
});

describe('spawnFalling', () => {
  it('should create a collectible above the screen', () => {
    const c = spawnFalling('fuel_cell', WORLD_W);
    expect(c.body.y).toBeLessThan(0);
    expect(c.body.x).toBeGreaterThanOrEqual(20);
    expect(c.body.x).toBeLessThan(WORLD_W - 20);
  });
});

// ── Spaceman tests ──
describe('Spaceman', () => {
  // Minimal mock of InputHandler (constructor accesses window)
  function mockInput() {
    return {
      isHeld: vi.fn().mockReturnValue(false),
      wasPressed: vi.fn().mockReturnValue(false),
      flush: vi.fn(),
      clearAll: vi.fn(),
      onAnyKey: vi.fn(),
    } as any;
  }

  it('should start at centre with 3 lives', () => {
    const s = new Spaceman(mockInput(), WORLD_W, WORLD_H);
    expect(s.lives).toBe(3);
    expect(s.score).toBe(0);
    expect(s.carrying).toBeNull();
  });

  it('should not carry anything initially', () => {
    const s = new Spaceman(mockInput(), WORLD_W, WORLD_H);
    expect(s.carrying).toBeNull();
  });

  it('should have 16×16 body', () => {
    const s = new Spaceman(mockInput(), WORLD_W, WORLD_H);
    expect(s.body.width).toBe(16);
    expect(s.body.height).toBe(16);
  });

  describe('movement', () => {
    it('should move left when left is held', () => {
      const input = mockInput();
      input.isHeld.mockImplementation((a: string) => a === 'left');
      const s = new Spaceman(input, WORLD_W, WORLD_H);
      const startX = s.body.x;
      s.update(1 / 60);
      expect(s.body.vx).toBeLessThan(0);
      expect(s.facingLeft).toBe(true);
    });

    it('should move right when right is held', () => {
      const input = mockInput();
      input.isHeld.mockImplementation((a: string) => a === 'right');
      const s = new Spaceman(input, WORLD_W, WORLD_H);
      s.update(1 / 60);
      expect(s.body.vx).toBeGreaterThan(0);
      expect(s.facingLeft).toBe(false);
    });

    it('should thrust upward', () => {
      const input = mockInput();
      input.isHeld.mockImplementation((a: string) => a === 'thrust');
      const s = new Spaceman(input, WORLD_W, WORLD_H);
      s.body.grounded = false;
      s.update(1 / 60);
      expect(s.body.vy).toBeLessThan(0);
      expect(s.thrusting).toBe(true);
    });
  });

  describe('hit', () => {
    it('should lose a life on hit', () => {
      const s = new Spaceman(mockInput(), WORLD_W, WORLD_H);
      s.invulnerable = 0;
      s.hit();
      expect(s.lives).toBe(2);
    });

    it('should drop carried item on hit', () => {
      const s = new Spaceman(mockInput(), WORLD_W, WORLD_H);
      s.invulnerable = 0;
      s.carrying = { type: 'fuel_cell' };
      const onDrop = vi.fn();
      s.onDrop = onDrop;
      s.hit();
      expect(s.carrying).toBeNull();
      expect(onDrop).toHaveBeenCalled();
    });

    it('should not take damage while invulnerable', () => {
      const s = new Spaceman(mockInput(), WORLD_W, WORLD_H);
      s.invulnerable = 2;
      s.hit();
      expect(s.lives).toBe(3);
    });

    it('should trigger onDeath when lives reach 0', () => {
      const s = new Spaceman(mockInput(), WORLD_W, WORLD_H);
      s.invulnerable = 0;
      const onDeath = vi.fn();
      s.onDeath = onDeath;
      s.hit(); s.invulnerable = 0;
      s.hit(); s.invulnerable = 0;
      s.hit();
      expect(s.lives).toBe(0);
      expect(onDeath).toHaveBeenCalled();
      expect(s.active).toBe(false);
    });
  });

  describe('reset', () => {
    it('should clear velocity and carrying', () => {
      const s = new Spaceman(mockInput(), WORLD_W, WORLD_H);
      s.body.vx = 100;
      s.body.vy = -50;
      s.carrying = { type: 'gem' };
      s.reset(50, 100);
      expect(s.body.x).toBe(50);
      expect(s.body.y).toBe(100);
      expect(s.body.vx).toBe(0);
      expect(s.body.vy).toBe(0);
      expect(s.carrying).toBeNull();
    });

    it('should grant brief invulnerability', () => {
      const s = new Spaceman(mockInput(), WORLD_W, WORLD_H);
      s.invulnerable = 0;
      s.reset(50, 100);
      expect(s.invulnerable).toBeGreaterThan(0);
    });
  });

  describe('insideRocket', () => {
    it('should skip update when insideRocket is true', () => {
      const input = mockInput();
      input.isHeld.mockReturnValue(true);
      const s = new Spaceman(input, WORLD_W, WORLD_H);
      s.insideRocket = true;
      const startX = s.body.x;
      s.update(1 / 60);
      expect(s.body.x).toBe(startX);
    });
  });
});
