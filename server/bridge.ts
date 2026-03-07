// ── Server Bridge: HTTP server wrapping the real SysML v2 LSP (sysml-v2-lsp) ──
// Spawns the ANTLR4-based LSP server as a child process, communicates via JSON-RPC / stdio
// Provides: POST /api/analyse, POST /api/completions, GET /api/examples/:concept, GET /api/health
// All SysML v2 intelligence is driven exclusively by the LSP — no hardcoded snippets.

import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { spawn, type ChildProcess } from 'child_process';
import { resolve, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.PORT || '3001', 10);
const DIST_DIR = resolve(__dirname, '..', 'dist');

// ── Resolve the sysml-v2-lsp server bundle ──
// The npm package exports { serverPath } pointing to the bundled LSP server
const lspPkg = resolve(__dirname, '..', 'node_modules', 'sysml-v2-lsp');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { serverPath } = await import(resolve(lspPkg, 'index.cjs'));
const LSP_SERVER = resolve(lspPkg, serverPath);

// ── JSON-RPC ──
interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ── LSP child process manager ──
let lspProcess: ChildProcess | null = null;
let lspReady = false;
let nextRequestId = 1;
const pendingRequests = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
const diagnosticsStore = new Map<string, unknown[]>(); // uri → diagnostics

// Buffer for incoming LSP data (Content-Length header protocol)
let incomingBuffer = '';

function sendToLSP(msg: JsonRpcMessage) {
  if (!lspProcess || !lspProcess.stdin || lspProcess.killed) return;
  const body = JSON.stringify(msg);
  const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
  lspProcess.stdin.write(header + body);
}

function sendRequest(method: string, params: unknown): Promise<unknown> {
  return new Promise((resolveP, rejectP) => {
    const id = nextRequestId++;
    pendingRequests.set(id, { resolve: resolveP, reject: rejectP });
    sendToLSP({ jsonrpc: '2.0', id, method, params });
    // Timeout after 10s
    setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id);
        rejectP(new Error(`LSP request ${method} timed out`));
      }
    }, 10000);
  });
}

function sendNotification(method: string, params: unknown) {
  sendToLSP({ jsonrpc: '2.0', method, params });
}

function processLSPData(data: string) {
  incomingBuffer += data;

  while (true) {
    const headerEnd = incomingBuffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;

    const headerBlock = incomingBuffer.substring(0, headerEnd);
    const match = headerBlock.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      // Malformed — skip past the header
      incomingBuffer = incomingBuffer.substring(headerEnd + 4);
      continue;
    }

    const contentLength = parseInt(match[1], 10);
    const bodyStart = headerEnd + 4;
    if (incomingBuffer.length < bodyStart + contentLength) break; // wait for more data

    const body = incomingBuffer.substring(bodyStart, bodyStart + contentLength);
    incomingBuffer = incomingBuffer.substring(bodyStart + contentLength);

    try {
      const msg: JsonRpcMessage = JSON.parse(body);
      handleLSPMessage(msg);
    } catch (err) {
      console.error('[LSP] Failed to parse JSON-RPC message:', err);
    }
  }
}

function handleLSPMessage(msg: JsonRpcMessage) {
  // Response to a request we sent
  if (msg.id !== undefined && !msg.method) {
    const pending = pendingRequests.get(msg.id as number);
    if (pending) {
      pendingRequests.delete(msg.id as number);
      if (msg.error) {
        pending.reject(new Error(msg.error.message));
      } else {
        pending.resolve(msg.result);
      }
    }
    return;
  }

  // Notification from the server
  if (msg.method === 'textDocument/publishDiagnostics') {
    const params = msg.params as { uri: string; diagnostics: unknown[] };
    diagnosticsStore.set(params.uri, params.diagnostics);
  }
}

