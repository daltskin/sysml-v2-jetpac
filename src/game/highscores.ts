// ── High-score display helpers (pure / DOM-free) ──

export interface ScoreEntry {
  name: string;
  score: number;
  level: number;
  date: string;
}

/** Escape HTML entities to prevent XSS in rendered score names */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Maximum rows shown in the high-score table */
export const MAX_DISPLAY_ROWS = 15;

const EMPTY_ROW =
  '<tr><td colspan="4" style="text-align:center;color:var(--zx-white);opacity:0.4;padding:8px">NO SCORES YET</td></tr>';

/**
 * Build the inner HTML for the high-score table body.
 * Returns raw HTML string — caller sets `.innerHTML`.
 */
export function buildHighScoreRows(
  scores: ScoreEntry[],
  highlightName?: string,
  highlightScore?: number,
): string {
  if (scores.length === 0) return EMPTY_ROW;

  return scores
    .slice(0, MAX_DISPLAY_ROWS)
    .map((s, i) => {
      const isCurrent =
        highlightName !== undefined &&
        s.name === highlightName &&
        s.score === highlightScore;
      const cls = isCurrent ? ' class="current-player"' : '';
      return `<tr${cls}>
        <td class="rank-col">${i + 1}</td>
        <td class="name-col">${escapeHtml(s.name)}</td>
        <td class="level-col">${s.level}</td>
        <td class="score-col">${String(s.score).padStart(6, '0')}</td>
      </tr>`;
    })
    .join('');
}
