// ── Cumulative code tests ──
// Verifies that level solutions are unique, non-conflicting, and can stack into a valid cumulative doc

import { describe, it, expect } from 'vitest';
import { LEVELS } from '../src/game/levels';

describe('Cumulative code design', () => {
  it('all solutions should define unique top-level types (no duplicate part def / state def etc.)', () => {
    // Extract all "X def Name" patterns from solutions
    const defPattern = /(?:part|port|item|enum|state|constraint|requirement|action|use case)\s+def\s+(\w+)/g;
    const allDefs = new Map<string, number[]>();

    for (const level of LEVELS) {
      let match: RegExpExecArray | null;
      const re = new RegExp(defPattern.source, 'g');
      while ((match = re.exec(level.mission.solution)) !== null) {
        const name = match[1];
        if (!allDefs.has(name)) allDefs.set(name, []);
        allDefs.get(name)!.push(level.id);
      }
    }

    // No definition name should appear in more than one level's solution
    for (const [name, levelIds] of allDefs) {
      expect(levelIds, `"def ${name}" appears in levels [${levelIds.join(', ')}]`)
        .toHaveLength(1);
    }
  });

  it('every level solution should match its expectedPattern', () => {
    for (const level of LEVELS) {
      expect(
        level.mission.expectedPattern.test(level.mission.solution),
        `Level ${level.id}: solution doesn't match expectedPattern`,
      ).toBe(true);
    }
  });

  it('building cumulative document: each solution should match all prior patterns when stacked', () => {
    // Simulate what happens when all solutions are inside package Spacecraft { ... }
    let cumulative = 'package Spacecraft {\n';

    for (let i = 0; i < LEVELS.length; i++) {
      const level = LEVELS[i];
      const indented = level.mission.solution
        .split('\n')
        .map((l) => '  ' + l)
        .join('\n');

      cumulative += `\n  // ── Level ${level.id}: ${level.name} ──\n`;
      cumulative += indented + '\n';

      // The current level's pattern should match
      expect(
        level.mission.expectedPattern.test(cumulative),
        `Level ${level.id}: expectedPattern not found in cumulative doc`,
      ).toBe(true);

      // All prior patterns should still match
      for (let j = 0; j < i; j++) {
        const prior = LEVELS[j];
        expect(
          prior.mission.expectedPattern.test(cumulative),
          `After adding Level ${level.id}, Level ${prior.id} pattern no longer matches`,
        ).toBe(true);
      }
    }
  });

  it('level 1 solution should be the package Spacecraft wrapper', () => {
    expect(LEVELS[0].mission.solution).toContain('package Spacecraft');
  });

  it('level 1 expectedPattern should accept quoted package names', () => {
    const p = LEVELS[0].mission.expectedPattern;
    expect(p.test('package Spacecraft {\n}')).toBe(true);
    expect(p.test("package 'Spacecraft' {\n}")).toBe(true);
  });

  it('final level (20) solution should compose prior definitions', () => {
    const l20 = LEVELS[19];
    expect(l20.mission.solution).toContain('part def JetpacSpacecraft');
  });

  it('no two levels should have identical solutions', () => {
    const solutions = LEVELS.map((l) => l.mission.solution);
    expect(new Set(solutions).size).toBe(solutions.length);
  });

  it('no two levels should have identical starterCode', () => {
    const starters = LEVELS.map((l) => l.mission.starterCode);
    expect(new Set(starters).size).toBe(starters.length);
  });

  it('mission instructional text should use single quotes when quoting names', () => {
    for (const level of LEVELS) {
      const fields = [
        level.mission.brief,
        level.mission.starterCode,
        level.mission.hint,
        level.mission.solution,
      ];

      for (const field of fields) {
        expect(field, `Level ${level.id} contains double quotes in mission text`).not.toContain('"');
      }
    }
  });
});
