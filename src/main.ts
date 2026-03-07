// ── Main: wires the game engine, entities, editor, and bridge together ──

// Global error overlay (catches errors early)
window.addEventListener('error', (e) => {
  const d = document.createElement('pre');
  d.style.cssText = 'color:#f88;padding:20px;font-size:14px;z-index:9999;position:fixed;inset:0;overflow:auto;background:#200';
  d.textContent = 'JS ERROR:\n' + e.message + '\n' + (e.filename || '') + ':' + (e.lineno || '') + '\n' + (e.error && e.error.stack || '');
  document.body.appendChild(d);
});
window.addEventListener('unhandledrejection', (e) => {
  const d = document.createElement('pre');
  d.style.cssText = 'color:#f88;padding:20px;font-size:14px;z-index:9999;position:fixed;inset:0;overflow:auto;background:#200';
  d.textContent = 'PROMISE ERROR:\n' + (e.reason && e.reason.stack || e.reason || 'unknown');
  document.body.appendChild(d);
});

import { GameEngine } from './game/engine';
import { InputHandler } from './game/input';
import { AudioSystem } from './game/audio';
import { SysMLEditor } from './editor/editor';
import { LSPClient } from './editor/lsp-client';
import { Platform, createJetpacPlatforms } from './game/entities/platform';
import { Spaceman } from './game/entities/spaceman';
import { Rocket, type RocketPhase } from './game/entities/rocket';
import { Alien, getAlienPatternForLevel, spawnAlienWave } from './game/entities/alien';
import { Collectible, spawnFalling } from './game/entities/collectible';
import { ParticleSystem, FloatingText } from './game/effects';
import { overlaps } from './game/physics';
import { LEVELS, getTierInfo, type LevelConfig } from './game/levels';
import { validateCode } from './bridge/validator';
import { drawSprite } from './game/sprites';
import { ShuttleSchematic } from './game/schematic';
import { buildHighScoreRows } from './game/highscores';
import type { ScoreEntry } from './game/highscores';
import {
  initTelemetry, trackGameStart, trackLevelStart, trackLevelAttempt,
  trackLevelComplete, trackGameOver, trackGameComplete,
  trackHighScoreSubmit, flushTelemetry,
} from './game/telemetry';

// ── Game state ──
type GameScreen = 'title' | 'playing' | 'mission_brief' | 'victory' | 'game_over' | 'mars_ending';

// Scale factor for all canvas-rendered text (1.0 = original, 1.3 = 130%)
const TEXT_SCALE = 1.3;

/** Build a CSS font string with the size scaled by TEXT_SCALE */
function scaledFont(size: number, weight: string = '', family: string = 'monospace'): string {
  const s = Math.round(size * TEXT_SCALE);
  return weight ? `${weight} ${s}px ${family}` : `${s}px ${family}`;
}

let currentScreen: GameScreen = 'title';
let currentLevelIndex = 0;
let levelConfig: LevelConfig = LEVELS[0];
let missionValidated = false;
let gameStarted = false;
let failedAnalyses = 0;
let usedReveal = false;

// SysML code persists across levels — each new level appends its starter code
let cumulativeCode = '';

// ── Progress persistence ──
const SAVE_KEY = 'jetpac-sysml-progress';

interface SaveData {
  highestLevel: number;   // 0-based index of the next level to play
  score: number;
  cumulativeCode: string;
}

let savedProgress: SaveData | null = null;
let titleMenuIndex = 0;   // 0 = continue, 1 = new game
let titleShowScores = false;              // true = high score table sub-screen
let titleShowAbout = false;               // true = about / resources sub-screen
let titleScores: ScoreEntry[] = [];       // cached scores for title screen
let resumeScore = 0;      // score to restore when continuing

// ── Telemetry timing ──
let levelStartTime = 0;                   // Date.now() when level started
let gameStartTime = 0;                    // Date.now() when game session started
let levelAttemptCount = 0;                // analyse attempts for current level

function saveProgress() {
  const nextLevel = currentLevelIndex + 1;
  if (nextLevel >= LEVELS.length) return; // all done — Mars ending clears save

  const existing = loadProgress();
  const highest = Math.max(nextLevel, existing?.highestLevel ?? 0);

  const data: SaveData = {
    highestLevel: highest,
    score: spaceman?.score ?? 0,
    cumulativeCode,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded or storage disabled */ }
}

function loadProgress(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.highestLevel !== 'number' || data.highestLevel < 1 || data.highestLevel >= LEVELS.length) return null;
    return data as SaveData;
  } catch {
    return null;
  }
}

function clearProgress() {
  localStorage.removeItem(SAVE_KEY);
}

function continueGame() {
  if (!savedProgress) return;
  cumulativeCode = savedProgress.cumulativeCode;
  resumeScore = savedProgress.score;
  showMissionBrief(savedProgress.highestLevel);
}

// ── DOM Elements ──
const titleScreen = document.getElementById('title-screen')!;
const missionOverlay = document.getElementById('mission-overlay')!;
const missionTier = document.getElementById('overlay-tier')!;
const missionTitle = document.getElementById('overlay-title')!;
const missionDesc = document.getElementById('overlay-text')!;
const startMissionBtn = document.getElementById('overlay-start')!;
const levelDisplay = document.getElementById('level-display')!;
const scoreDisplay = document.getElementById('score-display')!;
const livesDisplay = document.getElementById('hud-lives')!;
const destDisplay = document.getElementById('hud-dest')!;
const analyseBtn = document.getElementById('btn-analyse')!;
const launchBtn = document.getElementById('btn-launch')!;

// Victory overlay elements
const victoryOverlay = document.getElementById('victory-overlay')!;
const victoryScore = document.getElementById('victory-score')!;
const victoryRank = document.getElementById('victory-rank')!;
const nameEntry = document.getElementById('name-entry')!;
const pilotNameInput = document.getElementById('pilot-name') as HTMLInputElement;
const submitScoreBtn = document.getElementById('submit-score')!;
const highscoreTable = document.getElementById('highscore-table')!;
const highscoreBody = document.getElementById('highscore-body')!;
const victoryContinueBtn = document.getElementById('victory-continue')!;
const fireworkCanvas = document.getElementById('firework-canvas') as HTMLCanvasElement;

// ── Core systems ──
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const engine = new GameEngine(canvas);
const input = new InputHandler();
const audio = new AudioSystem();
const editor = new SysMLEditor();
const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const lsp = new LSPClient({ baseUrl: isDev ? 'http://localhost:3001' : '' });
editor.setLSPClient(lsp);

// Pause game while editor has focus (but not during code phase — editor *should* be focused then)
const editorTextarea = document.getElementById('sysml-editor')!;
editorTextarea.addEventListener('focus', () => {
  input.clearAll(); // prevent stuck keys
  if (levelPhase !== 'code') engine.paused = true;
});
editorTextarea.addEventListener('blur', () => { engine.paused = false; });

// ── Blueprint schematic ──
const schematicPanel = document.getElementById('schematic-panel')!;
const schematicCanvas = document.getElementById('schematic-canvas') as HTMLCanvasElement;
const schematic = new ShuttleSchematic(schematicCanvas);

// ── Game entities (reset per level) ──
let spaceman: Spaceman;
let rocket: Rocket;
let platforms: Platform[] = [];
let aliens: Alien[] = [];
let collectibles: Collectible[] = [];
let particles: ParticleSystem;
let alienSpawnTimer = 0;
let collectibleSpawnTimer = 0;
let levelPhase: 'build' | 'fuel' | 'code' | 'launch' | 'complete' = 'build';

// ── Debug: skip gameplay via ?skip query parameter ──
const skipMode = new URLSearchParams(window.location.search).has('skip');

// ── Debug: jump to any level via ?level=N or console ──
function debugJumpToLevel(n: number) {
  const idx = n - 1; // levels are 1-based for users, 0-based internally
  if (idx < 0 || idx >= LEVELS.length) {
    console.warn(`Level ${n} out of range (1–${LEVELS.length})`);
    return;
  }
  console.log(`⚡ Jumping to level ${n}: ${LEVELS[idx].name}`);
  cumulativeCode = '';
  resumeScore = 0;
  showMissionBrief(idx);
}
(window as any).__jumpToLevel = debugJumpToLevel;

// ── Resize schematic canvas to its container ──
function resizeSchematicCanvas() {
  const panel = schematicCanvas.parentElement;
  if (!panel) return;
  const w = panel.clientWidth;
  const h = panel.clientHeight;
  if (schematicCanvas.width !== w || schematicCanvas.height !== h) {
    schematicCanvas.width = w;
    schematicCanvas.height = h;
  }
}

