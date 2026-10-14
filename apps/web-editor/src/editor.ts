import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
  insertCompletionText,
  pickedCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult
} from "@codemirror/autocomplete";
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, undo } from "@codemirror/commands";
import { bracketMatching, indentOnInput, indentUnit, syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { lintGutter, linter, type Diagnostic } from "@codemirror/lint";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import {
  completionItems,
  formatScript,
  FormattingError,
  MAX_SCRIPT_CHARACTERS,
  scriptCharacterCount,
  validate,
  type AutomatorCompletionItem,
  type AutomatorDiagnostic
} from "@adme/automator-language";
import { tokenizeAutomatorLine as tokenizeLine } from "@adme/automator-language/highlighting";
import { automatorLanguage } from "./automator-language";
import { completionFilterText, completionStart, diagnosticRange } from "./editor-adapters.mjs";
import { readDraft, writeDraft, type Draft } from "./storage";

const automatorHighlighting = HighlightStyle.define([
  { tag: tags.definitionKeyword, color: "#ff79c6", fontWeight: "600" },
  { tag: tags.keyword, color: "#82aaff", fontWeight: "600" },
  { tag: tags.modifier, color: "#c792ea" },
  { tag: tags.string, color: "#c3e88d" },
  { tag: tags.comment, color: "#718096", fontStyle: "italic" },
  { tag: tags.number, color: "#f78c6c" },
  { tag: tags.operator, color: "#89ddff" },
  { tag: tags.typeName, color: "#ffcb6b" },
  { tag: tags.atom, color: "#f07178" },
  { tag: tags.function(tags.name), color: "#f2a272" },
  { tag: tags.punctuation, color: "#a6accd" }
]);

const editorTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "#e6eaf2",
    backgroundColor: "#10141c",
    fontSize: "var(--editor-font-size, 15px)"
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', monospace",
    lineHeight: "1.65",
    overscrollBehavior: "contain"
  },
  ".cm-content": {
    width: "max-content",
    minWidth: "100%",
    minHeight: "100%",
    padding: "14px 0",
    caretColor: "#82aaff"
  },
  ".cm-line": { width: "max-content", minWidth: "100%", padding: "0 14px", whiteSpace: "pre" },
  ".cm-gutters": {
    color: "#667085",
    backgroundColor: "#10141c",
    border: "none",
    borderRight: "1px solid #252c38"
  },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 10px" },
  ".cm-activeLine": { backgroundColor: "#171d27" },
  ".cm-activeLineGutter": { color: "#c8d1e0", backgroundColor: "#171d27" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#82aaff" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { backgroundColor: "#376fb0" },
  ".cm-matchingBracket": { color: "#c3e88d", outline: "1px solid #c3e88d" },
  ".cm-nonmatchingBracket": { color: "#ff5370", outline: "1px solid #ff5370" }
}, { dark: true });

function automatorCompletionSource(context: CompletionContext): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos);
  const linePrefix = line.text.slice(0, context.pos - line.from);
  const cursorColumn = context.pos - line.from;
  const protectedToken = automatorTokens(line.text).find(token =>
    (token.type === "comment" && cursorColumn >= token.start) ||
    (token.type === "string" && cursorColumn > token.start && cursorColumn < token.end)
  );
  if (protectedToken) return null;
  if (!context.explicit && !/\S/.test(linePrefix)) return null;

  const items = completionItems(linePrefix);
  if (!items.length) return null;
  const currentWord = linePrefix.match(/\S+$/)?.[0] ?? "";
  const query = currentWord.toLowerCase();
  const queryStart = context.pos - currentWord.length;
  const options: Completion[] = items.map(item => ({
    label: item.label,
    detail: item.detail,
    filterText: completionFilterText(item, query),
    type: item.detail.toLowerCase().includes("currency") ? "type" : "keyword",
    apply(view, completion, _from, to) {
      const from = completionStart(linePrefix, line.from, item);
      view.dispatch({
        ...insertCompletionText(view.state, item.insertText, from, to),
        annotations: pickedCompletion.of(completion)
      });
    }
  }));

  return { from: query ? queryStart : context.pos, options, filter: Boolean(query) };
}

function automatorTokens(line: string) {
  // Keep completion suppression consistent with the shared highlighter without
  // coupling the source to CodeMirror's rendered token classes.
  return tokenizeLine(line);
}

function lintDiagnostics(source: string, document: EditorState["doc"]): Diagnostic[] {
  return validate(source).map((diagnostic: AutomatorDiagnostic) => {
    const line = document.line(Math.min(diagnostic.line + 1, document.lines));
    const range = diagnosticRange(line, diagnostic);
    return {
      ...range,
      severity: diagnostic.severity === "warning" || diagnostic.severity === "info" || diagnostic.severity === "hint"
        ? diagnostic.severity
        : "error",
      message: diagnostic.message,
      source: "Automator syntax"
    };
  });
}

