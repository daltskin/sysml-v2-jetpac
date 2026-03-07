// ── SysML Editor: in-browser code editor with syntax highlighting ──

/** Interface for any LSP-like client the editor can consume */
interface LSPClientLike {
  getExample(concept: string): Promise<string | null>;
  analyse(code: string): Promise<any>;
  getCompletions?(code: string, line: number, character: number): Promise<any[]>;
}

/** An entry in the autocomplete popup */
interface AutocompleteEntry {
  label: string;
  insertText: string;
  detail?: string;
}

/** Strip LSP snippet syntax: ${N:text} → text, $N / ${N} → '' */
function stripSnippet(s: string): string {
  return s.replace(/\$\{\d+:([^}]*)\}/g, '$1').replace(/\$\{?\d+\}?/g, '');
}

// ── Syntax grammar patterns (visual colouring only — all intelligence comes from the LSP) ──
const SYSML_KW_PATTERN = /\b(package|part|def|attribute|port|connect|interface|item|action|state|transition|constraint|requirement|require|use|case|enum|flow|allocate|satisfy|assert|verify|in|out|inout|first|then|to|from|of|doc|comment|subject|actor|ref|import|alias|abstract|variation|variant|individual|metadata|about|language|rep|occurrence|event|exhibit|perform|accept|assign|if|else|while|for|loop|merge|decide|fork|join|send|via|succession|binding)\b/g;
const SYSML_TYPE_PATTERN = /\b(Real|Integer|Boolean|String|Natural|Positive|ScalarValues|ISQ|SI)\b/g;

/** Syntax hints shown on hover for each keyword tag */
const KEYWORD_SYNTAX: Record<string, string> = {
  'package':          'package Name { }',
  'part':             'part name : Type;',
  'part def':         'part def Name { }',
  'attribute':        'attribute name : Type;',
  'port':             'port name : PortType;',
  'port def':         'port def Name { }',
  'connect':          'connect a.port to b.port;',
  'import':           'import PackageName::*;',
  'comment':          '/* comment text */',
  'doc':              'doc /* documentation text */',
  'enum':             'enum name;',
  'enum def':         'enum def Name { enum a; enum b; }',
  'action':           'action name;',
  'action def':       'action def Name { }',
  'state':            'state name;',
  'state def':        'state def Name { }',
  'entry':            'entry action actionName;',
  'exit':             'exit action actionName;',
  'transition':       'transition name first source then target;',
  'constraint':       'constraint def Name { }',
  'requirement':      'requirement def Name { }',
  'use case':         'use case def Name { }',
  'allocate':         'allocate source to target;',
  'interface':        'interface def Name { }',
  'interface def':    'interface def Name { in port a; out port b; }',
  'satisfy':          'satisfy RequirementName;',
  'assert':           'assert constraint ConstraintName;',
  'connection def':   'connection def Name { }',
};

export class SysMLEditor {
  private textarea: HTMLTextAreaElement;
  private lineNumbers: HTMLElement;
  private diagnosticsPanel: HTMLElement;
  private missionBrief: HTMLElement;
  private conceptTags: HTMLElement;
  private highlight: HTMLPreElement;
  private autocompletePopup: HTMLDivElement;
  private autocompleteItems: AutocompleteEntry[] = [];
  private autocompleteIndex = 0;
  private autocompleteVisible = false;
  private onChangeCallbacks: ((code: string) => void)[] = [];
  private lspClient: LSPClientLike | null = null;
  private completionDebounce: ReturnType<typeof setTimeout> | null = null;
  private allDiagnostics: DiagnosticItem[] = [];
  private diagnosticFilter: 'all' | 'warn' | 'errors' = 'errors';
  private highlightedLines = new Set<number>();
  private editorZoom = 100;
  private static readonly ZOOM_MIN = 75;
  private static readonly ZOOM_MAX = 200;
  private static readonly ZOOM_STEP = 25;
  private static readonly BASE_FONT = 12;