// ── Initialise ──
function init() {
  // App Insights telemetry (non-blocking)
  initTelemetry(isDev ? 'http://localhost:3001' : '');
  window.addEventListener('beforeunload', flushTelemetry);

  // Wire up game-play button listeners (needed for all paths including debug)
  startMissionBtn.addEventListener('click', () => startLevel());
  analyseBtn.addEventListener('click', () => analyseCode());
  // Launch button is now a status label — no click handler

  // Check for ?level=N URL parameter (debug shortcut)
  const params = new URLSearchParams(window.location.search);
  const levelParam = params.get('level');
  if (levelParam) {
    const n = parseInt(levelParam, 10);
    if (n >= 1 && n <= LEVELS.length) {
      // Defer jump until engine is running
      showScreen('title');
      editor.setConceptTags(levelConfig.mission.tags);
      engine.onUpdate = (dt) => gameUpdate(dt);
      engine.onRender = (ctx) => gameRender(ctx);
      engine.start();
      debugJumpToLevel(n);
      return;
    }
    console.warn(`?level=${levelParam} out of range (1–${LEVELS.length})`);
  }

  showScreen('title');

  // Wire up the initial concept tags from the HTML so they're clickable immediately
  editor.setConceptTags(levelConfig.mission.tags);

  // Load saved progress
  savedProgress = loadProgress();
  titleMenuIndex = 0;

  // Title screen keyboard input
  window.addEventListener('keydown', (e) => {
    if (currentScreen !== 'title') return;
    if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return;

    audio.unlock();

    // Toggle high score table with H key
    if (e.key === 'h' || e.key === 'H') {
      titleShowScores = !titleShowScores;
      titleShowAbout = false;
      return;
    }

    // Toggle about screen with A key
    if (e.key === 'a' || e.key === 'A') {
      titleShowAbout = !titleShowAbout;
      titleShowScores = false;
      return;
    }

    // Escape closes sub-screen (or does nothing if already on main)
    if (e.key === 'Escape' && (titleShowScores || titleShowAbout)) {
      titleShowScores = false;
      titleShowAbout = false;
      return;
    }

    // While viewing sub-screen, any other key returns to main title
    if (titleShowScores || titleShowAbout) {
      titleShowScores = false;
      titleShowAbout = false;
      return;
    }

    if (!savedProgress) {
      // No saved progress — Enter or Space starts new game
      if (e.key === 'Enter' || e.key === ' ') {
        showMissionBrief(0);
      }
      return;
    }

    // Menu navigation
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      titleMenuIndex = titleMenuIndex === 0 ? 1 : 0;
      e.preventDefault();
      return;
    }

    // Select current option
    if (titleMenuIndex === 0) {
      continueGame();
    } else {
      clearProgress();
      savedProgress = null;
      cumulativeCode = '';
      showMissionBrief(0);
    }
  });

  // Title screen click support
  titleScreen.addEventListener('click', (e) => {
    if (currentScreen !== 'title') return;
    audio.unlock();

    // Click while viewing sub-screen
    if (titleShowScores || titleShowAbout) {
      // On about screen, detect click on the resource link area
      if (titleShowAbout) {
        const canvasRect = canvas.getBoundingClientRect();
        const virtualY = ((e.clientY - canvasRect.top) / canvasRect.height) * engine.VIRTUAL_H;
        // Link occupies roughly y 248–262 in virtual coords
        if (virtualY >= 244 && virtualY <= 266) {
          const w = window.open('https://github.com/daltskin/SysML-v2-Resources', '_blank');
          if (w) w.opener = null;
          e.stopPropagation();
          return;
        }
      }
      titleShowScores = false;
      titleShowAbout = false;
      return;
    }

    if (!savedProgress) {
      showMissionBrief(0);
      return;
    }

    // Map click Y to virtual canvas coordinate to detect which menu item was hit
    const canvasRect = canvas.getBoundingClientRect();
    const virtualY = ((e.clientY - canvasRect.top) / canvasRect.height) * engine.VIRTUAL_H;
    const menuY = engine.VIRTUAL_H - 60;
    const midpoint = menuY + 9; // halfway between the two options (18px apart)
    const clickedNew = virtualY >= midpoint;

    if (clickedNew) {
      clearProgress();
      savedProgress = null;
      cumulativeCode = '';
      showMissionBrief(0);
    } else {
      continueGame();
    }
  });

  engine.onUpdate = (dt) => gameUpdate(dt);
  engine.onRender = (ctx) => gameRender(ctx);
  engine.start();

  // Resize schematic canvas on window resize
  window.addEventListener('resize', () => {
    resizeSchematicCanvas();
    schematic.render();
  });
  // Initial schematic render
  resizeSchematicCanvas();
  schematic.render();
}

// ── Screen management ──
function showScreen(screen: GameScreen) {
  currentScreen = screen;
  titleScreen.style.display = screen === 'title' ? 'flex' : 'none';

  // Show schematic only during gameplay and mission brief
  const showSchematic = screen === 'playing' || screen === 'mission_brief' || screen === 'game_over';
  if (showSchematic) {
    schematicPanel.classList.add('visible');
    resizeSchematicCanvas();
    schematic.render();
  } else {
    schematicPanel.classList.remove('visible');
  }

  // Refresh saved progress when returning to title
  if (screen === 'title') {
    savedProgress = loadProgress();
    titleMenuIndex = 0;
    titleShowScores = false;
    titleShowAbout = false;
    // Fetch scores in background for the title screen table
    lsp.getScores().then((s) => { titleScores = s; }).catch(() => {});
  }

  // Mission overlay uses CSS .active class for opacity/pointer-events transition
  if (screen === 'mission_brief') {
    missionOverlay.style.display = 'flex';
    // Force reflow so the transition triggers
    void missionOverlay.offsetWidth;
    missionOverlay.classList.add('active');
  } else {
    missionOverlay.classList.remove('active');
    // Hide after transition ends
    missionOverlay.addEventListener('transitionend', () => {
      if (!missionOverlay.classList.contains('active')) {
        missionOverlay.style.display = 'none';
      }
    }, { once: true });
  }
}

function showMissionBrief(levelIndex: number) {
  currentLevelIndex = levelIndex;
  levelConfig = LEVELS[levelIndex];
  const tier = getTierInfo(levelConfig.tier);

  missionTier.textContent = `${tier.icon} TIER: ${tier.name.toUpperCase()}`;
  missionTier.style.color = tier.colour;
  missionTitle.textContent = `Level ${levelConfig.id}: ${levelConfig.name}`;
  missionDesc.textContent = levelConfig.mission.brief;

  showScreen('mission_brief');

  // Skip mode: auto-start level without waiting for BEGIN MISSION click
  if (skipMode) setTimeout(() => startLevel(), 100);
}

