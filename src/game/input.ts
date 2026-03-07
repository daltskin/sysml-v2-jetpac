// ── Keyboard + touch input handler ──

export type KeyAction = 'left' | 'right' | 'thrust' | 'fire';

const KEY_MAP: Record<string, KeyAction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'thrust',
  ' ': 'thrust',
  z: 'fire',
  Z: 'fire',
};

export class InputHandler {
  private held = new Set<KeyAction>();
  private justPressed = new Set<KeyAction>();
  private anyKeyCallback?: () => void;

  constructor() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    this.initTouch();
  }

  /** Set up touch controls (buttons with data-action attributes) */
  private initTouch() {
    const container = document.getElementById('touch-controls');
    if (!container) return;

    container.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        const btn = (touch.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
        if (!btn) continue;
        const action = btn.dataset.action as KeyAction;
        if (!action) continue;

        // Any-key callback (title screen)
        if (this.anyKeyCallback) {
          this.anyKeyCallback();
          this.anyKeyCallback = undefined;
          return;
        }

        btn.classList.add('pressed');
        if (!this.held.has(action)) {
          this.justPressed.add(action);
        }
        this.held.add(action);
      }
    }, { passive: false });

    container.addEventListener('touchend', (e) => {
      e.preventDefault();
      for (const touch of Array.from(e.changedTouches)) {
        const btn = (touch.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
        if (!btn) continue;
        const action = btn.dataset.action as KeyAction;
        if (!action) continue;
        btn.classList.remove('pressed');
        this.held.delete(action);
      }
    }, { passive: false });

    container.addEventListener('touchcancel', (e) => {
      for (const touch of Array.from(e.changedTouches)) {
        const btn = (touch.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
        if (!btn) continue;
        const action = btn.dataset.action as KeyAction;
        if (!action) continue;
        btn.classList.remove('pressed');
        this.held.delete(action);
      }
    });
  }

  private onKeyDown(e: KeyboardEvent) {
    // Ignore when typing in editor
    if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return;

    // Any-key callback (title screen)
    if (this.anyKeyCallback) {
      this.anyKeyCallback();
      this.anyKeyCallback = undefined;
      return;
    }

    const action = KEY_MAP[e.key];
    if (action) {
      e.preventDefault();
      if (!this.held.has(action)) {
        this.justPressed.add(action);
      }
      this.held.add(action);
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
    const action = KEY_MAP[e.key];
    if (action) {
      this.held.delete(action);
    }
  }

  isHeld(action: KeyAction): boolean {
    return this.held.has(action);
  }

  wasPressed(action: KeyAction): boolean {
    return this.justPressed.has(action);
  }

  /** Call at end of each frame to clear just-pressed state */
  flush() {
    this.justPressed.clear();
  }

  /** Clear all held and just-pressed state (e.g. on editor focus) */
  clearAll() {
    this.held.clear();
    this.justPressed.clear();
  }

  /** Register a one-shot callback for any key press (title screen) */
  onAnyKey(callback: () => void) {
    this.anyKeyCallback = callback;
  }
}
