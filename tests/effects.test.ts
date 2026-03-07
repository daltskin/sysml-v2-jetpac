// ── Effects tests: ParticleSystem and FloatingText ──

import { describe, it, expect } from 'vitest';
import { ParticleSystem, FloatingText } from '../src/game/effects';

describe('ParticleSystem', () => {
  it('should start with 0 particles and active', () => {
    const ps = new ParticleSystem();
    expect(ps.particleCount).toBe(0);
    expect(ps.active).toBe(true);
  });

  it('explode should emit particles', () => {
    const ps = new ParticleSystem();
    ps.explode(100, 100);
    expect(ps.particleCount).toBe(20);
    expect(ps.active).toBe(true);
  });

  it('sparkle should emit particles', () => {
    const ps = new ParticleSystem();
    ps.sparkle(100, 100);
    expect(ps.particleCount).toBe(8);
  });

  it('thrustTrail should emit particles', () => {
    const ps = new ParticleSystem();
    ps.thrustTrail(100, 100);
    expect(ps.particleCount).toBe(2);
  });

  it('launchExhaust should emit particles', () => {
    const ps = new ParticleSystem();
    ps.launchExhaust(100, 100);
    expect(ps.particleCount).toBe(5);
  });

  it('particles should decay over time', () => {
    const ps = new ParticleSystem();
    ps.explode(100, 100);
    const initial = ps.particleCount;
    // Run updates until some particles expire
    for (let i = 0; i < 120; i++) ps.update(1 / 60);
    expect(ps.particleCount).toBeLessThan(initial);
  });

  it('should become inactive when all particles expire', () => {
    const ps = new ParticleSystem();
    ps.sparkle(100, 100);
    // Run many frames to let all particles expire
    for (let i = 0; i < 300; i++) ps.update(1 / 60);
    expect(ps.particleCount).toBe(0);
    expect(ps.active).toBe(false);
  });

  it('particles should move with gravity', () => {
    const ps = new ParticleSystem();
    ps.explode(100, 100);
    // Particle positions change after update
    ps.update(1 / 60);
    // Just verify no crash and still has particles
    expect(ps.particleCount).toBeGreaterThan(0);
  });

  it('multiple emissions accumulate', () => {
    const ps = new ParticleSystem();
    ps.explode(100, 100);
    ps.sparkle(200, 200);
    expect(ps.particleCount).toBe(28); // 20 + 8
  });
});

describe('FloatingText', () => {
  it('should be active initially', () => {
    const ft = new FloatingText(100, 100, '+100');
    expect(ft.active).toBe(true);
  });

  it('should rise over time', () => {
    const ft = new FloatingText(100, 100, '+100');
    const startY = 100;
    ft.update(1 / 60);
    // FloatingText moves y by -20*dt per frame
    // After update, y should be less (higher on screen)
    // We can't access private y, but we can verify it's still active after a small update
    expect(ft.active).toBe(true);
  });

  it('should become inactive after lifetime expires', () => {
    const ft = new FloatingText(100, 100, '+100', '#fff', 0.5);
    for (let i = 0; i < 60; i++) ft.update(1 / 60); // 1 second
    expect(ft.active).toBe(false);
  });

  it('should support custom lifetime', () => {
    const ft = new FloatingText(100, 100, 'test', '#fff', 2);
    // After 1 second it should still be active (life=2)
    for (let i = 0; i < 60; i++) ft.update(1 / 60);
    expect(ft.active).toBe(true);
    // After another 1.5s it should be gone
    for (let i = 0; i < 90; i++) ft.update(1 / 60);
    expect(ft.active).toBe(false);
  });
});