function startLevel() {
  showScreen('playing');
  gameStarted = true;
  missionValidated = false;
  failedAnalyses = 0;
  usedReveal = false;
  levelAttemptCount = 0;
  levelStartTime = Date.now();
  if (currentLevelIndex === 0 && resumeScore === 0) gameStartTime = Date.now();
  trackLevelStart(levelConfig.id, levelConfig.name, levelConfig.tier);
  if (currentLevelIndex === 0 && resumeScore === 0) trackGameStart();

  // Reset engine
  engine.clearEntities();
  aliens = [];
  collectibles = [];
  alienSpawnTimer = 0;
  collectibleSpawnTimer = 0;

  // Determine initial phase
  levelPhase = levelConfig.buildRocket ? 'build' : 'fuel';

  // Update status label
  launchBtn.classList.remove('ready');
  launchBtn.textContent = levelConfig.buildRocket ? '🔧 BUILD' : '⛽ FUEL';

  // Create platforms — use per-level layout or fallback to default
  if (levelConfig.platforms) {
    const floorY = engine.VIRTUAL_H - 8;
    const c = levelConfig.platformColour;
    platforms = [
      new Platform({ x: 0, y: floorY, width: engine.VIRTUAL_W, height: 8, colour: c }),
      ...levelConfig.platforms.map((p) => new Platform({ ...p, colour: p.colour ?? c })),
    ];
  } else {
    platforms = createJetpacPlatforms(engine.VIRTUAL_W, engine.VIRTUAL_H, levelConfig.platformColour);
  }
  platforms.forEach((p) => engine.addEntity(p));

  // Create spaceman
  spaceman = new Spaceman(input, engine.VIRTUAL_W, engine.VIRTUAL_H);
  spaceman.insideRocket = false;

  // Restore score when continuing a saved game
  if (resumeScore > 0) {
    spaceman.score = resumeScore;
    resumeScore = 0;
  }
  spaceman.onDeath = () => {
    audio.playerDeath();
    engine.shake(6, 0.5);
    trackGameOver(levelConfig.id, spaceman?.score ?? 0);
    showScreen('game_over');
    setTimeout(() => {
      showMissionBrief(currentLevelIndex);
    }, 3000);
  };

  spaceman.onDrop = (_x: number, _y: number, item: { type: string; subtype?: string }) => {
    // Re-spawn dropped items so they aren't lost forever
    if (item.type === 'rocket_part' && item.subtype) {
      const part = spawnFalling('rocket_part', engine.VIRTUAL_W, item.subtype);
      collectibles.push(part);
      engine.addEntity(part);
    } else if (item.type === 'fuel_cell') {
      const cell = spawnFalling('fuel_cell', engine.VIRTUAL_W);
      collectibles.push(cell);
      engine.addEntity(cell);
    }
  };

  engine.addEntity(spaceman);

  // Create rocket
  rocket = new Rocket(levelConfig.rocketX, engine.VIRTUAL_H - 8);
  rocket.fuelNeeded = 3;

  // Spawn spaceman next to the rocket (right side of pad)
  spaceman.spawnX = levelConfig.rocketX + 44;
  spaceman.reset(spaceman.spawnX, engine.VIRTUAL_H - 40);
  if (!levelConfig.buildRocket) {
    // Pre-build the rocket for non-build levels
    rocket.placePart('base');
    rocket.placePart('mid');
    rocket.placePart('top');
  }
  rocket.onLaunchComplete = () => {
    audio.levelComplete();
    levelPhase = 'complete';
    launchBtn.textContent = '✓ DONE';
    spaceman.score += 500;

    const levelDuration = (Date.now() - levelStartTime) / 1000;
    trackLevelComplete(levelConfig.id, levelConfig.name, levelDuration, spaceman.score, levelAttemptCount);

    // Persist progress
    saveProgress();

    if (currentLevelIndex >= LEVELS.length - 1) {
      // Final level — Mars ending!
      showMarsEnding();
    } else {
      // Next level — skip mode uses minimal delay
      setTimeout(() => showMissionBrief(currentLevelIndex + 1), skipMode ? 200 : 2000);
    }
  };
  // NOTE: rocket is NOT added to engine entity list — it is rendered
  // manually in gameRender so it always draws over platforms.

  // Create particle system
  particles = new ParticleSystem();
  engine.addEntity(particles);

  // Setup editor
  // Persist SysML code across levels: all code lives inside one Spacecraft package
  if (currentLevelIndex === 0) {
    cumulativeCode = '';
    editor.setCode(levelConfig.mission.starterCode);
  } else {
    // Insert new level's code inside the Spacecraft package (before closing brace)
    const separator = '\n  // ── Level ' + levelConfig.id + ': ' + levelConfig.name + ' ──\n';
    const indentedStarter = levelConfig.mission.starterCode
      .trimEnd()
      .split('\n')
      .map((l: string) => '  ' + l)
      .join('\n') + '\n';

    const closingIdx = cumulativeCode.lastIndexOf('}');
    if (closingIdx >= 0) {
      // Insert before the outermost closing brace
      const before = cumulativeCode.substring(0, closingIdx);
      editor.setCode(before + separator + indentedStarter + '}\n');
    } else {
      // Fallback: wrap everything in a package
      editor.setCode('package Spacecraft {\n' + separator + indentedStarter + '}\n');
    }
  }
  editor.setMissionBrief(levelConfig.mission.brief);
  editor.setConceptTags(levelConfig.mission.tags);
  editor.clearDiagnostics();
  editor.setEnabled(true);

  // Update UI
  updateHUD();

  // Update blueprint schematic — mark all prior levels complete, highlight current
  schematic.setCompletedLevels(
    Array.from({ length: currentLevelIndex }, (_, i) => i + 1)
  );
  schematic.setActiveLevel(levelConfig.id);
  resizeSchematicCanvas();
  schematic.render();

  // Spawn initial building pieces if needed
  if (skipMode) {
    // Skip mode: pre-build & pre-fuel, jump straight to code phase
    rocket.placePart('base');
    rocket.placePart('mid');
    rocket.placePart('top');
    while (rocket.phase === 'fuelling') rocket.addFuel();
    levelPhase = 'code';
    launchBtn.textContent = '📝 CODE';
    editor.focus();
  } else if (levelConfig.buildRocket) {
    spawnNextRocketPart();
  } else {
    spawnFuelCells();
  }
}

// ── Game update (called 60× per second) ──
function gameUpdate(dt: number) {
  if (currentScreen !== 'playing') return;

  // Clear movement when editor has focus (prevents stuck keys)
  if (document.activeElement?.tagName === 'TEXTAREA') {
    input.clearAll();
    return; // paused — engine skips update via engine.paused flag
  }

  const platformRects = platforms.map((p) => p.rect);
  const floorY = engine.VIRTUAL_H - 8;

  // Resolve spaceman collisions
  spaceman.collidePlatforms(platformRects, floorY);

  // Resolve collectible physics
  for (const c of collectibles) {
    if (c.active) c.collidePlatforms(platformRects, floorY);
  }

  // Player thrust particles
  if (spaceman.thrusting) {
    particles.thrustTrail(
      spaceman.body.x + spaceman.body.width / 2,
      spaceman.body.y + spaceman.body.height
    );
    if (Math.random() > 0.7) audio.thrust();
  }

  // Laser firing
  if (input.wasPressed('fire') && !spaceman.carrying) {
    fireLaser();
  }

  // Pickup collectibles
  for (const c of collectibles) {
    if (!c.active) continue;
    if (!spaceman.carrying && overlaps(spaceman.body, c.body)) {
      pickupCollectible(c);
    }
  }

  // Drop carried items near rocket
  if (spaceman.carrying) {
    const dropZone = rocket.dropZone;
    const sx = spaceman.cx;
    const sy = spaceman.cy;
    if (
      sx >= dropZone.x &&
      sx <= dropZone.x + dropZone.width &&
      sy >= dropZone.y &&
      sy <= dropZone.y + dropZone.height
    ) {
      dropAtRocket();
    }
  }

  // Spaceman enters the rocket when it's fuelled (ready)
  if (rocket.phase === 'ready' && !spaceman.insideRocket) {
    const dz = rocket.dropZone;
    const sx = spaceman.cx;
    const sy = spaceman.cy;
    if (sx >= dz.x && sx <= dz.x + dz.width && sy >= dz.y && sy <= dz.y + dz.height) {
      // Hide spaceman inside the rocket
      spaceman.insideRocket = true;

      if (missionValidated) {
        // Code validated — launch immediately
        triggerLaunch();
      }
      // Otherwise spaceman waits inside; launch triggers on code validation
    }
  }

  // If spaceman is already inside the rocket and code just got validated, launch
  if (spaceman.insideRocket && missionValidated && rocket.phase === 'ready' && levelPhase !== 'launch') {
    triggerLaunch();
  }

  // Alien collisions with player
  for (const alien of aliens) {
    if (!alien.active) continue;
    if (!spaceman.insideRocket && overlaps(spaceman.body, alien.body)) {
      // Immune during code-writing and launch phases
      if (levelPhase !== 'code' && levelPhase !== 'launch' && levelPhase !== 'complete') {
        spaceman.hit();
        alien.active = false;
        particles.explode(alien.body.x + 6, alien.body.y + 6);
        audio.playerDeath();
        engine.shake(4, 0.3);
      }
    }

    // Track player position for homing aliens
    alien.targetX = spaceman.cx;
    alien.targetY = spaceman.cy;
  }

  // Update rocket manually (not in entity list so it renders on top)
  if (rocket) rocket.update(dt);

  // Spawn aliens periodically
  alienSpawnTimer += dt;
  const shouldSpawnAliens = !skipMode && levelPhase !== 'launch' && levelPhase !== 'complete';
  if (shouldSpawnAliens && alienSpawnTimer > 5 && aliens.filter((a) => a.active).length < levelConfig.alienCount) {
    const pattern = getAlienPatternForLevel(levelConfig.id);
    const wave = spawnAlienWave(1, pattern, levelConfig.alienSpeed, engine.VIRTUAL_W, engine.VIRTUAL_H);
    wave.forEach((a) => {
      aliens.push(a);
      engine.addEntity(a);
    });
    alienSpawnTimer = 0;
  }

  // Spawn fuel cells periodically during fuel phase
  if (levelPhase === 'fuel') {
    collectibleSpawnTimer += dt;
    if (collectibleSpawnTimer > 3 && collectibles.filter((c) => c.active && c.type === 'fuel_cell').length < 2) {
      spawnFuelCells();
      collectibleSpawnTimer = 0;
    }
  }

  // Rocket launch particles
  if (rocket.phase === 'launching') {
    particles.launchExhaust(rocket.x + 8, rocket.y);
  }

  // Clean up inactive collectibles
  collectibles = collectibles.filter((c) => c.active);
  aliens = aliens.filter((a) => a.active);

  // Flush input
  input.flush();
  updateHUD();
}

// ── Fire laser ──
function fireLaser() {
  audio.fire();
  const laserX = spaceman.facingLeft ? spaceman.body.x - 20 : spaceman.body.x + spaceman.body.width;
  const laserY = spaceman.body.y + 6;
  const laserDir = spaceman.facingLeft ? -1 : 1;

  // Check hit on aliens
  for (const alien of aliens) {
    if (!alien.active) continue;
    const ax = alien.body.x + alien.body.width / 2;
    const ay = alien.body.y + alien.body.height / 2;

    // Simple line-vs-box hit test
    const dx = ax - laserX;
    if (Math.sign(dx) !== laserDir) continue;
    if (Math.abs(dx) > 200) continue;
    if (Math.abs(ay - laserY) > 12) continue;

    // Hit!
    alien.active = false;
    particles.explode(ax, ay);
    audio.alienDeath();
    spaceman.score += 100;
    engine.addEntity(new FloatingText(ax, ay - 10, '+100'));
    break; // One hit per shot
  }
}