function renderDiagnostics(view: EditorView, diagnostics: Diagnostic[]): void {
  const count = document.querySelector<HTMLElement>("#issue-count");
  const list = document.querySelector<HTMLElement>("#diagnostics-list");
  if (!count || !list) return;
  count.textContent = String(diagnostics.length);
  count.setAttribute("aria-label", `${diagnostics.length} syntax ${diagnostics.length === 1 ? "issue" : "issues"}`);
  count.classList.toggle("has-issues", diagnostics.length > 0);
  list.replaceChildren();
  if (!diagnostics.length) {
    const empty = document.createElement("p");
    empty.className = "diagnostics-empty";
    empty.textContent = "No issues found by the implemented syntax checks.";
    list.append(empty);
    return;
  }

  for (const diagnostic of diagnostics) {
    const line = view.state.doc.lineAt(diagnostic.from);
    const item = document.createElement("button");
    item.type = "button";
    item.className = `diagnostic-item diagnostic-${diagnostic.severity}`;
    item.innerHTML = `<span class="diagnostic-location">Line ${line.number}, column ${diagnostic.from - line.from + 1}</span><span class="diagnostic-message"></span>`;
    item.querySelector<HTMLElement>(".diagnostic-message")!.textContent = diagnostic.message;
    item.addEventListener("click", () => {
      view.dispatch({
        selection: { anchor: diagnostic.from, head: Math.max(diagnostic.from, diagnostic.to) },
        scrollIntoView: true
      });
      view.focus();
    });
    list.append(item);
  }
}

function setFeedback(message: string, state: "success" | "error" | "info" = "info"): void {
  const feedback = document.querySelector<HTMLElement>("#action-feedback");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.dataset.state = state;
}

function updateCharacterCount(source: string): void {
  const counter = document.querySelector<HTMLElement>("#character-count");
  if (!counter) return;
  const count = scriptCharacterCount(source);
  const overLimit = count > MAX_SCRIPT_CHARACTERS;
  const formattedCount = count.toLocaleString("en-US");
  const formattedLimit = MAX_SCRIPT_CHARACTERS.toLocaleString("en-US");
  counter.textContent = `${formattedCount} / ${formattedLimit} chars`;
  counter.dataset.state = overLimit ? "error" : "normal";
  counter.setAttribute("aria-label", `${formattedCount} of ${formattedLimit} characters${overLimit ? ", over the game limit" : ""}`);
  counter.title = `Game-style character count: blank lines are excluded and line endings are normalized. Limit: ${formattedLimit} characters.`;
}

function setDraftStatus(message: string, state: "saved" | "saving" | "error" | "ready"): void {
  const status = document.querySelector<HTMLElement>("#draft-status");
  if (!status) return;
  status.textContent = `Draft: ${message}`;
  status.dataset.state = state === "error" ? "error" : state;
}

export interface AutomatorEditor {
  view: EditorView;
  destroy(): void;
}

