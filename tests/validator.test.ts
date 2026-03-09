// ── Validator tests ──
// Tests the bridge validator with mock LSP responses

import { describe, it, expect, vi } from 'vitest';
import { validateCode, symbolsToRewards } from '../src/bridge/validator';
import type { LevelConfig } from '../src/game/levels';
import type { LSPClient, AnalyseResponse } from '../src/editor/lsp-client';

// ── Helpers ──
function mockLSP(response: Partial<AnalyseResponse>): LSPClient {
  return {
    analyse: vi.fn().mockResolvedValue({
      valid: true,
      diagnostics: [],
      symbols: [],
      ...response,
    }),
  } as unknown as LSPClient;
}

function mockLevel(overrides: Partial<LevelConfig['mission']> = {}): LevelConfig {
  return {
    id: 1,
    name: 'Test Level',
    tier: 'foundation',
    platformColour: '#00c525',
    rocketX: 232,
    alienPattern: 'meteor',
    alienCount: 2,
    alienSpeed: 40,
    fuelNeeded: 3,
    buildRocket: false,
    mission: {
      brief: 'Test mission',
      concept: 'test',
      tags: ['test'],
      starterCode: '// test\n',
      expectedPattern: /part\s+def\s+Engine/,
      hint: 'Use: part def Engine { }',
      solution: 'part def Engine { }',
      ...overrides,
    },
  };
}