// ── Start the LSP server ──
async function startLSP(): Promise<void> {
  return new Promise((resolveP, rejectP) => {
    console.log(`[LSP] Starting sysml-v2-lsp server: ${LSP_SERVER}`);
    lspProcess = spawn(process.execPath, [LSP_SERVER, '--stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    lspProcess.stdout!.setEncoding('utf-8');
    lspProcess.stdout!.on('data', (chunk: string) => processLSPData(chunk));
    lspProcess.stderr!.on('data', (chunk: Buffer) => {
      // LSP servers log to stderr — forward as info
      const text = chunk.toString().trim();
      if (text) console.log(`[LSP stderr] ${text}`);
    });
    lspProcess.on('exit', (code) => {
      console.log(`[LSP] Server exited with code ${code}`);
      lspReady = false;
      lspProcess = null;
    });
    lspProcess.on('error', (err) => {
      console.error('[LSP] Failed to start:', err);
      lspReady = false;
      rejectP(err);
    });

    // Send the initialize request
    sendRequest('initialize', {
      processId: process.pid,
      capabilities: {
        textDocument: {
          publishDiagnostics: { relatedInformation: true },
          completion: { completionItem: { snippetSupport: true } },
          semanticTokens: { requests: { full: true } },
        },
      },
      rootUri: null,
      workspaceFolders: null,
    }).then((result) => {
      console.log('[LSP] Initialized successfully');
      sendNotification('initialized', {});
      lspReady = true;
      resolveP();
    }).catch((err) => {
      console.error('[LSP] Initialize failed:', err);
      rejectP(err);
    });
  });
}

// ── Document tracking ──
let docVersion = 0;

function getDocUri(id: string) {
  return `file:///game/${id}.sysml`;
}

async function analyseCode(code: string, docId = 'editor'): Promise<{
  valid: boolean;
  diagnostics: Array<{ line: number; column?: number; severity: 'error' | 'warning' | 'info'; message: string }>;
  symbols?: string[];
  model?: unknown;
}> {
  if (!lspReady) throw new Error('LSP server not ready');

  const uri = getDocUri(docId);
  const version = ++docVersion;

  // Open / update the document
  sendNotification('textDocument/didOpen', {
    textDocument: { uri, languageId: 'sysml', version, text: code },
  });

  // Wait briefly for diagnostics to be published
  await new Promise((r) => setTimeout(r, 200));

  const rawDiags = (diagnosticsStore.get(uri) ?? []) as Array<{
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    severity?: number;
    message: string;
    code?: string | number;
  }>;

  // Map LSP severity: 1=Error, 2=Warning, 3=Information, 4=Hint
  const diagnostics = rawDiags.map((d) => ({
    line: (d.range?.start?.line ?? 0) + 1,
    column: d.range?.start?.character,
    severity: (d.severity === 1 ? 'error' : d.severity === 2 ? 'warning' : 'info') as 'error' | 'warning' | 'info',
    message: d.message,
  }));

  // Extract symbols via document symbols request
  let symbols: string[] = [];
  try {
    const docSymbols = await sendRequest('textDocument/documentSymbol', {
      textDocument: { uri },
    }) as Array<{ name: string; children?: Array<{ name: string }> }> | null;

    if (docSymbols) {
      const extractNames = (syms: Array<{ name: string; children?: Array<{ name: string }> }>): string[] => {
        const names: string[] = [];
        for (const s of syms) {
          names.push(s.name);
          if (s.children) names.push(...extractNames(s.children));
        }
        return names;
      };
      symbols = extractNames(docSymbols);
    }
  } catch { /* symbols are optional */ }

  // Try to get model data
  let model: unknown = undefined;
  try {
    model = await sendRequest('sysml/model', {
      textDocument: { uri },
      scope: ['elements', 'relationships'],
    });
  } catch { /* model is optional */ }

  // Close the document
  sendNotification('textDocument/didClose', {
    textDocument: { uri },
  });

  const errors = diagnostics.filter((d) => d.severity === 'error');
  return {
    valid: errors.length === 0,
    diagnostics,
    symbols,
    model,
  };
}

// ── Completion support ──
async function getCompletions(code: string, line: number, character: number, docId = 'editor'): Promise<unknown[]> {
  if (!lspReady) return [];

  const uri = getDocUri(docId);
  const version = ++docVersion;

  sendNotification('textDocument/didOpen', {
    textDocument: { uri, languageId: 'sysml', version, text: code },
  });

  try {
    const result = await sendRequest('textDocument/completion', {
      textDocument: { uri },
      position: { line, character },
    }) as { items?: unknown[] } | unknown[] | null;

    const items = Array.isArray(result) ? result : result?.items ?? [];
    return items;
  } catch {
    return [];
  } finally {
    sendNotification('textDocument/didClose', { textDocument: { uri } });
  }
}

// ── Examples (LSP-driven) ──
// Asks the LSP for a completion matching the concept keyword and returns its insertText.
async function getExampleFromLSP(concept: string): Promise<string | null> {
  if (!lspReady) return null;

  // Build a minimal document with just the keyword prefix so the LSP can complete it
  const code = concept;
  const line = 0;
  const character = concept.length;

  try {
    const items = await getCompletions(code, line, character, 'example') as Array<{
      label?: string;
      insertText?: string;
      detail?: string;
    }>;

    if (!items || items.length === 0) return null;

    // Find the best match: prefer exact label, then prefix, then insertText
    const lc = concept.toLowerCase();
    const match = items.find((i) => (i.label ?? '').toLowerCase() === lc)
      ?? items.find((i) => (i.label ?? '').toLowerCase().startsWith(lc))
      ?? items.find((i) => (i.insertText ?? '').toLowerCase().includes(lc))
      ?? items[0];

    const raw = match.insertText ?? match.label ?? null;
    if (!raw) return null;

    // Strip LSP snippet syntax: ${N:text} → text, $N / ${N} → ''
    return raw.replace(/\$\{\d+:([^}]*)\}/g, '$1').replace(/\$\{?\d+\}?/g, '');
  } catch {
    return null;
  }
}

// ── High Score Persistence ──
interface ScoreEntry {
  name: string;
  score: number;
  level: number;          // highest level reached (1-based)
  date: string;           // ISO date string
}

// On Azure App Service Linux, /home/ is persistent across deploys.
// resolve(__dirname, '..', 'data') would land in /home/site/wwwroot/data/
// which gets wiped by zip deploy.  Use /home/data/ when running on Azure.
const DATA_DIR = process.env.DATA_DIR || (
  existsSync('/home/site') ? '/home/data' : resolve(__dirname, '..', 'data')
);
const SCORES_FILE = resolve(DATA_DIR, 'highscores.json');
const MAX_SCORES = 20;

function loadScores(): ScoreEntry[] {
  try {
    if (!existsSync(SCORES_FILE)) return [];
    const raw = readFileSync(SCORES_FILE, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.slice(0, MAX_SCORES);
  } catch {
    return [];
  }
}

function saveScores(scores: ScoreEntry[]) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2), 'utf-8');
}

