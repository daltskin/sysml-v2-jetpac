// ── Physics tests ──
// Tests gravity, velocity, collisions, wraparound

import { describe, it, expect } from 'vitest';
import {
  applyGravity,
  applyVelocity,
  applyWraparound,
  collidePlatform,
  collideFloor,
  collideCeiling,
  overlaps,
  containsPoint,
  GRAVITY,
  MAX_FALL_SPEED,
  WRAP_MARGIN,
  type PhysicsBody,
  type PlatformRect,
} from '../src/game/physics';

function makeBody(overrides: Partial<PhysicsBody> = {}): PhysicsBody {
  return {
    x: 100, y: 100, vx: 0, vy: 0,
    width: 16, height: 16, grounded: false,
    ...overrides,
  };
}

describe('applyGravity', () => {
  it('should increase vy by GRAVITY * dt', () => {
    const body = makeBody({ vy: 0 });
    applyGravity(body, 1 / 60);
    expect(body.vy).toBeCloseTo(GRAVITY / 60, 1);
  });

  it('should cap vy at MAX_FALL_SPEED', () => {
    const body = makeBody({ vy: MAX_FALL_SPEED - 1 });
    applyGravity(body, 1);
    expect(body.vy).toBe(MAX_FALL_SPEED);
  });

  it('should accumulate over multiple frames', () => {
    const body = makeBody({ vy: 0 });
    for (let i = 0; i < 10; i++) applyGravity(body, 1 / 60);
    expect(body.vy).toBeCloseTo(GRAVITY * 10 / 60, 0);
  });
});

describe('applyVelocity', () => {
  it('should move body by velocity * dt', () => {
    const body = makeBody({ x: 10, y: 20, vx: 60, vy: 120 });
    applyVelocity(body, 0.5);
    expect(body.x).toBe(40);
    expect(body.y).toBe(80);
  });

  it('should handle negative velocities', () => {
    const body = makeBody({ x: 100, y: 100, vx: -100, vy: -50 });
    applyVelocity(body, 1);
    expect(body.x).toBe(0);
    expect(body.y).toBe(50);
  });

  it('should not move with zero velocity', () => {
    const body = makeBody({ x: 50, y: 60 });
    applyVelocity(body, 1);
    expect(body.x).toBe(50);
    expect(body.y).toBe(60);
  });
});

describe('applyWraparound', () => {
  const worldW = 480;

  it('should wrap body from left to right', () => {
    const body = makeBody({ x: -(16 + WRAP_MARGIN + 1), width: 16 });
    applyWraparound(body, worldW);
    expect(body.x).toBeCloseTo(worldW + WRAP_MARGIN - 16, 0);
  });

  it('should wrap body from right to left', () => {
    const body = makeBody({ x: worldW + WRAP_MARGIN + 1, width: 16 });
    applyWraparound(body, worldW);
    expect(body.x).toBe(-WRAP_MARGIN);
  });

  it('should not wrap body in the middle', () => {
    const body = makeBody({ x: 200 });
    applyWraparound(body, worldW);
    expect(body.x).toBe(200);
  });
});

describe('collidePlatform', () => {
  const platform: PlatformRect = { x: 80, y: 200, width: 100, height: 6 };

  it('should land on platform when falling from above', () => {
    // Simulate body falling through the platform surface
    const body = makeBody({ x: 100, y: 200 - 16 + 2, vy: 100, height: 16 });
    // Approximate previous bottom at 200 - 2 + 16 - (100/60) ≈ 200.3 (just barely above)
    const hit = collidePlatform(body, platform);
    expect(hit).toBe(true);
    expect(body.y).toBe(200 - 16);
    expect(body.vy).toBe(0);
    expect(body.grounded).toBe(true);
  });

  it('should not collide when moving upward', () => {
    const body = makeBody({ x: 100, y: 200, vy: -50 });
    const hit = collidePlatform(body, platform);
    expect(hit).toBe(false);
  });

  it('should not collide when not horizontally overlapping', () => {
    const body = makeBody({ x: 0, y: 196, width: 16, vy: 50 });
    const hit = collidePlatform(body, platform);
    expect(hit).toBe(false);
  });
});

describe('collideFloor', () => {
  it('should stop body at floor', () => {
    const body = makeBody({ y: 350, height: 16 });
    const hit = collideFloor(body, 352);
    expect(hit).toBe(true);
    expect(body.y).toBe(336);
    expect(body.grounded).toBe(true);
  });

  it('should not collide when above floor', () => {
    const body = makeBody({ y: 200, height: 16 });
    const hit = collideFloor(body, 352);
    expect(hit).toBe(false);
  });
});

describe('collideCeiling', () => {
  it('should stop body at ceiling', () => {
    const body = makeBody({ y: 10, vy: -100 });
    const hit = collideCeiling(body, 24);
    expect(hit).toBe(true);
    expect(body.y).toBe(24);
    expect(body.vy).toBe(0);
  });

  it('should not affect downward velocity', () => {
    const body = makeBody({ y: 10, vy: 50 });
    const hit = collideCeiling(body, 24);
    expect(hit).toBe(true);
    expect(body.vy).toBe(50); // preserved, not clamped
  });

  it('should not collide when below ceiling', () => {
    const body = makeBody({ y: 100 });
    const hit = collideCeiling(body, 24);
    expect(hit).toBe(false);
  });
});

describe('overlaps', () => {
  it('should detect overlapping bodies', () => {
    const a = makeBody({ x: 100, y: 100, width: 20, height: 20 });
    const b = makeBody({ x: 110, y: 110, width: 20, height: 20 });
    expect(overlaps(a, b)).toBe(true);
  });

  it('should not detect non-overlapping bodies', () => {
    const a = makeBody({ x: 0, y: 0, width: 10, height: 10 });
    const b = makeBody({ x: 100, y: 100, width: 10, height: 10 });
    expect(overlaps(a, b)).toBe(false);
  });

  it('should not detect edge-touching as overlap', () => {
    const a = makeBody({ x: 0, y: 0, width: 10, height: 10 });
    const b = makeBody({ x: 10, y: 0, width: 10, height: 10 });
    expect(overlaps(a, b)).toBe(false);
  });
});

describe('containsPoint', () => {
  it('should return true for point inside body', () => {
    const body = makeBody({ x: 100, y: 100, width: 20, height: 20 });
    expect(containsPoint(body, 110, 110)).toBe(true);
  });

  it('should return true for point on boundary', () => {
    const body = makeBody({ x: 100, y: 100, width: 20, height: 20 });
    expect(containsPoint(body, 100, 100)).toBe(true);
    expect(containsPoint(body, 120, 120)).toBe(true);
  });

  it('should return false for point outside body', () => {
    const body = makeBody({ x: 100, y: 100, width: 20, height: 20 });
    expect(containsPoint(body, 50, 50)).toBe(false);
  });
});

describe('constants', () => {
  it('GRAVITY should be positive', () => {
    expect(GRAVITY).toBeGreaterThan(0);
  });

  it('MAX_FALL_SPEED should be positive', () => {
    expect(MAX_FALL_SPEED).toBeGreaterThan(0);
  });

  it('WRAP_MARGIN should be positive', () => {
    expect(WRAP_MARGIN).toBeGreaterThan(0);
  });
});