// ── Pickup collectible ──
function pickupCollectible(c: Collectible) {
  audio.pickup();
  particles.sparkle(c.body.x + 4, c.body.y + 4);
  spaceman.carrying = {
    type: c.type === 'rocket_part' ? 'rocket_part' : c.type === 'fuel_cell' ? 'fuel_cell' : 'gem',
    subtype: c.subtype,
  };
  c.active = false;

  if (c.type === 'gem') {
    spaceman.score += 250;
    engine.addEntity(new FloatingText(c.body.x, c.body.y - 10, '+250', '#ff40ff'));
  }
}

// ── Drop at rocket ──
function dropAtRocket() {
  if (!spaceman.carrying) return;

  const item = spaceman.carrying;
  spaceman.carrying = null;
  audio.drop();

  if (item.type === 'rocket_part' && item.subtype) {
    const partType = item.subtype.replace('rocket_', '') as 'base' | 'mid' | 'top';
    if (rocket.placePart(partType)) {
      spaceman.score += 200;
      engine.addEntity(new FloatingText(rocket.x, rocket.topY - 10, '+200'));
      particles.sparkle(rocket.x + 8, rocket.topY);

      if (rocket.phase === 'fuelling') {
        levelPhase = 'fuel';
        launchBtn.textContent = '⛽ FUEL';
        spawnFuelCells();
      } else {
        // Spawn next rocket part
        spawnNextRocketPart();
      }
    } else {
      // Wrong part — give it back to the player
      spaceman.carrying = item;
      const needed = rocket.nextPartNeeded;
      engine.addEntity(new FloatingText(rocket.x, rocket.topY - 20, needed ? `Need ${needed}!` : 'Done!', '#ff331c'));
    }
  } else if (item.type === 'fuel_cell') {
    if (rocket.addFuel()) {
      // Fuel complete — move to code phase
      levelPhase = 'code';
      launchBtn.textContent = '📝 CODE';
      spaceman.score += 100;
      engine.addEntity(new FloatingText(rocket.x, rocket.topY - 10, 'FUELLED!', '#00f92f'));

      if (missionValidated) {
        // SysML already done — launch immediately
        spaceman.insideRocket = true;
        triggerLaunch();
      } else {
        editor.focus();
      }
    } else {
      spaceman.score += 50;
      engine.addEntity(new FloatingText(rocket.x, rocket.topY - 10, '+50'));
    }
  }
}

// ── Spawn helpers ──
function spawnNextRocketPart() {
  const needed = rocket.nextPartNeeded;
  if (!needed) return;
  const part = spawnFalling('rocket_part', engine.VIRTUAL_W, `rocket_${needed}`);
  collectibles.push(part);
  engine.addEntity(part);
}

function spawnFuelCells() {
  const cell = spawnFalling('fuel_cell', engine.VIRTUAL_W);
  collectibles.push(cell);
  engine.addEntity(cell);

  // Also spawn a gem occasionally
  if (Math.random() > 0.6) {
    const gem = spawnFalling('gem', engine.VIRTUAL_W);
    collectibles.push(gem);
    engine.addEntity(gem);
  }
}

// ── Analyse code (editor button) ──
async function analyseCode() {
  if (!gameStarted || !rocket) {
    editor.showDiagnostics([{
      line: 1,
      severity: 'info',
      message: 'Press ENTER to start, then click BEGIN MISSION to play!',
    }]);
    return;
  }

  const code = editor.getCode();
  editor.formatCode();
  const formattedCode = editor.getCode();
  analyseBtn.textContent = '⟳ Checking...';
  analyseBtn.setAttribute('disabled', 'true');

  try {
    // Collect patterns from all prior levels for cumulative validation
    const priorPatterns = LEVELS.slice(0, currentLevelIndex).map(l => l.mission.expectedPattern);
    const result = await validateCode(formattedCode, levelConfig, lsp, priorPatterns);

    // Always show raw LSP diagnostics so the user sees every error/warning
    const lspDiags = result.diagnostics.map(d => ({
      line: d.line,
      severity: d.severity,
      message: d.message,
    }));

    if (result.passed) {
      levelAttemptCount++;
      trackLevelAttempt(levelConfig.id, levelAttemptCount, true);
      missionValidated = true;
      failedAnalyses = 0;
      // Save validated code so it persists into the next level
      cumulativeCode = editor.getCode();
      audio.codeSuccess();
      const noRevealBonus = usedReveal ? 0 : 50;
      const totalScore = result.score + noRevealBonus;
      spaceman.score += totalScore;
      engine.addEntity(new FloatingText(engine.VIRTUAL_W / 2, 100, `+${totalScore}${noRevealBonus ? ' (no reveal!)' : ''}`, '#00f92f'));
      launchBtn.classList.add('ready');
      launchBtn.textContent = '🚀 READY';

      // Update blueprint schematic with completed level
      schematic.completeLevel(levelConfig.id);
      schematic.render();

      // Skip mode: auto-launch immediately
      if (skipMode) {
        spaceman.insideRocket = true;
        triggerLaunch();
      } else {
        const nextStep = rocket.phase === 'ready'
          ? ' Walk into the rocket to launch!'
          : ' Finish building and fuelling the rocket.';
        editor.showDiagnostics([
          { line: 0, severity: 'info', message: result.feedback + nextStep },
          ...lspDiags,
        ]);
      }
    } else {
      levelAttemptCount++;
      trackLevelAttempt(levelConfig.id, levelAttemptCount, false);
      audio.codeError();
      failedAnalyses++;
      // Show game feedback first, then all LSP diagnostics
      const gameFeedback = result.feedback
        ? [{ line: 0, severity: 'warning' as const, message: result.feedback }]
        : [];
      editor.showDiagnostics([...gameFeedback, ...lspDiags]);

      // After 2 failed attempts, offer to reveal the answer
      if (failedAnalyses >= 2) {
        editor.showRevealButton(() => revealAnswer());
      }
    }
  } catch (err) {
    console.error('Analysis error:', err);
    editor.showDiagnostics([{
      line: 0,
      severity: 'error',
      message: 'Could not reach SysML server — is the bridge running? (make dev)',
    }]);
  } finally {
    analyseBtn.textContent = '▶ Analyse';
    analyseBtn.removeAttribute('disabled');
  }
}

// ── Reveal the solution for the current level ──
function revealAnswer() {
  usedReveal = true;
  const solution = levelConfig.mission.solution;

  if (currentLevelIndex === 0) {
    // First level — just set the solution directly; all lines are new
    const code = solution + '\n';
    editor.setCode(code);
    const lineCount = code.split('\n').length;
    editor.setHighlightLines(new Set(Array.from({ length: lineCount }, (_, i) => i + 1)));
  } else {
    // Build the full cumulative document from scratch using all prior
    // level solutions plus this level's solution, so the user can see
    // the complete history with the new code highlighted.
    const priorLevels = LEVELS.slice(1, currentLevelIndex); // levels 2..N-1 (level 1 is the package wrapper)
    const level1Solution = LEVELS[0].mission.solution; // package Spacecraft { ... }

    // Start with the package opening
    let body = '';
    for (const lvl of priorLevels) {
      body += '  // ── Level ' + lvl.id + ': ' + lvl.name + ' ──\n';
      body += lvl.mission.solution
        .trimEnd()
        .split('\n')
        .map((l: string) => '  ' + l)
        .join('\n') + '\n';
    }

    // Record where the new code starts (1-indexed line in the final document)
    const priorText = 'package Spacecraft {\n' + body;
    const newStartLine = priorText.split('\n').length; // line after the prior code

    // Append the current level's solution
    const separator = '  // ── Level ' + levelConfig.id + ': ' + levelConfig.name + ' ──\n';
    const indentedSolution = solution
      .trimEnd()
      .split('\n')
      .map((l: string) => '  ' + l)
      .join('\n') + '\n';

    const fullCode = priorText + separator + indentedSolution + '}\n';
    editor.setCode(fullCode);

    // Highlight the newly added lines (separator + solution)
    const newText = separator + indentedSolution;
    const newLineCount = newText.split('\n').filter((_, i, arr) => i < arr.length - 1 || arr[arr.length - 1] !== '').length;
    const hlLines = new Set<number>();
    for (let i = 0; i < newLineCount; i++) {
      hlLines.add(newStartLine + i);
    }
    editor.setHighlightLines(hlLines);
  }

  failedAnalyses = 0;
  editor.showDiagnostics([{
    line: 0,
    severity: 'info',
    message: '💡 Solution revealed! Click ANALYSE to validate.',
  }]);

  // Auto-analyse after a short delay so the user sees immediate feedback
  setTimeout(() => analyseCode(), 500);
}



/** Shared launch sequence — clears aliens, starts rocket, triggers effects */
function triggerLaunch() {
  rocket.startLaunch();
  audio.launch();
  engine.shake(3, 2);
  levelPhase = 'launch';
  launchBtn.classList.remove('ready');
  launchBtn.textContent = '🚀 LAUNCHING...';

  // Clear all aliens from the screen
  for (const alien of aliens) {
    if (alien.active) {
      alien.active = false;
    }
  }
  aliens = [];

  // Clear remaining collectibles too
  for (const c of collectibles) {
    if (c.active) c.active = false;
  }
  collectibles = [];
}