export function createAutomatorEditor(parent: HTMLElement): AutomatorEditor {
  const buttonListeners = new AbortController();
  const draftRead = readDraft();
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let draftDirty = false;
  let scheduleDraftSave = () => {};
  let exportFilename = "automator-script.aut";

  if (draftRead.error) {
    setDraftStatus("storage unavailable", "error");
    setFeedback(draftRead.error, "error");
  } else if (draftRead.draft) {
    setDraftStatus("saved draft loaded", "saved");
  } else {
    setDraftStatus("autosave ready", "ready");
  }

  const diagnosticsButton = document.querySelector<HTMLButtonElement>("#diagnostics-button");
  const diagnosticsPanel = document.querySelector<HTMLElement>("#diagnostics-panel");
  diagnosticsButton?.addEventListener("click", () => {
    const open = diagnosticsButton.getAttribute("aria-expanded") !== "true";
    diagnosticsButton.setAttribute("aria-expanded", String(open));
    if (diagnosticsPanel) diagnosticsPanel.hidden = !open;
  }, { signal: buttonListeners.signal });

  const wrapToggle = document.querySelector<HTMLInputElement>("#wrap-lines-toggle");
  const appShell = parent.closest<HTMLElement>(".app-shell");
  const wrapping = new Compartment();
  const wrapPreferenceKey = "adme.automator-web-editor.wrap-lines.v1";
  let wrapLines = false;
  try { wrapLines = window.localStorage.getItem(wrapPreferenceKey) === "true"; } catch { /* Optional preference. */ }
  if (wrapToggle) wrapToggle.checked = wrapLines;
  appShell?.classList.toggle("wrap-lines", wrapLines);
  const fontSizeSelect = document.querySelector<HTMLSelectElement>("#editor-font-size");
  const fontSizePreferenceKey = "adme.automator-web-editor.font-size.v1";
  const allowedFontSizes = new Set(["13px", "15px", "18px"]);
  let fontSize = "15px";
  try {
    const savedSize = window.localStorage.getItem(fontSizePreferenceKey);
    if (savedSize && allowedFontSizes.has(savedSize)) fontSize = savedSize;
  } catch { /* Optional preference. */ }
  if (fontSizeSelect) fontSizeSelect.value = fontSize;
  appShell?.style.setProperty("--editor-font-size", fontSize);
  fontSizeSelect?.addEventListener("change", () => {
    fontSize = fontSizeSelect.value;
    if (!allowedFontSizes.has(fontSize)) return;
    appShell?.style.setProperty("--editor-font-size", fontSize);
    try { window.localStorage.setItem(fontSizePreferenceKey, fontSize); } catch { /* Keep this session's setting. */ }
  }, { signal: buttonListeners.signal });

  const view = new EditorView({
    state: EditorState.create({
      doc: draftRead.draft?.text ?? "",
      extensions: [
        lineNumbers({
          domEventHandlers: {
            click(view, block) {
              const line = view.state.doc.lineAt(block.from);
              view.dispatch({ selection: { anchor: line.from, head: line.to } });
              view.focus();
              return true;
            }
          }
        }),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        indentUnit.of("  "),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        automatorLanguage,
        autocompletion({ override: [automatorCompletionSource], defaultKeymap: false }),
        lintGutter(),
        linter(view => lintDiagnostics(view.state.doc.toString(), view.state.doc), { delay: 300 }),
        syntaxHighlighting(automatorHighlighting),
        highlightActiveLine(),
        keymap.of([
          ...completionKeymap,
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab
        ]),
        editorTheme,
        wrapping.of(wrapLines ? EditorView.lineWrapping : []),
        EditorView.contentAttributes.of({ "aria-label": "Automator script editor" }),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            updateCharacterCount(update.state.doc.toString());
            renderDiagnostics(update.view, lintDiagnostics(update.state.doc.toString(), update.state.doc));
            scheduleDraftSave();
          }
        })
      ]
    }),
    parent
  });
  wrapToggle?.addEventListener("change", () => {
    wrapLines = wrapToggle.checked;
    appShell?.classList.toggle("wrap-lines", wrapLines);
    view.dispatch({ effects: wrapping.reconfigure(wrapLines ? EditorView.lineWrapping : []) });
    try { window.localStorage.setItem(wrapPreferenceKey, String(wrapLines)); } catch { /* Keep this session's setting. */ }
  }, { signal: buttonListeners.signal });

  const initialShellHeight = appShell?.style.height ?? "";
  const visualViewport = window.visualViewport;
  let viewportFrame = 0;
  const syncVisibleViewport = () => {
    if (!appShell || !visualViewport) return;
    cancelAnimationFrame(viewportFrame);
    viewportFrame = requestAnimationFrame(() => {
      appShell.style.height = `${visualViewport.height}px`;
      if (view.hasFocus) {
        view.dispatch({
          effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: "nearest" })
        });
      }
    });
  };
  visualViewport?.addEventListener("resize", syncVisibleViewport, { signal: buttonListeners.signal });
  window.addEventListener("resize", syncVisibleViewport, { signal: buttonListeners.signal });
  syncVisibleViewport();

  const undoButton = document.querySelector<HTMLButtonElement>("#undo-button");
  const redoButton = document.querySelector<HTMLButtonElement>("#redo-button");
  undoButton?.addEventListener("click", () => undo(view), { signal: buttonListeners.signal });
  redoButton?.addEventListener("click", () => redo(view), { signal: buttonListeners.signal });

  const actionMenu = document.querySelector<HTMLDetailsElement>("#action-menu");
  document.addEventListener("pointerdown", event => {
    if (actionMenu?.open && !actionMenu.contains(event.target as Node)) actionMenu.open = false;
  }, { signal: buttonListeners.signal });
  actionMenu?.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      actionMenu.open = false;
      actionMenu.querySelector<HTMLElement>("summary")?.focus();
    }
  }, { signal: buttonListeners.signal });
  const selectLineButton = document.querySelector<HTMLButtonElement>("#select-line-button");
  selectLineButton?.addEventListener("click", () => {
    const line = view.state.doc.lineAt(view.state.selection.main.head);
    view.dispatch({ selection: { anchor: line.from, head: line.to } });
    view.focus();
    closeActionMenu();
  }, { signal: buttonListeners.signal });
  const newScriptButton = document.querySelector<HTMLButtonElement>("#new-script-button");
  const importButton = document.querySelector<HTMLButtonElement>("#import-script-button");
  const exportButton = document.querySelector<HTMLButtonElement>("#export-script-button");
  const pasteButton = document.querySelector<HTMLButtonElement>("#paste-button");
  const copyButton = document.querySelector<HTMLButtonElement>("#copy-button");
  const formatButton = document.querySelector<HTMLButtonElement>("#format-button");
  const importInput = document.querySelector<HTMLInputElement>("#import-file");

  const closeActionMenu = () => { if (actionMenu) actionMenu.open = false; };
  const replaceDocument = (text: string) => {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      selection: { anchor: text.length },
      scrollIntoView: true
    });
    view.focus();
  };
  const persistDraft = () => {
    if (!draftDirty) return;
    if (saveTimer !== undefined) clearTimeout(saveTimer);
    saveTimer = undefined;
    const result = writeDraft(view.state.doc.toString());
    if (result.saved) {
      draftDirty = false;
      setDraftStatus("saved", "saved");
    }
    else {
      setDraftStatus("save failed", "error");
      setFeedback(result.error, "error");
    }
  };
  scheduleDraftSave = () => {
    draftDirty = true;
    if (saveTimer !== undefined) clearTimeout(saveTimer);
    setDraftStatus("saving…", "saving");
    saveTimer = setTimeout(persistDraft, 450);
  };
  window.addEventListener("pagehide", persistDraft, { signal: buttonListeners.signal });
  newScriptButton?.addEventListener("click", () => {
    closeActionMenu();
    if (view.state.doc.length > 0 &&
      !window.confirm("Replace the current script with a new empty script? This also replaces any saved browser draft.")) return;
    exportFilename = "automator-script.aut";
    draftDirty = true;
    replaceDocument("");
    persistDraft();
    setFeedback("Started a new script.", "success");
  }, { signal: buttonListeners.signal });

  importButton?.addEventListener("click", () => {
    closeActionMenu();
    importInput?.click();
  }, { signal: buttonListeners.signal });
  importInput?.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    importInput.value = "";
    closeActionMenu();
    if (!file) return;
    try {
      const text = await file.text();
      if (view.state.doc.length > 0 &&
        !window.confirm(`Replace the current script with '${file.name}'? This also replaces any saved browser draft.`)) return;
      exportFilename = file.name || "automator-script.aut";
      draftDirty = true;
      replaceDocument(text);
      persistDraft();
      setFeedback(`Imported ${file.name}.`, "success");
    } catch (error) {
      setFeedback(`Could not read that file: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }, { signal: buttonListeners.signal });

  exportButton?.addEventListener("click", () => {
    closeActionMenu();
    const blob = new Blob([view.state.doc.toString()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const download = document.createElement("a");
    download.href = url;
    download.download = exportFilename;
    document.body.append(download);
    download.click();
    download.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback(`Downloaded ${exportFilename}.`, "success");
  }, { signal: buttonListeners.signal });

  copyButton?.addEventListener("click", async () => {
    closeActionMenu();
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable in this browser context.");
      await navigator.clipboard.writeText(view.state.doc.toString());
      setFeedback("Copied the full script to the clipboard.", "success");
    } catch (error) {
      setFeedback(`Could not copy the script: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }, { signal: buttonListeners.signal });

  pasteButton?.addEventListener("click", async () => {
    closeActionMenu();
    try {
      if (!navigator.clipboard?.readText) throw new Error("Clipboard access is unavailable in this browser context.");
      const text = await navigator.clipboard.readText();
      const selection = view.state.selection.main;
      view.dispatch({
        changes: { from: selection.from, to: selection.to, insert: text },
        selection: { anchor: selection.from + text.length },
        scrollIntoView: true
      });
      view.focus();
      setFeedback("Pasted clipboard text at the current selection.", "success");
    } catch (error) {
      setFeedback(`Could not read the clipboard: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }, { signal: buttonListeners.signal });

  formatButton?.addEventListener("click", () => {
    closeActionMenu();
    try {
      const formatted = formatScript(view.state.doc.toString());
      if (formatted === view.state.doc.toString()) {
        setFeedback("The script is already formatted.", "info");
        return;
      }
      replaceDocument(formatted);
      setFeedback("Formatted block indentation. Use Undo to restore the previous text.", "success");
    } catch (error) {
      if (error instanceof FormattingError) setFeedback(error.message, "error");
      else setFeedback(`Could not format the script: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }, { signal: buttonListeners.signal });

  updateCharacterCount(view.state.doc.toString());
  renderDiagnostics(view, lintDiagnostics(view.state.doc.toString(), view.state.doc));
  return {
    view,
    destroy() {
      persistDraft();
      buttonListeners.abort();
      cancelAnimationFrame(viewportFrame);
      if (appShell) appShell.style.height = initialShellHeight;
      view.destroy();
    }
  };
}