  constructor() {
    this.textarea = document.getElementById('sysml-editor') as HTMLTextAreaElement;
    this.lineNumbers = document.getElementById('line-numbers') as HTMLElement;
    this.diagnosticsPanel = document.getElementById('diagnostics-list') as HTMLElement;
    this.missionBrief = document.getElementById('brief-text') as HTMLElement;
    this.conceptTags = document.getElementById('brief-concepts') as HTMLElement;

    // Create syntax highlight overlay behind textarea
    this.highlight = document.createElement('pre');
    this.highlight.id = 'syntax-highlight';
    this.highlight.setAttribute('aria-hidden', 'true');
    const wrapper = document.createElement('div');
    wrapper.id = 'editor-wrapper';
    this.textarea.parentElement!.insertBefore(wrapper, this.textarea);
    wrapper.appendChild(this.highlight);
    wrapper.appendChild(this.textarea);

    // Create autocomplete popup
    this.autocompletePopup = document.createElement('div');
    this.autocompletePopup.id = 'autocomplete-popup';
    this.autocompletePopup.style.display = 'none';
    document.body.appendChild(this.autocompletePopup);

    // Wire diagnostics filter buttons
    document.querySelectorAll<HTMLButtonElement>('[data-diag-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.diagnosticFilter = btn.dataset.diagFilter as 'all' | 'warn' | 'errors';
        document.querySelectorAll('.diag-filters button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderDiagnostics();
      });
    });

    // Wire zoom buttons
    const zoomIn = document.getElementById('zoom-in');
    const zoomOut = document.getElementById('zoom-out');
    zoomIn?.addEventListener('click', () => this.zoom(SysMLEditor.ZOOM_STEP));
    zoomOut?.addEventListener('click', () => this.zoom(-SysMLEditor.ZOOM_STEP));

    this.setup();
  }

  private setup() {
    this.textarea.addEventListener('input', () => {
      this.highlightedLines.clear(); // clear reveal highlights on user edit
      this.updateLineNumbers();
      this.updateHighlight();
      this.checkAutocomplete();
      this.notifyChange();
    });
    this.textarea.addEventListener('scroll', () => {
      this.lineNumbers.scrollTop = this.textarea.scrollTop;
      this.highlight.scrollTop = this.textarea.scrollTop;
      this.highlight.scrollLeft = this.textarea.scrollLeft;
    });
    this.textarea.addEventListener('keydown', (e) => {
      // Autocomplete navigation takes priority
      if (this.autocompleteVisible) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.autocompleteIndex = Math.min(this.autocompleteIndex + 1, this.autocompleteItems.length - 1);
          this.renderAutocomplete();
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.autocompleteIndex = Math.max(this.autocompleteIndex - 1, 0);
          this.renderAutocomplete();
          return;
        }
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          this.acceptAutocomplete();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          this.hideAutocomplete();
          return;
        }
      }
      // Tab insertion with smart indent
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          this.outdentSelection();
        } else {
          this.smartIndent();
        }
        this.updateHighlight();
        this.notifyChange();
      }
      // Auto-close braces
      if (e.key === '{') {
        e.preventDefault();
        this.insertBraceBlock();
        this.updateHighlight();
        this.notifyChange();
      }
      // Enter with auto-indent
      if (e.key === 'Enter') {
        e.preventDefault();
        this.insertNewlineWithIndent();
        this.updateHighlight();
        this.notifyChange();
      }
    });

    this.textarea.addEventListener('blur', () => {
      setTimeout(() => this.hideAutocomplete(), 150);
    });

    this.updateLineNumbers();
    this.updateHighlight();
  }

  private updateLineNumbers() {
    const lines = this.textarea.value.split('\n').length;
    let html = '';
    for (let i = 1; i <= lines; i++) {
      html += `<div>${i}</div>`;
    }
    this.lineNumbers.innerHTML = html;
  }

  private notifyChange() {
    const code = this.textarea.value;
    for (const cb of this.onChangeCallbacks) {
      cb(code);
    }
  }

  /** Set the editor content */
  setCode(code: string) {
    this.textarea.value = code;
    this.highlightedLines.clear();
    this.updateLineNumbers();
    this.updateHighlight();
  }

  /** Mark specific lines (1-indexed) for visual highlighting (new code emphasis) */
  setHighlightLines(lines: Set<number>) {
    this.highlightedLines = lines;
    this.updateHighlight();
  }

  /** Get current code */
  getCode(): string {
    return this.textarea.value;
  }

  /** Auto-format the code with proper indentation based on brace nesting */
  formatCode() {
    const code = this.textarea.value;
    const lines = code.split('\n');
    let depth = 0;
    const formatted: string[] = [];

    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed) { formatted.push(''); continue; }

      // Closing brace decreases depth before indenting this line
      if (trimmed.startsWith('}')) depth = Math.max(0, depth - 1);

      formatted.push('  '.repeat(depth) + trimmed);

      // Opening brace increases depth for subsequent lines
      if (trimmed.endsWith('{')) depth++;
    }

    const result = formatted.join('\n');
    if (result !== code) {
      this.textarea.value = result;
      this.updateLineNumbers();
      this.updateHighlight();
    }
  }

  /** Set the mission brief text */
  setMissionBrief(text: string) {
    this.missionBrief.textContent = text;
  }

  /** Set concept tags — clickable to insert example code */
  setConceptTags(tags: string[]) {
    this.conceptTags.innerHTML = tags
      .map((t) => {
        const syntax = KEYWORD_SYNTAX[t] ?? `${t} ...`;
        return `<span class="concept-tag clickable" data-concept="${escapeHTML(t)}" title="${escapeHTML(syntax)}">${escapeHTML(t)}</span>`;
      })
      .join(' ');

    // Bind click handlers
    this.conceptTags.querySelectorAll('.concept-tag.clickable').forEach((el) => {
      (el as HTMLElement).style.cursor = 'pointer';
      el.addEventListener('click', () => {
        const concept = (el as HTMLElement).dataset.concept ?? '';
        this.insertConceptHint(concept);
      });
    });
  }

  /** Insert an LSP snippet at the appropriate location in the code */
  private async insertConceptHint(concept: string) {
    let snippet: string | null = null;

    // Get example from LSP
    if (this.lspClient) {
      try {
        snippet = await this.lspClient.getExample(concept);
      } catch { /* LSP unavailable */ }
    }

    if (!snippet) return;

    // Duplicate check: normalise whitespace and see if the snippet is already present
    const normalise = (s: string) => s.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
    if (normalise(this.textarea.value).includes(normalise(snippet))) {
      return; // already in the editor — skip
    }

    const ta = this.textarea;
    const code = ta.value;

    // Find insertion point: after the last placeholder comment, or before
    // the last closing brace, or at the end of the code.
    const lines = code.split('\n');

    let commentLineIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().startsWith('//')) {
        commentLineIdx = i;
        break;
      }
    }

    let insertPos: number;
    let indent: string;

    if (commentLineIdx >= 0) {
      // Insert on a new line after the placeholder comment, matching its indentation
      indent = lines[commentLineIdx].match(/^(\s*)/)?.[1] ?? '';
      let pos = 0;
      for (let i = 0; i <= commentLineIdx; i++) {
        pos += lines[i].length + (i < lines.length - 1 ? 1 : 0);
      }
      insertPos = pos;
    } else {
      const lastBrace = code.lastIndexOf('}');
      if (lastBrace > 0) {
        indent = '  ';
        insertPos = lastBrace;
      } else {
        indent = '';
        insertPos = code.length;
      }
    }

    // Indent the snippet to match the insertion context
    const indentedSnippet = snippet.split('\n').map(l => l.length ? indent + l : l).join('\n');

    const before = code.substring(0, insertPos);
    const after = code.substring(insertPos);
    const needsNewline = before.length > 0 && !before.endsWith('\n');
    const prefix = needsNewline ? '\n' : '';

    ta.value = before + prefix + indentedSnippet + '\n' + after;
    const cursorPos = insertPos + prefix.length + indentedSnippet.length + 1;
    ta.selectionStart = ta.selectionEnd = cursorPos;
    ta.focus();
    this.updateLineNumbers();
    this.updateHighlight();
    this.notifyChange();
  }

  /** Connect an LSP client for completions, formatting, and examples */
  setLSPClient(client: LSPClientLike) {
    this.lspClient = client;
  }

  /** Show diagnostics (errors/warnings) */
  showDiagnostics(items: DiagnosticItem[]) {
    this.allDiagnostics = items;
    this.renderDiagnostics();
  }

  /** Re-render the diagnostics list with the current filter applied */
  private renderDiagnostics() {
    const items = this.allDiagnostics;
    if (items.length === 0) {
      this.diagnosticsPanel.innerHTML =
        '<div class="diagnostic-item" style="color: var(--zx-bright-green)">✓ No errors</div>';
      return;
    }

    const filtered = items.filter((d) => {
      // Game meta-messages (line 0) always show
      if (d.line <= 0) return true;
      if (this.diagnosticFilter === 'errors') return d.severity === 'error';
      if (this.diagnosticFilter === 'warn') return d.severity === 'error' || d.severity === 'warning';
      return true; // 'all'
    });

    if (filtered.length === 0) {
      const total = items.filter((d) => d.line > 0).length;
      this.diagnosticsPanel.innerHTML =
        `<div class="diagnostic-item" style="color: var(--zx-bright-green)">✓ No errors (${total} hidden by filter)</div>`;
      return;
    }

    this.diagnosticsPanel.innerHTML = filtered
      .map((d) => {
        const icon = d.severity === 'error' ? '✗' : d.severity === 'warning' ? '⚠' : 'ℹ';
        const colour =
          d.severity === 'error'
            ? 'var(--zx-bright-red)'
            : d.severity === 'warning'
              ? 'var(--zx-bright-yellow)'
              : 'var(--zx-bright-cyan)';
        const loc = d.line > 0 ? `Line ${d.line}: ` : '';
        return `<div class="diagnostic-item" style="color: ${colour}">${icon} ${loc}${escapeHTML(d.message)}</div>`;
      })
      .join('');
  }

  /** Clear diagnostics */
  clearDiagnostics() {
    this.allDiagnostics = [];
    this.diagnosticsPanel.innerHTML = '';
  }

  /** Show a "Reveal Answer" button at the bottom of the diagnostics panel */
  showRevealButton(callback: () => void) {
    // Remove any existing reveal button first
    const existing = this.diagnosticsPanel.querySelector('.reveal-answer-btn');
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.className = 'reveal-answer-btn';
    btn.textContent = '💡 REVEAL ANSWER';
    btn.addEventListener('click', () => {
      btn.remove();
      callback();
    });
    this.diagnosticsPanel.appendChild(btn);
  }

  /** Zoom the editor text by the given delta (±25) */
  private zoom(delta: number) {
    this.editorZoom = Math.min(
      SysMLEditor.ZOOM_MAX,
      Math.max(SysMLEditor.ZOOM_MIN, this.editorZoom + delta),
    );
    const scale = this.editorZoom / 100;
    const fontSize = `${Math.round(SysMLEditor.BASE_FONT * scale)}px`;
    const lineHeight = '1.5';

    this.textarea.style.fontSize = fontSize;
    this.textarea.style.lineHeight = lineHeight;
    this.highlight.style.fontSize = fontSize;
    this.highlight.style.lineHeight = lineHeight;
    this.lineNumbers.style.fontSize = fontSize;
    this.lineNumbers.style.lineHeight = lineHeight;

    const label = document.getElementById('zoom-level');
    if (label) label.textContent = `${this.editorZoom}%`;
  }

  /** Register a callback for code changes */
  onChange(callback: (code: string) => void) {
    this.onChangeCallbacks.push(callback);
  }

  /** Focus the editor */
  focus() {
    this.textarea.focus();
  }

  /** Enable/disable the editor */
  setEnabled(enabled: boolean) {
    this.textarea.disabled = !enabled;
    this.textarea.style.opacity = enabled ? '1' : '0.5';
  }

  /** Update the syntax highlight overlay */
  private updateHighlight() {
    const code = this.textarea.value;
    let html = this.getHighlightedHTML(code);

    // Apply per-line background highlights for newly revealed code
    if (this.highlightedLines.size > 0) {
      const lines = html.split('\n');
      html = lines.map((line, i) => {
        const lineNum = i + 1;
        if (this.highlightedLines.has(lineNum)) {
          return `<span class="hl-new">${line}</span>`;
        }
        return line;
      }).join('\n');
    }

    this.highlight.innerHTML = html + '\n';
    this.highlight.scrollTop = this.textarea.scrollTop;
    this.highlight.scrollLeft = this.textarea.scrollLeft;
  }

  /** Check if autocomplete should be shown — delegates entirely to the LSP */
  private checkAutocomplete() {
    const ta = this.textarea;
    const pos = ta.selectionStart;
    const text = ta.value.substring(0, pos);

    // Don't trigger autocomplete when cursor is in the middle of a word
    const charAfter = ta.value[pos];
    if (charAfter && /\w/.test(charAfter)) {
      this.hideAutocomplete();
      return;
    }

    const match = text.match(/([a-zA-Z]\w*)$/);
    if (!match || match[1].length < 2) {
      this.hideAutocomplete();
      return;
    }
    const prefix = match[1].toLowerCase();

    // All completions come from the LSP (debounced)
    if (this.lspClient && typeof this.lspClient.getCompletions === 'function') {
      if (this.completionDebounce) clearTimeout(this.completionDebounce);
      this.completionDebounce = setTimeout(() => this.fetchLSPCompletions(prefix), 80);
    } else {
      this.hideAutocomplete();
    }
  }

  /** Fetch completions from the LSP server */
  private async fetchLSPCompletions(prefix: string) {
    if (!this.lspClient || typeof this.lspClient.getCompletions !== 'function') return;

    const ta = this.textarea;
    const pos = ta.selectionStart;
    const textUpTo = ta.value.substring(0, pos);
    const lines = textUpTo.split('\n');
    const line = lines.length - 1;
    const character = lines[line].length;

    try {
      const items = await this.lspClient.getCompletions(ta.value, line, character);
      if (!items || items.length === 0) {
        this.hideAutocomplete();
        return;
      }

      this.autocompleteItems = items
        .filter((i: any) => {
          const text = (i.label ?? i.insertText ?? '').toLowerCase();
          return text.startsWith(prefix) && text !== prefix;
        })
        .slice(0, 14)
        .map((i: any) => ({
          label: i.label ?? stripSnippet(i.insertText ?? ''),
          insertText: stripSnippet(i.insertText ?? i.label ?? ''),
          detail: i.detail ?? '',
        }));

      if (this.autocompleteItems.length === 0) {
        this.hideAutocomplete();
        return;
      }
      this.autocompleteIndex = 0;
      this.positionAutocomplete();
      this.autocompletePopup.style.display = 'block';
      this.autocompleteVisible = true;
      this.renderAutocomplete();
    } catch {
      // LSP completion failed — hide popup
      this.hideAutocomplete();
    }
  }

  private positionAutocomplete() {
    const ta = this.textarea;
    const text = ta.value.substring(0, ta.selectionStart);
    const lines = text.split('\n');
    const row = lines.length - 1;
    const col = lines[row].length;
    const style = getComputedStyle(ta);
    const lineHeight = parseFloat(style.lineHeight) || 18;
    const fontSize = parseFloat(style.fontSize) || 12;
    const charWidth = fontSize * 0.602;
    const rect = ta.getBoundingClientRect();
    const paddingLeft = parseFloat(style.paddingLeft) || 12;
    const paddingTop = parseFloat(style.paddingTop) || 8;
    const x = rect.left + paddingLeft + col * charWidth - ta.scrollLeft;
    const y = rect.top + paddingTop + (row + 1) * lineHeight - ta.scrollTop;
    this.autocompletePopup.style.left = `${Math.min(x, window.innerWidth - 160)}px`;
    this.autocompletePopup.style.top = `${Math.min(y, window.innerHeight - 200)}px`;
  }

  private renderAutocomplete() {
    this.autocompletePopup.innerHTML = this.autocompleteItems
      .slice(0, 10)
      .map((entry, i) => {
        const cls = i === this.autocompleteIndex ? 'ac-item active' : 'ac-item';
        const icon = '<span class="ac-lsp">L</span>';
        const detail = entry.detail ? `<span class="ac-detail">${escapeHTML(entry.detail)}</span>` : '';
        return `<div class="${cls}" data-index="${i}">${icon} ${escapeHTML(entry.label)}${detail}</div>`;
      })
      .join('');
    this.autocompletePopup.querySelectorAll('.ac-item').forEach((el) => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.autocompleteIndex = parseInt((el as HTMLElement).dataset.index ?? '0');
        this.acceptAutocomplete();
      });
    });
  }

  private acceptAutocomplete() {
    if (!this.autocompleteItems.length) return;
    const ta = this.textarea;
    const pos = ta.selectionStart;
    const text = ta.value;
    const before = text.substring(0, pos);
    const match = before.match(/([a-zA-Z]\w*)$/);
    if (!match) return;
    const wordStart = pos - match[1].length;
    const completion = this.autocompleteItems[this.autocompleteIndex].insertText;

    // Also consume any remaining word characters after cursor to avoid merging
    const afterMatch = text.substring(pos).match(/^(\w*)/);
    const skipAfter = afterMatch ? afterMatch[1].length : 0;

    ta.value = text.substring(0, wordStart) + completion + text.substring(pos + skipAfter);
    const newPos = wordStart + completion.length;
    ta.selectionStart = ta.selectionEnd = newPos;
    this.hideAutocomplete();
    this.updateHighlight();
    this.updateLineNumbers();
    this.notifyChange();
  }

  private hideAutocomplete() {
    this.autocompleteVisible = false;
    this.autocompletePopup.style.display = 'none';
  }

  /** Highlight SysML syntax with coloured spans (grammar patterns — intelligence comes from LSP) */
  getHighlightedHTML(code: string): string {
    let html = escapeHTML(code);

    // Keywords (grammar-level colouring)
    html = html.replace(SYSML_KW_PATTERN, '<span class="kw">$1</span>');

    // Types
    html = html.replace(SYSML_TYPE_PATTERN, '<span class="type">$1</span>');

    // Comments
    html = html.replace(/(\/\/.*)/g, '<span class="comment">$1</span>');
    html = html.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="comment">$1</span>');

    // Strings
    html = html.replace(/(&quot;.*?&quot;)/g, '<span class="string">$1</span>');

    return html;
  }

  // ── Smart editing helpers ──

  /** Insert two spaces (or indent selected lines) */
  private smartIndent() {
    const ta = this.textarea;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    if (start === end) {
      // No selection — insert 2 spaces
      ta.value = ta.value.substring(0, start) + '  ' + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = start + 2;
    } else {
      // Indent selected lines
      const val = ta.value;
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = val.indexOf('\n', end - 1);
      const endIdx = lineEnd === -1 ? val.length : lineEnd;
      const selectedBlock = val.substring(lineStart, endIdx);
      const indented = selectedBlock.split('\n').map((l) => '  ' + l).join('\n');
      ta.value = val.substring(0, lineStart) + indented + val.substring(endIdx);
      ta.selectionStart = lineStart;
      ta.selectionEnd = lineStart + indented.length;
    }
    this.updateLineNumbers();
  }

  /** Outdent selected lines (Shift+Tab) */
  private outdentSelection() {
    const ta = this.textarea;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = ta.value;
    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = val.indexOf('\n', end - 1);
    const endIdx = lineEnd === -1 ? val.length : lineEnd;
    const selectedBlock = val.substring(lineStart, endIdx);
    const outdented = selectedBlock.split('\n').map((l) => l.replace(/^ {1,2}/, '')).join('\n');
    ta.value = val.substring(0, lineStart) + outdented + val.substring(endIdx);
    ta.selectionStart = lineStart;
    ta.selectionEnd = lineStart + outdented.length;
    this.updateLineNumbers();
  }

  /** Insert { } block with cursor indented inside */
  private insertBraceBlock() {
    const ta = this.textarea;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const val = ta.value;

    // Determine current line's indentation
    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    const currentLine = val.substring(lineStart, start);
    const indent = currentLine.match(/^(\s*)/)?.[1] ?? '';

    const insertion = `{\n${indent}  \n${indent}}`;
    ta.value = val.substring(0, start) + insertion + val.substring(end);
    // Place cursor on the inner line
    ta.selectionStart = ta.selectionEnd = start + 2 + indent.length + 2;
    this.updateLineNumbers();
  }

  /** Enter key: auto-indent matching the current line, extra indent after { */
  private insertNewlineWithIndent() {
    const ta = this.textarea;
    const start = ta.selectionStart;
    const val = ta.value;

    // Find current line
    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    const currentLine = val.substring(lineStart, start);
    const indent = currentLine.match(/^(\s*)/)?.[1] ?? '';

    // If line ends with {, add extra indent
    const trimmed = currentLine.trimEnd();
    const extraIndent = trimmed.endsWith('{') ? '  ' : '';

    // If next char is }, add closing line too
    const afterCursor = val.substring(start);
    let insertion: string;
    let cursorOffset: number;

    if (extraIndent && afterCursor.trimStart().startsWith('}')) {
      // Between { and } — expand
      insertion = `\n${indent}${extraIndent}\n${indent}`;
      cursorOffset = 1 + indent.length + extraIndent.length;
    } else {
      insertion = `\n${indent}${extraIndent}`;
      cursorOffset = 1 + indent.length + extraIndent.length;
    }

    ta.value = val.substring(0, start) + insertion + val.substring(start);
    ta.selectionStart = ta.selectionEnd = start + cursorOffset;
    this.updateLineNumbers();
  }
}

function escapeHTML(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface DiagnosticItem {
  line: number;
  column?: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
}