// ── HUD update ──
function updateHUD() {
  scoreDisplay.textContent = `SCORE: ${spaceman?.score ?? 0}`;
  levelDisplay.textContent = `LEVEL ${levelConfig.id}/${LEVELS.length}: ${levelConfig.name}`;
  livesDisplay.textContent = `LIVES: ${'♥'.repeat(spaceman?.lives ?? 3)}`;

  const tierInfo = getTierInfo(levelConfig.tier);
  destDisplay.textContent = `${tierInfo.icon} ${tierInfo.name}`;

  // Phase indicator
  const phaseIndicators: Record<string, string> = {
    build: 'BUILD ROCKET',
    fuel: 'COLLECT FUEL',
    code: 'WRITE SysML CODE',
    launch: 'LAUNCHING...',
    complete: 'LEVEL COMPLETE!',
  };
  destDisplay.textContent += ` — ${phaseIndicators[levelPhase] ?? ''}`;
}

// ── Title screen star positions (pre-computed) ──
const titleStars: { x: number; y: number; s: number; b: number }[] = [];
for (let i = 0; i < 120; i++) {
  titleStars.push({
    x: (i * 7919 + 137) % 480,
    y: (i * 104729 + 42) % 360,
    s: i % 11 === 0 ? 2 : 1,
    b: 0.3 + Math.random() * 0.7,
  });
}

