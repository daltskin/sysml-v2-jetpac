// ── Rocket entity tests ──
// Tests assembly, fuelling, launch phases

import { describe, it, expect, vi } from 'vitest';
import { Rocket, type RocketPhase } from '../src/game/entities/rocket';

function makeRocket(groundY = 352, x = 232) {
  return new Rocket(x, groundY);
}

describe('Rocket', () => {
  describe('initial state', () => {
    it('should start in building phase', () => {
      const r = makeRocket();
      expect(r.phase).toBe('building');
    });

    it('should have 3 parts, all unplaced', () => {
      const r = makeRocket();
      expect(r.parts).toHaveLength(3);
      expect(r.parts.every((p) => !p.placed)).toBe(true);
    });

    it('should have 0 fuel', () => {
      const r = makeRocket();
      expect(r.fuel).toBe(0);
    });

    it('should need base as first part', () => {
      const r = makeRocket();
      expect(r.nextPartNeeded).toBe('base');
    });

    it('should be active', () => {
      const r = makeRocket();
      expect(r.active).toBe(true);
    });
  });

  describe('placePart', () => {
    it('should place parts in order: base → mid → top', () => {
      const r = makeRocket();
      expect(r.placePart('base')).toBe(true);
      expect(r.nextPartNeeded).toBe('mid');
      expect(r.placePart('mid')).toBe(true);
      expect(r.nextPartNeeded).toBe('top');
      expect(r.placePart('top')).toBe(true);
      expect(r.nextPartNeeded).toBeNull();
    });

    it('should reject out-of-order parts', () => {
      const r = makeRocket();
      expect(r.placePart('mid')).toBe(false);
      expect(r.placePart('top')).toBe(false);
    });

    it('should transition to fuelling after all parts placed', () => {
      const r = makeRocket();
      r.placePart('base');
      r.placePart('mid');
      expect(r.phase).toBe('building');
      r.placePart('top');
      expect(r.phase).toBe('fuelling');
    });

    it('should track placedCount', () => {
      const r = makeRocket();
      expect(r.placedCount).toBe(0);
      r.placePart('base');
      expect(r.placedCount).toBe(1);
      r.placePart('mid');
      expect(r.placedCount).toBe(2);
      r.placePart('top');
      expect(r.placedCount).toBe(3);
    });
  });

  describe('addFuel', () => {
    it('should not accept fuel in building phase', () => {
      const r = makeRocket();
      expect(r.addFuel()).toBe(false);
    });

    it('should accept fuel in fuelling phase', () => {
      const r = makeRocket();
      r.placePart('base');
      r.placePart('mid');
      r.placePart('top');
      expect(r.addFuel()).toBe(false); // not yet full
      expect(r.fuel).toBe(1);
    });

    it('should transition to ready when fully fuelled', () => {
      const r = makeRocket();
      r.placePart('base');
      r.placePart('mid');
      r.placePart('top');
      r.fuelNeeded = 3;
      r.addFuel();
      r.addFuel();
      expect(r.phase).toBe('fuelling');
      expect(r.addFuel()).toBe(true);
      expect(r.phase).toBe('ready');
    });
  });

  describe('startLaunch', () => {
    it('should not launch when not ready', () => {
      const r = makeRocket();
      r.startLaunch();
      expect(r.phase).toBe('building');
    });

    it('should transition to launching when ready', () => {
      const r = makeRocket();
      r.placePart('base');
      r.placePart('mid');
      r.placePart('top');
      r.fuelNeeded = 1;
      r.addFuel();
      r.startLaunch();
      expect(r.phase).toBe('launching');
    });
  });

  describe('launch update', () => {
    function launchReady(): Rocket {
      const r = makeRocket();
      r.placePart('base');
      r.placePart('mid');
      r.placePart('top');
      r.fuelNeeded = 1;
      r.addFuel();
      r.startLaunch();
      return r;
    }

    it('should accumulate launchY during launching', () => {
      const r = launchReady();
      r.update(1 / 60);
      expect(r.launchY).toBeGreaterThan(0);
    });

    it('should call onLaunchComplete after enough time', () => {
      const r = launchReady();
      const cb = vi.fn();
      r.onLaunchComplete = cb;
      // Run enough frames to finish launch
      for (let i = 0; i < 300; i++) r.update(1 / 60);
      expect(r.phase).toBe('gone');
      expect(cb).toHaveBeenCalledOnce();
    });

    it('should not update launchY when not launching', () => {
      const r = makeRocket();
      r.update(1 / 60);
      expect(r.launchY).toBe(0);
    });
  });

  describe('dropZone', () => {
    it('should provide generous zone when no parts placed', () => {
      const r = makeRocket(352, 232);
      const dz = r.dropZone;
      expect(dz.width).toBeGreaterThan(16);
      expect(dz.height).toBeGreaterThan(0);
    });

    it('should grow as more parts are placed', () => {
      const r = makeRocket();
      r.placePart('base');
      const dz1 = r.dropZone;
      r.placePart('mid');
      const dz2 = r.dropZone;
      // 2 parts should be taller than 1 part
      expect(dz2.height).toBeGreaterThan(dz1.height);
    });
  });

  describe('topY', () => {
    it('should decrease as parts are stacked', () => {
      const r = makeRocket(352);
      const top0 = r.topY;
      r.placePart('base');
      expect(r.topY).toBeLessThan(top0);
      r.placePart('mid');
      expect(r.topY).toBeLessThan(top0);
    });
  });
});