function addScore(entry: ScoreEntry): { rank: number; scores: ScoreEntry[] } {
  const scores = loadScores();
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  const trimmed = scores.slice(0, MAX_SCORES);
  saveScores(trimmed);
  const rank = trimmed.findIndex(
    (s) => s.name === entry.name && s.score === entry.score && s.date === entry.date,
  );
  return { rank: rank + 1, scores: trimmed };
}

// ── HTTP helpers ──
function readBody(req: IncomingMessage, maxBytes = 64 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) { req.destroy(); reject(new Error('Body too large')); return; }
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// ── HTTP Server ──
const ALLOWED_ORIGINS = [
  'https://jetpac-sysml.azurewebsites.net',
  'http://localhost:3000',
  'http://localhost:3001',
];

const httpServer = createServer(async (req, res) => {
  // CORS — restrict to known origins
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  // ── Health ──
  if (url.pathname === '/api/health' && req.method === 'GET') {
    return json(res, 200, { status: 'ok', lsp: lspReady });
  }

  // ── Client config (App Insights connection string) ──
  if (url.pathname === '/api/config' && req.method === 'GET') {
    return json(res, 200, {
      aiConnectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING || '',
    });
  }

  // ── Analyse ──
  if (url.pathname === '/api/analyse' && req.method === 'POST') {
    try {
      const { code } = JSON.parse(await readBody(req));
      const result = await analyseCode(code ?? '');
      return json(res, 200, result);
    } catch (err) {
      return json(res, 400, { error: 'Invalid request body' });
    }
  }

  // ── Completions ──
  if (url.pathname === '/api/completions' && req.method === 'POST') {
    try {
      const { code, line, character } = JSON.parse(await readBody(req));
      const items = await getCompletions(code ?? '', line ?? 0, character ?? 0);
      return json(res, 200, { items });
    } catch (err) {
      return json(res, 400, { error: 'Invalid request body' });
    }
  }

  // ── High Scores: GET ──
  if (url.pathname === '/api/scores' && req.method === 'GET') {
    return json(res, 200, { scores: loadScores() });
  }

  // ── High Scores: POST ──
  if (url.pathname === '/api/scores' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req));
      const name = (typeof body.name === 'string' ? body.name.trim() : 'ANON').substring(0, 12).toUpperCase() || 'ANON';
      const score = typeof body.score === 'number' ? Math.max(0, Math.floor(body.score)) : 0;
      const level = typeof body.level === 'number' ? Math.max(1, Math.floor(body.level)) : 1;
      const entry: ScoreEntry = { name, score, level, date: new Date().toISOString() };
      const result = addScore(entry);
      return json(res, 200, result);
    } catch {
      return json(res, 400, { error: 'Invalid request body' });
    }
  }

  // ── Examples (LSP-driven) ──
  const exampleMatch = url.pathname.match(/^\/api\/examples\/(.+)$/);
  if (exampleMatch && req.method === 'GET') {
    const concept = decodeURIComponent(exampleMatch[1]);
    const code = await getExampleFromLSP(concept);
    if (code) return json(res, 200, { code });
    return json(res, 404, { error: 'No LSP completion found for concept' });
  }

  // ── Static file serving (production: serve dist/) ──
  serveStatic(req, res, url.pathname);
});

// ── Static file server ──
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
};

function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string) {
  // Resolve to dist directory, default to index.html
  let filePath = resolve(DIST_DIR, pathname === '/' ? 'index.html' : pathname.slice(1));

  // Prevent path traversal
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  // SPA fallback: if file doesn't exist, serve index.html
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    filePath = resolve(DIST_DIR, 'index.html');
  }

  if (!existsSync(filePath)) {
    res.writeHead(404); res.end('Not found'); return;
  }

  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const body = readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://*.applicationinsights.azure.com https://dc.services.visualstudio.com; font-src 'self'; frame-ancestors 'none'",
  });
  res.end(body);
}

// ── Boot sequence ──
async function boot() {
  await startLSP();

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 SysML Bridge Server running on http://0.0.0.0:${PORT}`);
    console.log(`   Static: ${DIST_DIR}`);
    console.log('   LSP: ✓ sysml-v2-lsp (ANTLR4 parser)');
    console.log('   POST /api/analyse       — Validate SysML code');
    console.log('   POST /api/completions   — Get completions at position');
    console.log('   GET  /api/examples/:id  — Get example code');
    console.log('   GET  /api/scores        — Get high score table');
    console.log('   POST /api/scores        — Submit a score');
    console.log('   GET  /api/health        — Health check');
  });
}

boot();