// ── Retro canvas about / resources page (title sub-screen) ──
function renderTitleAbout(ctx: CanvasRenderingContext2D) {
  const W = engine.VIRTUAL_W;
  const H = engine.VIRTUAL_H;
  const t = Date.now() / 1000;

  // Deep space background
  ctx.fillStyle = '#000008';
  ctx.fillRect(0, 0, W, H);

  // Twinkling stars
  for (const star of titleStars) {
    const flicker = star.b * (0.6 + 0.4 * Math.sin(t * 2 + star.x));
    ctx.fillStyle = `rgba(200,210,255,${flicker})`;
    ctx.fillRect(star.x, star.y, star.s, star.s);
  }

  // Scanline overlay
  ctx.save();
  ctx.globalAlpha = 0.04;
  for (let y = 0; y < H; y += 3) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, y, W, 1);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // ── "ABOUT" header ──
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = scaledFont(20, 'bold', '"Courier New", monospace');
  ctx.fillStyle = '#220044';
  ctx.fillText('ABOUT', W / 2 + 2, 22);
  ctx.shadowColor = '#44aaff';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#88ccff';
  ctx.fillText('ABOUT', W / 2, 20);
  ctx.shadowBlur = 0;
  ctx.restore();

  // ── Info lines ──
  const lines: { text: string; colour: string; size: number; bold?: boolean; y: number }[] = [
    { text: 'JETPAC SysML v2', colour: '#ffee00', size: 11, bold: true, y: 60 },
    { text: 'Learn Systems Modelling by', colour: '#00ddff', size: 8, y: 82 },
    { text: 'building space rockets!', colour: '#00ddff', size: 8, y: 94 },
    { text: 'Write real SysML v2 code to fuel,', colour: 'rgba(200,210,255,0.7)', size: 7, y: 118 },
    { text: 'assemble, and launch your rocket', colour: 'rgba(200,210,255,0.7)', size: 7, y: 130 },
    { text: 'across ' + LEVELS.length + ' levels from Earth to Mars.', colour: 'rgba(200,210,255,0.7)', size: 7, y: 142 },
    { text: 'BUILT WITH', colour: '#ff88ff', size: 8, bold: true, y: 170 },
    { text: 'TypeScript \u2022 SysML v2 LSP \u2022 Canvas', colour: 'rgba(200,210,255,0.6)', size: 7, y: 185 },
    { text: 'Inspired by Ultimate Play The Game', colour: 'rgba(200,210,255,0.4)', size: 6, y: 198 },
    { text: 'SysML v2 TRAINING RESOURCES', colour: '#ffaa00', size: 9, bold: true, y: 228 },
  ];

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const ln of lines) {
    ctx.font = scaledFont(ln.size, ln.bold ? 'bold' : '');
    ctx.fillStyle = ln.colour;
    ctx.fillText(ln.text, W / 2, ln.y);
  }
  ctx.restore();

  // ── Resource link (underlined, pulsing) ──
  const linkY = 248;
  const linkText = 'github.com/daltskin/SysML-v2-Resources';
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = scaledFont(7, 'bold');
  const linkPulse = 0.7 + 0.3 * Math.sin(t * 2);
  ctx.fillStyle = `rgba(0,221,255,${linkPulse})`;
  ctx.fillText(linkText, W / 2, linkY);
  // Underline
  const metrics = ctx.measureText(linkText);
  const ulX = W / 2 - metrics.width / 2;
  ctx.strokeStyle = `rgba(0,221,255,${linkPulse * 0.6})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ulX, linkY + 13);
  ctx.lineTo(ulX + metrics.width, linkY + 13);
  ctx.stroke();
  ctx.restore();

  // ── Resource list ──
  const resources = [
    '\u2022 SPECIFICATION & REFERENCE GUIDES',
    '\u2022 TUTORIALS & WORKED EXAMPLES',
    '\u2022 TOOL LINKS & COMMUNITY',
  ];
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = scaledFont(6);
  ctx.fillStyle = 'rgba(200,210,255,0.55)';
  for (let i = 0; i < resources.length; i++) {
    ctx.fillText(resources[i], W / 2, 270 + i * 14);
  }
  ctx.restore();

  // ── "CLICK LINK TO OPEN" hint ──
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = scaledFont(5);
  ctx.fillStyle = 'rgba(200,200,255,0.35)';
  ctx.fillText('CLICK LINK TO OPEN IN BROWSER', W / 2, 318);
  ctx.restore();

  // ── Footer hint ──
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = scaledFont(6);
  const hintBlink = 0.4 + 0.3 * Math.sin(t * 3);
  ctx.fillStyle = `rgba(200,200,255,${hintBlink})`;
  ctx.fillText('PRESS A OR ESC TO RETURN', W / 2, H - 14);
  ctx.restore();
}

// ── Retro canvas high-score table (title sub-screen) ──
function renderTitleScores(ctx: CanvasRenderingContext2D) {
  const W = engine.VIRTUAL_W;
  const H = engine.VIRTUAL_H;
  const t = Date.now() / 1000;

  // Deep space background
  ctx.fillStyle = '#000008';
  ctx.fillRect(0, 0, W, H);

  // Twinkling stars (reuse same array)
  for (const star of titleStars) {
    const flicker = star.b * (0.6 + 0.4 * Math.sin(t * 2 + star.x));
    ctx.fillStyle = `rgba(200,210,255,${flicker})`;
    ctx.fillRect(star.x, star.y, star.s, star.s);
  }

  // Scanline overlay
  ctx.save();
  ctx.globalAlpha = 0.04;
  for (let y = 0; y < H; y += 3) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, y, W, 1);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // ── "HIGH SCORES" header ──
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = scaledFont(20, 'bold', '"Courier New", monospace');
  // Shadow
  ctx.fillStyle = '#220044';
  ctx.fillText('HIGH SCORES', W / 2 + 2, 22);
  // Glow
  ctx.shadowColor = '#ff44ff';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#ff88ff';
  ctx.fillText('HIGH SCORES', W / 2, 20);
  ctx.shadowBlur = 0;
  ctx.restore();

  // ── Column headers ──
  const tableX = 60;
  const rankX = tableX;
  const nameX = tableX + 36;
  const lvlX = W - tableX - 70;
  const scoreX = W - tableX;
  const headerY = 62;

  ctx.save();
  ctx.textBaseline = 'top';
  ctx.font = scaledFont(7, 'bold');
  ctx.fillStyle = '#00ddff';
  ctx.textAlign = 'left';
  ctx.fillText('RK', rankX, headerY);
  ctx.fillText('PILOT', nameX, headerY);
  ctx.fillText('LVL', lvlX, headerY);
  ctx.textAlign = 'right';
  ctx.fillText('SCORE', scoreX, headerY);
  ctx.restore();

  // Divider line
  ctx.strokeStyle = 'rgba(0,221,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tableX - 4, headerY + 14);
  ctx.lineTo(W - tableX + 4, headerY + 14);
  ctx.stroke();

  // ── Score rows ──
  const rowH = 18;
  const startY = headerY + 20;
  const maxRows = 15;

  if (titleScores.length === 0) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = scaledFont(9);
    ctx.fillStyle = 'rgba(200,200,255,0.4)';
    ctx.fillText('NO SCORES YET', W / 2, startY + 60);
    ctx.font = scaledFont(7);
    ctx.fillStyle = 'rgba(200,200,255,0.25)';
    ctx.fillText('COMPLETE ALL LEVELS TO SUBMIT YOUR SCORE', W / 2, startY + 80);
    ctx.restore();
  } else {
    for (let i = 0; i < Math.min(titleScores.length, maxRows); i++) {
      const s = titleScores[i];
      const y = startY + i * rowH;

      // Alternate row shading
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(tableX - 4, y - 2, W - 2 * tableX + 8, rowH);
      }

      // Top 3 get gold/silver/bronze colours
      const colours = ['#ffdd00', '#cccccc', '#cc8844'];
      const rowColour = i < 3 ? colours[i] : 'rgba(200,210,255,0.7)';
      const rankColour = i < 3 ? colours[i] : 'rgba(200,210,255,0.5)';

      ctx.save();
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';

      // Rank
      ctx.font = scaledFont(7, 'bold');
      ctx.fillStyle = rankColour;
      ctx.fillText(`${i + 1}.`, rankX, y);

      // Name
      ctx.font = scaledFont(8, i < 3 ? 'bold' : '');
      ctx.fillStyle = rowColour;
      ctx.fillText(s.name.slice(0, 12), nameX, y);

      // Level
      ctx.font = scaledFont(7);
      ctx.fillStyle = 'rgba(200,210,255,0.5)';
      ctx.fillText(`${s.level}`, lvlX, y);

      // Score
      ctx.textAlign = 'right';
      ctx.font = scaledFont(8, i < 3 ? 'bold' : '', '"Courier New", monospace');
      ctx.fillStyle = rowColour;
      ctx.fillText(String(s.score).padStart(6, '0'), scoreX, y);

      ctx.restore();
    }
  }

  // ── Footer hint ──
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = scaledFont(6);
  const hintBlink = 0.4 + 0.3 * Math.sin(t * 3);
  ctx.fillStyle = `rgba(200,200,255,${hintBlink})`;
  ctx.fillText('PRESS H OR CLICK TO RETURN', W / 2, H - 14);
  ctx.restore();
}

// ── Retro canvas title screen ──
function renderTitleScreen(ctx: CanvasRenderingContext2D) {
  // Delegate to sub-screens when active
  if (titleShowScores) {
    renderTitleScores(ctx);
    return;
  }
  if (titleShowAbout) {
    renderTitleAbout(ctx);
    return;
  }

  const W = engine.VIRTUAL_W;
  const H = engine.VIRTUAL_H;
  const t = Date.now() / 1000;

  // Deep space background
  ctx.fillStyle = '#000008';
  ctx.fillRect(0, 0, W, H);

  // Twinkling stars
  for (const star of titleStars) {
    const flicker = star.b * (0.6 + 0.4 * Math.sin(t * 2 + star.x));
    ctx.fillStyle = `rgba(200,210,255,${flicker})`;
    ctx.fillRect(star.x, star.y, star.s, star.s);
  }

  // ── Diagonal magenta/pink streaks (like original Jetpac) ──
  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 6; i++) {
    const yBase = 130 + i * 12 + Math.sin(t * 0.5 + i) * 4;
    const grad = ctx.createLinearGradient(0, yBase, W, yBase);
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.15, '#ff44ff');
    grad.addColorStop(0.5, '#ff88bb');
    grad.addColorStop(0.85, '#ff44ff');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, yBase + 20);
    ctx.lineTo(W, yBase - 15);
    ctx.lineTo(W, yBase - 15 + 3);
    ctx.lineTo(0, yBase + 23);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // ── Classic "JETPAC" logo (blue → white → red gradient with deep 3D extrusion) ──
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const logoText = 'JETPAC';
  const logoX = W / 2;
  const logoY = 32;
  const fontSize = Math.round(58 * TEXT_SCALE);
  const logoFont = `900 ${fontSize}px Impact, "Arial Black", sans-serif`;
  ctx.font = logoFont;

  // Deep 3D extrusion (12 layers, offset down-right, with own gradient per layer)
  const extDepth = 10;
  for (let d = extDepth; d > 0; d--) {
    const f = d / extDepth; // 1 = deepest, 0 = shallowest
    const ox = d * 0.6;
    const oy = d * 1.1;
    // Extrusion gradient: dark blue top → dark red bottom, darkened by depth
    const extGrad = ctx.createLinearGradient(0, logoY + oy, 0, logoY + oy + fontSize);
    const dim = 0.25 + 0.35 * (1 - f); // deeper = darker
    extGrad.addColorStop(0,   `rgb(${Math.floor(30 * dim)},${Math.floor(40 * dim)},${Math.floor(120 * dim)})`);
    extGrad.addColorStop(0.4, `rgb(${Math.floor(80 * dim)},${Math.floor(80 * dim)},${Math.floor(100 * dim)})`);
    extGrad.addColorStop(0.6, `rgb(${Math.floor(120 * dim)},${Math.floor(60 * dim)},${Math.floor(40 * dim)})`);
    extGrad.addColorStop(1,   `rgb(${Math.floor(140 * dim)},${Math.floor(30 * dim)},${Math.floor(10 * dim)})`);
    ctx.fillStyle = extGrad;
    ctx.fillText(logoText, logoX + ox, logoY + oy);
  }

  // Main face: blue → silver/white → red/orange gradient (top to bottom)
  const faceGrad = ctx.createLinearGradient(0, logoY, 0, logoY + fontSize);
  faceGrad.addColorStop(0,    '#1a3399');  // deep blue
  faceGrad.addColorStop(0.15, '#3366cc');  // mid blue
  faceGrad.addColorStop(0.28, '#7799dd');  // light blue
  faceGrad.addColorStop(0.38, '#bbccee');  // pale blue-white
  faceGrad.addColorStop(0.48, '#eeeeff');  // near-white
  faceGrad.addColorStop(0.52, '#eeeeff');  // near-white
  faceGrad.addColorStop(0.62, '#ddbbaa');  // warm pale
  faceGrad.addColorStop(0.72, '#cc7744');  // orange
  faceGrad.addColorStop(0.85, '#bb3311');  // red-orange
  faceGrad.addColorStop(1,    '#881100');  // deep red
  ctx.fillStyle = faceGrad;
  ctx.fillText(logoText, logoX, logoY);

  // Vertical groove lines across letters (ribbed metallic look)
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = 0.12;
  const textW = ctx.measureText(logoText).width;
  const leftEdge = logoX - textW / 2;
  for (let gx = leftEdge; gx < leftEdge + textW; gx += 4) {
    ctx.fillStyle = (Math.floor((gx - leftEdge) / 4) % 2 === 0) ? '#000000' : '#ffffff';
    ctx.fillRect(gx, logoY, 2, fontSize);
  }
  ctx.restore();

  // Redraw face text over the grooves to keep it crisp with slightly less groove opacity buildup
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = faceGrad;
  ctx.fillText(logoText, logoX, logoY);
  ctx.globalAlpha = 1;

  // Thin highlight line near top of letters (specular reflection)
  const hlY2 = logoY + fontSize * 0.3;
  ctx.save();
  ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 1.2);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.rect(logoX - textW / 2 - 4, hlY2, textW + 8, 2);
  ctx.clip();
  ctx.font = logoFont;
  ctx.fillText(logoText, logoX, logoY);
  ctx.restore();

  // Subtle outer glow
  ctx.shadowColor = '#3355aa';
  ctx.shadowBlur = 16;
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#5577cc';
  ctx.fillText(logoText, logoX, logoY);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  ctx.restore();

  // ── "SysML v2" subtitle — yellow with glow ──
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = scaledFont(22, 'bold', '"Courier New", monospace');
  ctx.shadowColor = '#ffaa00';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#ffee00';
  ctx.fillText('SysML v2', W / 2, 115);
  ctx.shadowBlur = 0;
  ctx.restore();

  // ── Spaceman (drawn large, 4× scale) ──
  const smX = W / 2 + 80;
  const smBobY = 160 + Math.sin(t * 1.2) * 8;
  drawSprite(ctx, 'spaceman_thrust', smX, smBobY, 4);

  // Thrust flame particles below the spaceman
  ctx.save();
  ctx.globalAlpha = 0.7 + 0.3 * Math.sin(t * 8);
  const flameY = smBobY + 60;
  ctx.fillStyle = '#ff4400';
  ctx.fillRect(smX + 16, flameY, 12, 10 + Math.random() * 14);
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(smX + 18, flameY, 8, 8 + Math.random() * 10);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(smX + 20, flameY, 4, 4 + Math.random() * 6);
  ctx.globalAlpha = 1;
  ctx.restore();

  // ── Rocket on left side (3× scale) ──
  const rktX = W / 2 - 160;
  drawSprite(ctx, 'rocket_top', rktX, 145, 3);
  drawSprite(ctx, 'rocket_mid', rktX, 145 + 96, 3);
  drawSprite(ctx, 'rocket_base', rktX, 145 + 192, 3);

  // ── Tagline ──
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = scaledFont(8);
  ctx.fillStyle = '#00ddff';
  ctx.fillText('LEARN SYSTEMS MODELLING BY BUILDING SPACE ROCKETS', W / 2, 145);
  ctx.restore();

  // ── Menu / Start prompt ──
  if (savedProgress) {
    // Level progress bar
    const barW = 160;
    const barH = 6;
    const barX = (W - barW) / 2;
    const barY = H - 95;
    const pct = savedProgress.highestLevel / LEVELS.length;

    // Bar background
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(barX, barY, barW, barH);

    // Level segment markers
    for (let i = 1; i < LEVELS.length; i++) {
      const sx = barX + (barW * i) / LEVELS.length;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(sx, barY, 1, barH);
    }

    // Bar fill gradient
    const fillGrad = ctx.createLinearGradient(barX, barY, barX + barW * pct, barY);
    fillGrad.addColorStop(0, '#00ff44');
    fillGrad.addColorStop(1, '#00ddff');
    ctx.fillStyle = fillGrad;
    ctx.fillRect(barX, barY, barW * pct, barH);

    // Bar border
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // Progress text
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = scaledFont(6);
    ctx.fillStyle = 'rgba(200,220,255,0.6)';
    ctx.fillText(
      `${savedProgress.highestLevel} OF ${LEVELS.length} LEVELS COMPLETE \u2014 SCORE: ${savedProgress.score}`,
      W / 2,
      barY - 4,
    );
    ctx.restore();

    // Menu options
    const menuY = H - 60;
    const nextLevelId = LEVELS[savedProgress.highestLevel].id;
    const opts = [
      { label: `CONTINUE  (LEVEL ${nextLevelId})`, y: menuY },
      { label: 'NEW GAME', y: menuY + 18 },
    ];

    ctx.save();
    ctx.textAlign = 'center';
    for (let i = 0; i < opts.length; i++) {
      const selected = titleMenuIndex === i;
      if (selected) {
        const blink = Math.sin(t * 4) > 0;
        ctx.font = scaledFont(10, 'bold');
        ctx.shadowColor = '#00ff44';
        ctx.shadowBlur = 8;
        ctx.fillStyle = blink ? '#00ff44' : '#00cc33';
        ctx.fillText(`\u25B6 ${opts[i].label}`, W / 2, opts[i].y);
        ctx.shadowBlur = 0;
      } else {
        ctx.font = scaledFont(9);
        ctx.fillStyle = 'rgba(200,200,255,0.35)';
        ctx.fillText(`  ${opts[i].label}`, W / 2, opts[i].y);
      }
    }
    ctx.restore();

    // Navigation hint
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = scaledFont(5);
    ctx.fillStyle = 'rgba(200,200,255,0.25)';
    ctx.fillText('\u2191\u2193 SELECT \u2014 ENTER TO START', W / 2, menuY + 35);
    ctx.restore();
  } else {
    // No saved progress — simple "PRESS ENTER"
    const blink = Math.sin(t * 3) > 0;
    if (blink) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = scaledFont(11, 'bold');
      ctx.shadowColor = '#00ff44';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#00ff44';
      ctx.fillText('PRESS ENTER TO START', W / 2, H - 44);
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  // ── Hints ──
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = scaledFont(7);
  ctx.fillStyle = 'rgba(0,221,255,0.55)';
  ctx.fillText('H = HIGH SCORES  \u2022  A = ABOUT', W / 2, H - 24);
  ctx.restore();

  // ── Credits line ──
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = scaledFont(6);
  ctx.fillStyle = 'rgba(200,200,255,0.4)';
  ctx.fillText('\u00A92026 \u2014 INSPIRED BY ULTIMATE PLAY THE GAME', W / 2, H - 10);
  ctx.restore();
}

// ── Render overlay (called by engine after entity render) ──
function gameRender(ctx: CanvasRenderingContext2D) {
  // ── Retro title screen (canvas-rendered) ──
  if (currentScreen === 'title') {
    renderTitleScreen(ctx);
    return;
  }

  // Rocket is rendered here (after all entities) so it always appears over platforms
  if (rocket && currentScreen === 'playing') {
    rocket.render(ctx);
  }

  // ── PAUSED overlay (editor has focus outside code phase) ──
  if (engine.paused && currentScreen === 'playing' && levelPhase !== 'code') {
    ctx.fillStyle = 'rgba(0, 0, 8, 0.55)';
    ctx.fillRect(0, 0, engine.VIRTUAL_W, engine.VIRTUAL_H);

    const t = Date.now() / 1000;
    const cx = engine.VIRTUAL_W / 2;
    const cy = engine.VIRTUAL_H / 2;

    // Retro chrome "PAUSED" text
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = scaledFont(20, 'bold', '"Press Start 2P", monospace');

    // Shadow
    ctx.fillStyle = '#110022';
    ctx.fillText('PAUSED', cx + 2, cy + 2);

    // Pulsing glow
    const pulse = 0.6 + 0.4 * Math.sin(t * 2);
    ctx.shadowColor = `rgba(0, 251, 254, ${pulse})`;
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#00fbfe';
    ctx.fillText('PAUSED', cx, cy);
    ctx.shadowBlur = 0;

    // Scanline accent
    ctx.globalAlpha = 0.15;
    for (let y = cy - 14; y < cy + 14; y += 4) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(cx - 100, y, 200, 2);
    }
    ctx.globalAlpha = 1;

    // Hint text
    ctx.font = scaledFont(6, '', '"Press Start 2P", monospace');
    ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + 0.3 * Math.sin(t * 3)})`;
    ctx.shadowBlur = 0;
    ctx.fillText('click game to resume', cx, cy + 24);
    ctx.restore();
    return;
  }

  if (currentScreen === 'game_over') {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, engine.VIRTUAL_W, engine.VIRTUAL_H);
    ctx.fillStyle = '#ff331c';
    ctx.font = scaledFont(16, '', '"Press Start 2P", monospace');
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', engine.VIRTUAL_W / 2, engine.VIRTUAL_H / 2 - 10);
    ctx.fillStyle = '#ffffff';
    ctx.font = scaledFont(8, '', '"Press Start 2P", monospace');
    ctx.fillText(`SCORE: ${spaceman?.score ?? 0}`, engine.VIRTUAL_W / 2, engine.VIRTUAL_H / 2 + 20);
    ctx.textAlign = 'left';
  }

  // Phase indicator on screen
  if (currentScreen === 'playing') {
    ctx.textAlign = 'center';

    if (levelPhase === 'build') {
      // Arrow pointing toward falling parts
      const blink = Math.sin(Date.now() / 250) > 0;
      ctx.fillStyle = blink ? '#ffea00' : 'rgba(255,234,0,0.4)';
      ctx.font = scaledFont(7, '', '"Press Start 2P", monospace');
      ctx.fillText('▼ COLLECT ROCKET PARTS ▼', engine.VIRTUAL_W / 2, 30);
      // Arrow pointing to launch pad
      ctx.fillStyle = 'rgba(0,251,254,0.6)';
      ctx.font = scaledFont(6, '', '"Press Start 2P", monospace');
      ctx.fillText('bring them here ↓', rocket.x + 8, rocket.y - 110);
    } else if (levelPhase === 'fuel') {
      const blink = Math.sin(Date.now() / 300) > 0;
      ctx.fillStyle = blink ? '#00f92f' : 'rgba(0,249,47,0.4)';
      ctx.font = scaledFont(7, '', '"Press Start 2P", monospace');
      ctx.fillText('▼ COLLECT FUEL CELLS ▼', engine.VIRTUAL_W / 2, 30);
    } else if (levelPhase === 'code') {
      ctx.fillStyle = 'rgba(0,251,254,0.8)';
      ctx.font = scaledFont(8, '', '"Press Start 2P", monospace');
      if (missionValidated && rocket.phase === 'ready') {
        const blink = Math.sin(Date.now() / 200) > 0;
        ctx.fillStyle = blink ? '#00f92f' : 'rgba(0,249,47,0.5)';
        ctx.fillText('ENTER THE ROCKET!', engine.VIRTUAL_W / 2, 34);
      } else {
        ctx.fillText('WRITE SysML CODE →', engine.VIRTUAL_W / 2, 34);
      }
    } else if (levelPhase === 'launch') {
      const blink = Math.sin(Date.now() / 150) > 0;
      ctx.fillStyle = blink ? '#ff331c' : '#ffea00';
      ctx.font = scaledFont(8, '', '"Press Start 2P", monospace');
      ctx.fillText('🚀 LAUNCHING!', engine.VIRTUAL_W / 2, 34);
    }

    // Show step checklist in corner during gameplay
    if (levelPhase !== 'complete' && levelPhase !== 'launch') {
      ctx.textAlign = 'left';
      ctx.font = scaledFont(5);
      const steps = [];
      if (levelConfig.buildRocket) {
        const built = rocket && rocket.placedCount === 3;
        steps.push({ label: 'Build rocket', done: built || levelPhase !== 'build' });
      }
      const fuelled = rocket && rocket.fuel >= rocket.fuelNeeded;
      steps.push({ label: 'Fuel rocket', done: !!fuelled });
      steps.push({ label: 'Write SysML', done: missionValidated });
      steps.push({ label: 'Launch!', done: false });

      const checkX = 4;
      let checkY = 28;
      for (const step of steps) {
        ctx.fillStyle = step.done ? '#00f92f' : 'rgba(255,255,255,0.35)';
        const mark = step.done ? '✓' : '○';
        ctx.fillText(`${mark} ${step.label}`, checkX, checkY);
        checkY += 9;
      }
    }

    ctx.textAlign = 'left';
  }

  // Re-render blueprint schematic each frame (for active-subsystem glow pulse)
  schematic.render();
}

