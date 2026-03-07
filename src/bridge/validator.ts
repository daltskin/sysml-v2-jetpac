// ── Bridge: validates SysML code against level requirements ──

import type { LevelConfig } from '../game/levels';
import type { LSPClient, AnalyseResponse } from '../editor/lsp-client';

export interface ValidationResult {
  passed: boolean;
  codeValid: boolean;
  missionComplete: boolean;
  score: number;
  feedback: string;
  diagnosticCount: number;
  /** Raw LSP diagnostics so the UI can display them */
  diagnostics: Array<{ line: number; column?: number; severity: 'error' | 'warning' | 'info'; message: string }>;
}

/**
 * Validate the player's SysML code against the current level's mission requirements.
 * This is the "bridge" between the game world and the SysML editor.
 *
 * @param priorPatterns - expectedPattern regexes from all prior levels (to enforce cumulative code)
 */
export async function validateCode(
  code: string,
  level: LevelConfig,
  lsp: LSPClient,
  priorPatterns: RegExp[] = []
): Promise<ValidationResult> {
  const analyseResult = await lsp.analyse(code);

  const codeValid = analyseResult.valid;
  const missionComplete = level.mission.expectedPattern.test(code);

  // Check for duplicate definitions (the LSP may not always catch these)
  const dupDiags = findDuplicateDefinitions(code);

  // Score calculation
  let score = 0;
  let feedback = '';

  if (!code.trim()) {
    feedback = 'Write some SysML code in the editor!';
    return { passed: false, codeValid: false, missionComplete: false, score: 0, feedback, diagnosticCount: 0, diagnostics: [] };
  }

  // Combine LSP diagnostics with duplicate-detection diagnostics
  const allDiagnostics = [...analyseResult.diagnostics, ...dupDiags];

  if (!codeValid || dupDiags.length > 0) {
    feedback = dupDiags.length > 0
      ? `Duplicate definition${dupDiags.length > 1 ? 's' : ''} found — each name must be unique`
      : formatDiagnostics(analyseResult);
    return {
      passed: false,
      codeValid: false,
      missionComplete,
      score: 0,
      feedback,
      diagnosticCount: allDiagnostics.length,
      diagnostics: allDiagnostics,
    };
  }

  if (!missionComplete) {
    feedback = `Code is valid but doesn't match the mission. Hint: ${level.mission.hint}`;
    score = 50; // Partial credit for valid code
    return {
      passed: false,
      codeValid: true,
      missionComplete: false,
      score,
      feedback,
      diagnosticCount: allDiagnostics.length,
      diagnostics: allDiagnostics,
    };
  }

  // Check that all prior levels' code is still present (cumulative requirement)
  const missingPrior = priorPatterns.findIndex((p) => !p.test(code));
  if (missingPrior >= 0) {
    feedback = `Mission code is correct, but earlier work is missing! Keep all previous definitions in the file. (Check level ${missingPrior + 1}.)`;
    return {
      passed: false,
      codeValid: true,
      missionComplete: true,
      score: 0,
      feedback,
      diagnosticCount: allDiagnostics.length,
      diagnostics: allDiagnostics,
    };
  }

  // Full success!
  score = 100;
  feedback = 'Mission complete!';

  // Bonus for no warnings
  if (allDiagnostics.length === 0) {
    score += 25;
    feedback += ' Zero warnings — flawless!';
  }

  return {
    passed: true,
    codeValid: true,
    missionComplete: true,
    score,
    feedback: feedback.trim(),
    diagnosticCount: allDiagnostics.length,
    diagnostics: allDiagnostics,
  };
}

function formatDiagnostics(result: AnalyseResponse): string {
  const errors = result.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length === 0) return 'Code looks valid!';
  return errors.length === 1
    ? 'SysML has 1 parse error — see details below'
    : `SysML has ${errors.length} parse errors — see details below`;
}

/** Scan code for duplicate top-level and nested definition names */
function findDuplicateDefinitions(
  code: string
): Array<{ line: number; severity: 'error'; message: string }> {
  // Match SysML definition keywords followed by a name
  const defPattern = /\b(?:package|part\s+def|port\s+def|action\s+def|state\s+def|constraint\s+def|requirement\s+def|use\s+case\s+def|interface\s+def|enum\s+def|connection\s+def)\s+(\w+)/g;
  const seen = new Map<string, number>(); // name → first line (1-based)
  const dupes: Array<{ line: number; severity: 'error'; message: string }> = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    let m: RegExpExecArray | null;
    defPattern.lastIndex = 0;
    while ((m = defPattern.exec(lines[i])) !== null) {
      const name = m[1];
      const lineNum = i + 1;
      const firstLine = seen.get(name);
      if (firstLine !== undefined) {
        dupes.push({
          line: lineNum,
          severity: 'error',
          message: `Duplicate definition '${name}' (first defined on line ${firstLine})`,
        });
      } else {
        seen.set(name, lineNum);
      }
    }
  }

  return dupes;
}

/**
 * Map validated SysML symbols to game entity rewards.
 * When a player successfully models a concept, this determines
 * what appears in the game (e.g., rocket parts, power-ups).
 */
export function symbolsToRewards(symbols: string[]): GameReward[] {
  const rewards: GameReward[] = [];

  for (const sym of symbols) {
    const lower = sym.toLowerCase();
    if (lower.includes('engine') || lower.includes('rocket')) {
      rewards.push({ type: 'rocket_part', points: 200 });
    } else if (lower.includes('fuel') || lower.includes('tank')) {
      rewards.push({ type: 'fuel', points: 100 });
    } else if (lower.includes('shield') || lower.includes('defense')) {
      rewards.push({ type: 'invulnerability', points: 150 });
    } else {
      rewards.push({ type: 'points', points: 50 });
    }
  }

  return rewards;
}

export interface GameReward {
  type: 'rocket_part' | 'fuel' | 'invulnerability' | 'points';
  points: number;
}
