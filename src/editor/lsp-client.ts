// ── LSP Client: communicates with the sysml-v2-lsp server via HTTP bridge ──

import type { DiagnosticItem } from './editor';

export interface AnalyseResponse {
  valid: boolean;
  diagnostics: DiagnosticItem[];
  symbols?: string[];
  model?: Record<string, unknown>;
}

export interface CompletionItem {
  label: string;
  kind?: number;
  detail?: string;
  documentation?: string;
  insertText?: string;
}

export interface LSPClientConfig {
  /** Base URL for the LSP bridge server */
  baseUrl: string;
}

export class LSPClient {
  private baseUrl: string;
  private connected = false;

  constructor(config: LSPClientConfig) {
    this.baseUrl = config.baseUrl;
    this.checkConnection();
  }

  /** Check if the LSP bridge server is available */
  private async checkConnection() {
    try {
      const resp = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000),
      });
      if (resp.ok) {
        this.connected = true;
        console.log('[LSP] Connected to SysML v2 server');
      }
    } catch {
      console.warn('[LSP] Server not available — start bridge with: make dev');
    }
  }

  get isConnected(): boolean {
    return this.connected;
  }

  /** Analyse SysML code via the bridge (real ANTLR4 parser) */
  async analyse(code: string): Promise<AnalyseResponse> {
    const resp = await fetch(`${this.baseUrl}/api/analyse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!resp.ok) {
      throw new Error(`LSP error: ${resp.status}`);
    }

    return await resp.json();
  }

  /** Get completions at a position */
  async getCompletions(code: string, line: number, character: number): Promise<CompletionItem[]> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, line, character }),
        signal: AbortSignal.timeout(3000),
      });

      if (!resp.ok) return [];

      const data = await resp.json();
      return (data.items ?? []) as CompletionItem[];
    } catch {
      return [];
    }
  }

  /** Get example code for a concept */
  async getExample(concept: string): Promise<string | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/examples/${encodeURIComponent(concept)}`);
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.code ?? null;
    } catch {
      return null;
    }
  }

  /** Fetch the high score table */
  async getScores(): Promise<{ name: string; score: number; level: number; date: string }[]> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/scores`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) return [];
      const data = await resp.json();
      return data.scores ?? [];
    } catch {
      return [];
    }
  }

  /** Submit a score; returns rank (1-based) or 0 on failure */
  async submitScore(name: string, score: number, level: number): Promise<{ rank: number; scores: { name: string; score: number; level: number; date: string }[] }> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, score, level }),
        signal: AbortSignal.timeout(3000),
      });
      if (!resp.ok) return { rank: 0, scores: [] };
      return await resp.json();
    } catch {
      return { rank: 0, scores: [] };
    }
  }
}
