// ── High-score board tests ──

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  escapeHtml,
  buildHighScoreRows,
  MAX_DISPLAY_ROWS,
  type ScoreEntry,
} from '../src/game/highscores';
import { LSPClient } from '../src/editor/lsp-client';

// ── Helpers ──

function makeScore(
  name: string,
  score: number,
  level = 20,
  date = '2025-01-01',
): ScoreEntry {
  return { name, score, level, date };
}

function parseRows(html: string): Element[] {
  // Quick DOM-free row extraction: count <tr> tags
  return [...html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/g)].map((m) => m[0]) as unknown as Element[];
}

function extractText(html: string, cls: string): string[] {
  const re = new RegExp(`<td class="${cls}">([\\s\\S]*?)<\\/td>`, 'g');
  return [...html.matchAll(re)].map((m) => m[1].trim());
}

// ── escapeHtml ──

describe('escapeHtml', () => {
  it('should escape ampersands', () => {
    expect(escapeHtml('A&B')).toBe('A&amp;B');
  });

  it('should escape angle brackets', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });

  it('should return plain text unchanged', () => {
    expect(escapeHtml('JETMAN')).toBe('JETMAN');
  });

  it('should handle empty string', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('should handle multiple special characters', () => {
    expect(escapeHtml('A&B<C>D')).toBe('A&amp;B&lt;C&gt;D');
  });
});

// ── buildHighScoreRows ──

describe('buildHighScoreRows', () => {
  it('should show empty-state message for no scores', () => {
    const html = buildHighScoreRows([]);
    expect(html).toContain('NO SCORES YET');
    expect(html).toContain('colspan="4"');
  });

  it('should render a single score entry', () => {
    const html = buildHighScoreRows([makeScore('ACE', 1500)]);
    expect(extractText(html, 'rank-col')).toEqual(['1']);
    expect(extractText(html, 'name-col')).toEqual(['ACE']);
    expect(extractText(html, 'level-col')).toEqual(['20']);
    expect(extractText(html, 'score-col')).toEqual(['001500']);
  });

  it('should render multiple scores in order with correct ranks', () => {
    const scores = [
      makeScore('ALPHA', 3000),
      makeScore('BRAVO', 2000),
      makeScore('CHARLIE', 1000),
    ];
    const html = buildHighScoreRows(scores);
    expect(extractText(html, 'rank-col')).toEqual(['1', '2', '3']);
    expect(extractText(html, 'name-col')).toEqual(['ALPHA', 'BRAVO', 'CHARLIE']);
  });

  it('should pad scores to 6 digits', () => {
    const html = buildHighScoreRows([makeScore('X', 42)]);
    expect(extractText(html, 'score-col')).toEqual(['000042']);
  });

  it('should cap display at MAX_DISPLAY_ROWS entries', () => {
    const scores = Array.from({ length: 20 }, (_, i) =>
      makeScore(`P${i}`, 10000 - i * 100),
    );
    const html = buildHighScoreRows(scores);
    const ranks = extractText(html, 'rank-col');
    expect(ranks).toHaveLength(MAX_DISPLAY_ROWS);
    expect(ranks[0]).toBe('1');
    expect(ranks[MAX_DISPLAY_ROWS - 1]).toBe(String(MAX_DISPLAY_ROWS));
  });

  it('should highlight the current player row', () => {
    const scores = [makeScore('ACE', 3000), makeScore('BOB', 2000)];
    const html = buildHighScoreRows(scores, 'BOB', 2000);
    // BOB's row should have current-player class
    expect(html).toContain('class="current-player"');
    // Only one row highlighted
    const matches = html.match(/current-player/g);
    expect(matches).toHaveLength(1);
  });

  it('should not highlight when name matches but score differs', () => {
    const scores = [makeScore('ACE', 3000), makeScore('BOB', 2000)];
    const html = buildHighScoreRows(scores, 'BOB', 9999);
    expect(html).not.toContain('current-player');
  });

  it('should not highlight when no highlight params provided', () => {
    const scores = [makeScore('ACE', 3000)];
    const html = buildHighScoreRows(scores);
    expect(html).not.toContain('current-player');
  });

  it('should escape HTML in player names', () => {
    const html = buildHighScoreRows([makeScore('<script>', 100)]);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('should display level number correctly', () => {
    const html = buildHighScoreRows([makeScore('JETMAN', 5000, 12)]);
    expect(extractText(html, 'level-col')).toEqual(['12']);
  });
});

// ── LSPClient score methods ──

describe('LSPClient.getScores', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return scores from server', async () => {
    const mockScores = [makeScore('ACE', 3000), makeScore('BOB', 2000)];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ scores: mockScores }),
      }),
    );

    const client = new LSPClient({ baseUrl: 'http://localhost:3000' });
    const result = await client.getScores();
    expect(result).toEqual(mockScores);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/scores',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('should return empty array on HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false }),
    );

    const client = new LSPClient({ baseUrl: 'http://localhost:3000' });
    const result = await client.getScores();
    expect(result).toEqual([]);
  });

  it('should return empty array on network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network error')),
    );

    const client = new LSPClient({ baseUrl: 'http://localhost:3000' });
    const result = await client.getScores();
    expect(result).toEqual([]);
  });
});

describe('LSPClient.submitScore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should submit score and return rank + scores', async () => {
    const mockResponse = {
      rank: 1,
      scores: [makeScore('JETMAN', 5000)],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }),
    );

    const client = new LSPClient({ baseUrl: 'http://localhost:3000' });
    const result = await client.submitScore('JETMAN', 5000, 20);
    expect(result).toEqual(mockResponse);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/scores',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'JETMAN', score: 5000, level: 20 }),
      }),
    );
  });

  it('should return rank 0 and empty scores on HTTP error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false }),
    );

    const client = new LSPClient({ baseUrl: 'http://localhost:3000' });
    const result = await client.submitScore('ACE', 1000, 5);
    expect(result).toEqual({ rank: 0, scores: [] });
  });

  it('should return rank 0 and empty scores on network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('timeout')),
    );

    const client = new LSPClient({ baseUrl: 'http://localhost:3000' });
    const result = await client.submitScore('ACE', 1000, 5);
    expect(result).toEqual({ rank: 0, scores: [] });
  });
});
