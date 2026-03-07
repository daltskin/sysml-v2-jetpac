// ── Game telemetry via Azure Application Insights ──
// Tracks: geography, devices, session duration, level progress, attempts, timing.
// Initialised lazily — fetches connection string from /api/config at runtime.

import { ApplicationInsights } from '@microsoft/applicationinsights-web';

let ai: ApplicationInsights | null = null;
let initPromise: Promise<void> | null = null;

/** Attempt to initialise App Insights. Silently no-ops if unavailable. */
export function initTelemetry(baseUrl: string): void {
  if (initPromise) return;
  initPromise = (async () => {
    try {
      const res = await fetch(`${baseUrl}/api/config`);
      if (!res.ok) return;
      const { aiConnectionString } = await res.json();
      if (!aiConnectionString) return;

      ai = new ApplicationInsights({
        config: {
          connectionString: aiConnectionString,
          enableAutoRouteTracking: false,   // SPA with no routes
          disableFetchTracking: false,      // track API calls
          disableAjaxTracking: false,
          enableSessionStorageBuffer: true,
          maxBatchSizeInBytes: 10000,
          maxBatchInterval: 15000,
        },
      });
      ai.loadAppInsights();
      ai.trackPageView({ name: 'Jetpac SysML v2' });
    } catch {
      // Telemetry is optional — never break the game
    }
  })();
}

// ── Custom event helpers ──

export function trackGameStart() {
  ai?.trackEvent({ name: 'GameStart' });
}

export function trackLevelStart(levelId: number, levelName: string, tier: string) {
  ai?.trackEvent({
    name: 'LevelStart',
    properties: { levelId: String(levelId), levelName, tier },
  });
}

export function trackLevelAttempt(
  levelId: number,
  attemptNumber: number,
  passed: boolean,
) {
  ai?.trackEvent({
    name: 'LevelAttempt',
    properties: {
      levelId: String(levelId),
      attemptNumber: String(attemptNumber),
      passed: String(passed),
    },
  });
}

export function trackLevelComplete(
  levelId: number,
  levelName: string,
  durationSec: number,
  score: number,
  attempts: number,
) {
  ai?.trackEvent({
    name: 'LevelComplete',
    properties: { levelId: String(levelId), levelName },
    measurements: { durationSec, score, attempts },
  });
}

export function trackGameOver(levelId: number, score: number) {
  ai?.trackEvent({
    name: 'GameOver',
    properties: { levelId: String(levelId) },
    measurements: { score },
  });
}

export function trackGameComplete(totalScore: number, totalDurationSec: number, levelsCompleted: number) {
  ai?.trackEvent({
    name: 'GameComplete',
    measurements: { totalScore, totalDurationSec, levelsCompleted },
  });
}

export function trackHighScoreSubmit(rank: number, score: number, level: number) {
  ai?.trackEvent({
    name: 'HighScoreSubmit',
    properties: { rank: String(rank) },
    measurements: { score, level },
  });
}

/** Flush buffered events (call before page unload) */
export function flushTelemetry() {
  ai?.flush();
}