describe('validateCode', () => {
  it('should fail with empty code', async () => {
    const result = await validateCode('', mockLevel(), mockLSP({}));
    expect(result.passed).toBe(false);
    expect(result.feedback).toContain('Write some SysML');
  });

  it('should fail with whitespace-only code', async () => {
    const result = await validateCode('   \n  \n', mockLevel(), mockLSP({}));
    expect(result.passed).toBe(false);
  });

  it('should fail when LSP reports invalid code', async () => {
    const lsp = mockLSP({
      valid: false,
      diagnostics: [{ line: 1, severity: 'error', message: 'Unexpected token' }],
    });
    const result = await validateCode('bad code!!', mockLevel(), lsp);
    expect(result.passed).toBe(false);
    expect(result.codeValid).toBe(false);
    expect(result.diagnosticCount).toBe(1);
  });

  it('should report parse error count', async () => {
    const lsp = mockLSP({
      valid: false,
      diagnostics: [
        { line: 1, severity: 'error', message: 'Error 1' },
        { line: 2, severity: 'error', message: 'Error 2' },
        { line: 3, severity: 'error', message: 'Error 3' },
      ],
    });
    const result = await validateCode('bad', mockLevel(), lsp);
    expect(result.feedback).toContain('3 parse errors');
  });

  it('should report with single parse error message', async () => {
    const lsp = mockLSP({
      valid: false,
      diagnostics: [{ line: 1, severity: 'error', message: 'Error 1' }],
    });
    const result = await validateCode('bad', mockLevel(), lsp);
    expect(result.feedback).toContain('1 parse error');
  });

  it('should fail when code is valid but mission pattern not matched', async () => {
    const result = await validateCode('package Foo { }', mockLevel(), mockLSP({}));
    expect(result.passed).toBe(false);
    expect(result.codeValid).toBe(true);
    expect(result.missionComplete).toBe(false);
    expect(result.score).toBe(50);
    expect(result.feedback).toContain('Hint');
  });

  it('should pass when code is valid and pattern matches', async () => {
    const result = await validateCode('part def Engine { }', mockLevel(), mockLSP({}));
    expect(result.passed).toBe(true);
    expect(result.codeValid).toBe(true);
    expect(result.missionComplete).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(100);
  });

  it('should accept quoted package names when mission pattern allows them', async () => {
    const level = mockLevel({
      expectedPattern: /package\s+(?:Spacecraft|'Spacecraft')\s*\{/
    });

    const singleQuoted = await validateCode("package 'Spacecraft' { }", level, mockLSP({}));
    expect(singleQuoted.passed).toBe(true);
  });

  it('should give bonus for zero warnings', async () => {
    const result = await validateCode('part def Engine { }', mockLevel(), mockLSP({ diagnostics: [] }));
    expect(result.score).toBe(125); // 100 + 25 bonus
    expect(result.feedback).toContain('flawless');
  });

  it('should not give bonus when warnings exist', async () => {
    const lsp = mockLSP({
      diagnostics: [{ line: 1, severity: 'warning', message: 'unused' }],
    });
    const result = await validateCode('part def Engine { }', mockLevel(), lsp);
    expect(result.score).toBe(100);
  });

  describe('cumulative validation (prior patterns)', () => {
    it('should fail when prior patterns are missing', async () => {
      const priorPatterns = [/package\s+Spacecraft/, /part\s+def\s+FuelTank/];
      const code = 'part def Engine { }';
      const result = await validateCode(code, mockLevel(), mockLSP({}), priorPatterns);
      expect(result.passed).toBe(false);
      expect(result.feedback).toContain('earlier work is missing');
    });

    it('should pass when all prior patterns are present', async () => {
      const priorPatterns = [/package\s+Spacecraft/];
      const code = 'package Spacecraft {\n  part def Engine { }\n}';
      const result = await validateCode(code, mockLevel(), mockLSP({}), priorPatterns);
      expect(result.passed).toBe(true);
    });

    it('should identify which level pattern is missing', async () => {
      const priorPatterns = [/pattern_one/, /pattern_two/];
      const code = 'pattern_one part def Engine { }';
      const result = await validateCode(code, mockLevel(), mockLSP({}), priorPatterns);
      expect(result.feedback).toContain('level 2');
    });

    it('should pass with empty prior patterns', async () => {
      const result = await validateCode('part def Engine { }', mockLevel(), mockLSP({}), []);
      expect(result.passed).toBe(true);
    });
  });

  describe('duplicate definition detection', () => {
    it('should fail when the same part def appears twice', async () => {
      const code = 'part def Engine { }\npart def Engine { }';
      const result = await validateCode(code, mockLevel(), mockLSP({}));
      expect(result.passed).toBe(false);
      expect(result.feedback).toContain('Duplicate');
      expect(result.diagnostics.some(d => d.message.includes("Duplicate definition 'Engine'"))).toBe(true);
    });

    it('should fail with duplicate package names', async () => {
      const code = 'package Spacecraft { }\npackage Spacecraft { }';
      const level = mockLevel({ expectedPattern: /package\s+Spacecraft/ });
      const result = await validateCode(code, level, mockLSP({}));
      expect(result.passed).toBe(false);
      expect(result.diagnostics.some(d => d.message.includes('Spacecraft'))).toBe(true);
    });

    it('should pass when definitions have different names', async () => {
      const code = 'part def Engine { }\npart def FuelTank { }';
      const level = mockLevel({ expectedPattern: /part\s+def\s+Engine[\s\S]*part\s+def\s+FuelTank/ });
      const result = await validateCode(code, level, mockLSP({}));
      expect(result.passed).toBe(true);
    });

    it('should detect duplicate enum defs', async () => {
      const code = 'enum def ThrustMode { }\nenum def ThrustMode { }';
      const level = mockLevel({ expectedPattern: /enum\s+def\s+ThrustMode/ });
      const result = await validateCode(code, level, mockLSP({}));
      expect(result.passed).toBe(false);
      expect(result.diagnostics.some(d => d.message.includes('ThrustMode'))).toBe(true);
    });
  });
});

describe('symbolsToRewards', () => {
  it('should map engine symbols to rocket_part', () => {
    const rewards = symbolsToRewards(['RocketEngine']);
    expect(rewards[0].type).toBe('rocket_part');
    expect(rewards[0].points).toBe(200);
  });

  it('should map fuel symbols to fuel', () => {
    const rewards = symbolsToRewards(['FuelTank']);
    expect(rewards[0].type).toBe('fuel');
    expect(rewards[0].points).toBe(100);
  });

  it('should map shield symbols to invulnerability', () => {
    const rewards = symbolsToRewards(['ShieldSystem']);
    expect(rewards[0].type).toBe('invulnerability');
  });

  it('should map unknown symbols to points', () => {
    const rewards = symbolsToRewards(['Navigation']);
    expect(rewards[0].type).toBe('points');
    expect(rewards[0].points).toBe(50);
  });

  it('should handle multiple symbols', () => {
    const rewards = symbolsToRewards(['Engine', 'FuelTank', 'Navigation']);
    expect(rewards).toHaveLength(3);
    expect(rewards[0].type).toBe('rocket_part');
    expect(rewards[1].type).toBe('fuel');
    expect(rewards[2].type).toBe('points');
  });

  it('should return empty array for empty input', () => {
    expect(symbolsToRewards([])).toEqual([]);
  });
});