// ── Mars ending cutscene → Victory celebration ──
function showMarsEnding() {
  currentScreen = 'mars_ending';

  // Hide schematic during ending
  schematicPanel.classList.remove('visible');

  // Stop the game engine render loop so it doesn't overwrite our cutscene canvas
  engine.stop();

  const ctx = engine.ctx;
  const finalScore = spaceman?.score ?? 0;
  const finalLevel = currentLevelIndex + 1;
  const totalDuration = (Date.now() - gameStartTime) / 1000;
  trackGameComplete(finalScore, totalDuration, finalLevel);
  let t = 0;
  let cutsceneDone = false;
  let lastTimestamp = 0;

  console.log('[Mars] Starting cutscene', { finalScore, finalLevel });

  const animate = (timestamp: number) => {
    // Use real wall-clock delta for accurate timing regardless of refresh rate
    if (lastTimestamp === 0) lastTimestamp = timestamp;
    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.1); // cap at 100ms
    lastTimestamp = timestamp;
    t += dt;

    // Mars red gradient
    const grad = ctx.createRadialGradient(
      engine.VIRTUAL_W / 2, engine.VIRTUAL_H, 0,
      engine.VIRTUAL_W / 2, engine.VIRTUAL_H, 200,
    );
    grad.addColorStop(0, '#d62816');
    grad.addColorStop(1, '#000000');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, engine.VIRTUAL_W, engine.VIRTUAL_H);

    // Stars
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) {
      const sx = (i * 137 + 42) % engine.VIRTUAL_W;
      const sy = (i * 97 + 13) % (engine.VIRTUAL_H * 0.6);
      ctx.fillRect(sx, sy, 1, 1);
    }

    // Mars surface
    ctx.fillStyle = '#d62816';
    ctx.fillRect(0, engine.VIRTUAL_H - 60, engine.VIRTUAL_W, 60);
    ctx.fillStyle = '#aa2010';
    ctx.fillRect(0, engine.VIRTUAL_H - 58, engine.VIRTUAL_W, 2);

    // Rocket landing
    const rocketY = Math.max(engine.VIRTUAL_H - 120, engine.VIRTUAL_H - 50 - t * 80);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(engine.VIRTUAL_W / 2 - 8, rocketY, 16, 48);
    ctx.fillStyle = '#ff331c';
    ctx.fillRect(engine.VIRTUAL_W / 2 - 4, rocketY - 4, 8, 8);

    // Text
    if (t > 3) {
      ctx.fillStyle = '#ffea00';
      ctx.font = scaledFont(12, '', '"Press Start 2P", monospace');
      ctx.textAlign = 'center';
      ctx.fillText('MISSION COMPLETE!', engine.VIRTUAL_W / 2, 60);

      if (t > 4) {
        ctx.fillStyle = '#ffffff';
        ctx.font = scaledFont(8, '', '"Press Start 2P", monospace');
        ctx.fillText('You have mastered SysML v2', engine.VIRTUAL_W / 2, 90);
        ctx.fillText(`Final Score: ${finalScore}`, engine.VIRTUAL_W / 2, 110);
      }

      if (t > 6) {
        ctx.fillStyle = '#00fbfe';
        ctx.font = scaledFont(8, '', '"Press Start 2P", monospace');
        ctx.fillText('Congratulations, Systems Engineer!', engine.VIRTUAL_W / 2, 140);
      }

      ctx.textAlign = 'left';
    }

    if (t < 8) {
      requestAnimationFrame(animate);
    } else if (!cutsceneDone) {
      cutsceneDone = true;
      console.log('[Mars] Cutscene complete, showing victory overlay');
      showVictoryOverlay(finalScore, finalLevel);
    }
  };

  requestAnimationFrame(animate);
}

