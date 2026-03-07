// ── Level definition tests ──
// Validates all 20 levels have correct structure, unique names, no duplicate defs, etc.

import { describe, it, expect } from 'vitest';
import { LEVELS, getLevelsByTier, getTierInfo } from '../src/game/levels';
import type { Tier } from '../src/game/levels';

describe('Level definitions', () => {
  it('should have exactly 20 levels', () => {
    expect(LEVELS).toHaveLength(20);
  });

  it('should have sequential IDs 1–20', () => {
    LEVELS.forEach((level, i) => {
      expect(level.id).toBe(i + 1);
    });
  });

  it('should have unique IDs', () => {
    const ids = LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('should have unique names', () => {
    const names = LEVELS.map((l) => l.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should assign correct tiers', () => {
    const expectedTiers: [number, number, Tier][] = [
      [1, 5, 'foundation'],
      [6, 10, 'structure'],
      [11, 15, 'behaviour'],
      [16, 20, 'mastery'],
    ];
    for (const [start, end, tier] of expectedTiers) {
      for (let id = start; id <= end; id++) {
        const level = LEVELS[id - 1];
        expect(level.tier, `Level ${id} should be tier '${tier}'`).toBe(tier);
      }
    }
  });

  it('every level should have a non-empty mission brief', () => {
    for (const level of LEVELS) {
      expect(level.mission.brief.length, `Level ${level.id} brief`).toBeGreaterThan(10);
    }
  });

  it('every level should have a non-empty concept', () => {
    for (const level of LEVELS) {
      expect(level.mission.concept.length, `Level ${level.id} concept`).toBeGreaterThan(0);
    }
  });

  it('every level should have at least one tag', () => {
    for (const level of LEVELS) {
      expect(level.mission.tags.length, `Level ${level.id} tags`).toBeGreaterThan(0);
    }
  });

  it('every level should have non-empty starterCode', () => {
    for (const level of LEVELS) {
      expect(level.mission.starterCode.trim().length, `Level ${level.id} starterCode`).toBeGreaterThan(0);
    }
  });

  it('every level should have a valid expectedPattern (RegExp)', () => {
    for (const level of LEVELS) {
      expect(level.mission.expectedPattern).toBeInstanceOf(RegExp);
    }
  });

  it('every level should have a non-empty hint', () => {
    for (const level of LEVELS) {
      expect(level.mission.hint.length, `Level ${level.id} hint`).toBeGreaterThan(0);
    }
  });

  it('every level should have a non-empty solution', () => {
    for (const level of LEVELS) {
      expect(level.mission.solution.length, `Level ${level.id} solution`).toBeGreaterThan(5);
    }
  });

  it('every solution should match its own expectedPattern', () => {
    for (const level of LEVELS) {
      const result = level.mission.expectedPattern.test(level.mission.solution);
      expect(result, `Level ${level.id} (${level.name}): solution doesn't match expectedPattern`).toBe(true);
    }
  });

  it('every level should have valid alienPattern', () => {
    const validPatterns = [
      'meteor', 'jellyfish', 'drone', 'asteroid',
      'solar_flare', 'space_pirate', 'magnetic_mine', 'dust_devil',
    ];
    for (const level of LEVELS) {
      expect(validPatterns, `Level ${level.id} alienPattern`)
        .toContain(level.alienPattern);
    }
  });

  it('every level should have positive fuelNeeded', () => {
    for (const level of LEVELS) {
      expect(level.fuelNeeded, `Level ${level.id}`).toBeGreaterThan(0);
    }
  });

  it('every level should have alienCount > 0 and alienSpeed > 0', () => {
    for (const level of LEVELS) {
      expect(level.alienCount, `Level ${level.id} alienCount`).toBeGreaterThan(0);
      expect(level.alienSpeed, `Level ${level.id} alienSpeed`).toBeGreaterThan(0);
    }
  });

  it('rocket-building levels should be 1, 5, 6, 10, 11, 15, 16, 20', () => {
    const buildLevels = LEVELS.filter((l) => l.buildRocket).map((l) => l.id);
    expect(buildLevels).toEqual([1, 5, 6, 10, 11, 15, 16, 20]);
  });

  it('difficulty should generally increase (alienSpeed mostly non-decreasing)', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      // Allow small dips between tiers, but overall trend should be up
      const prev = LEVELS[i - 1].alienSpeed;
      const curr = LEVELS[i].alienSpeed;
      // Speed shouldn't drop by more than 20% between consecutive levels
      expect(curr, `Level ${LEVELS[i].id} speed should not drop sharply`)
        .toBeGreaterThanOrEqual(prev * 0.75);
    }
  });
});

describe('getLevelsByTier', () => {
  it('returns 5 levels per tier', () => {
    const tiers: Tier[] = ['foundation', 'structure', 'behaviour', 'mastery'];
    for (const tier of tiers) {
      expect(getLevelsByTier(tier)).toHaveLength(5);
    }
  });
});

describe('getTierInfo', () => {
  it('returns name, colour, icon for each tier', () => {
    const tiers: Tier[] = ['foundation', 'structure', 'behaviour', 'mastery'];
    for (const tier of tiers) {
      const info = getTierInfo(tier);
      expect(info.name).toBeTruthy();
      expect(info.colour).toMatch(/^#/);
      expect(info.icon).toBeTruthy();
    }
  });
});