// ── Victory overlay with fireworks + high score table ──
interface Firework {
  x: number; y: number;
  particles: { x: number; y: number; vx: number; vy: number; life: number; colour: string }[];
  age: number;
}

let fireworks: Firework[] = [];
let fireworkTimer = 0;
let fireworkAnimId = 0;

function spawnFirework(canvasW: number, canvasH: number): Firework {
  const colours = ['#ff331c', '#ffea00', '#00f92f', '#00fbfe', '#ff40ff', '#ffffff', '#d433ff'];
  const cx = 60 + Math.random() * (canvasW - 120);
  const cy = 40 + Math.random() * (canvasH * 0.5);
  const count = 30 + Math.floor(Math.random() * 30);
  const colour = colours[Math.floor(Math.random() * colours.length)];
  const particles = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 120;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.6 + Math.random() * 0.8,
      colour,
    });
  }
  return { x: cx, y: cy, particles, age: 0 };
}

function animateFireworks() {
  const fCtx = fireworkCanvas.getContext('2d');
  if (!fCtx) return;

  // Resize canvas to match overlay
  const rect = victoryOverlay.getBoundingClientRect();
  if (fireworkCanvas.width !== rect.width || fireworkCanvas.height !== rect.height) {
    fireworkCanvas.width = rect.width;
    fireworkCanvas.height = rect.height;
  }

  const dt = 1 / 60;
  fireworkTimer += dt;

  // Spawn new fireworks periodically
  if (fireworkTimer > 0.3 + Math.random() * 0.5) {
    fireworks.push(spawnFirework(fireworkCanvas.width, fireworkCanvas.height));
    fireworkTimer = 0;
  }

  // Fade-trail clear
  fCtx.fillStyle = 'rgba(5, 5, 15, 0.25)';
  fCtx.fillRect(0, 0, fireworkCanvas.width, fireworkCanvas.height);

  // Update and draw
  for (const fw of fireworks) {
    fw.age += dt;
    for (const p of fw.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 60 * dt; // gravity
      p.life -= dt;
      if (p.life > 0) {
        fCtx.globalAlpha = Math.min(1, p.life);
        fCtx.fillStyle = p.colour;
        const size = p.life > 0.3 ? 3 : 2;
        fCtx.fillRect(p.x, p.y, size, size);
      }
    }
  }
  fCtx.globalAlpha = 1;

  // Remove dead fireworks
  fireworks = fireworks.filter((fw) => fw.age < 3);

  fireworkAnimId = requestAnimationFrame(animateFireworks);
}

function renderHighScoreTable(
  scores: { name: string; score: number; level: number; date: string }[],
  highlightName?: string,
  highlightScore?: number,
) {
  highscoreBody.innerHTML = buildHighScoreRows(scores, highlightName, highlightScore);
}

async function showVictoryOverlay(finalScore: number, finalLevel: number) {
  console.log('[Victory] showVictoryOverlay called', { finalScore, finalLevel });

  // Populate score
  victoryScore.textContent = `SCORE: ${String(finalScore).padStart(6, '0')}`;
  victoryRank.textContent = '';

  // Show name entry, hide scores table + continue button until after submission
  nameEntry.style.display = 'flex';
  highscoreTable.style.display = 'none';
  victoryContinueBtn.style.display = 'none';
  pilotNameInput.value = '';

  // Show the overlay IMMEDIATELY — don't wait for network
  victoryOverlay.style.display = 'flex';
  void victoryOverlay.offsetWidth; // force reflow
  victoryOverlay.classList.add('active');

  // Focus input after overlay is visible
  setTimeout(() => pilotNameInput.focus(), 100);

  // Start fireworks
  fireworks = [];
  fireworkTimer = 0;
  fireworkAnimId = requestAnimationFrame(animateFireworks);

  // Submit handler
  const onSubmit = async () => {
    const name = pilotNameInput.value.trim().toUpperCase() || 'JETMAN';
    submitScoreBtn.textContent = '...';
    submitScoreBtn.setAttribute('disabled', '');

    const result = await lsp.submitScore(name, finalScore, finalLevel);
    trackHighScoreSubmit(result.rank, finalScore, finalLevel);

    if (result.rank > 0) {
      victoryRank.textContent = `RANK #${result.rank} — CONGRATULATIONS!`;
      renderHighScoreTable(result.scores, name, finalScore);
      highscoreTable.style.display = '';
    } else if (result.scores.length > 0) {
      victoryRank.textContent = 'SCORE SUBMITTED!';
      renderHighScoreTable(result.scores, name, finalScore);
      highscoreTable.style.display = '';
    } else {
      victoryRank.textContent = 'SCORE SAVED LOCALLY!';
    }

    // Show scores table, hide name entry, show continue button
    nameEntry.style.display = 'none';
    highscoreTable.style.display = '';
    victoryContinueBtn.style.display = '';
  };

  submitScoreBtn.textContent = 'SUBMIT';
  submitScoreBtn.removeAttribute('disabled');
  submitScoreBtn.onclick = onSubmit;
  pilotNameInput.onkeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') onSubmit();
  };

  // Continue button — return to title
  victoryContinueBtn.onclick = () => {
    cancelAnimationFrame(fireworkAnimId);
    victoryOverlay.classList.remove('active');
    setTimeout(() => {
      victoryOverlay.style.display = 'none';
    }, 600);
    clearProgress();
    savedProgress = null;
    // Restart the game engine (stopped during Mars cutscene)
    engine.start();
    showScreen('title');
  };
}

// ── Boot ──
init();