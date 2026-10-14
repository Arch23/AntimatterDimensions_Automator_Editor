import "./styles.css";
import { createAutomatorEditor } from "./editor";

const root = document.querySelector<HTMLDivElement>("#app");
if (!root) throw new Error("Application root was not found.");

root.innerHTML = `
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">AD</div>
        <div class="brand-copy">
          <h1>Automator</h1>
          <p>Antimatter Dimensions script editor</p>
        </div>
      </div>
      <div class="toolbar" aria-label="Editor actions">
        <button id="undo-button" class="tool-button" type="button" aria-label="Undo" title="Undo (Ctrl+Z)">
          <span class="tool-icon" aria-hidden="true">↶</span><span class="tool-label">Undo</span>
        </button>
        <button id="redo-button" class="tool-button" type="button" aria-label="Redo" title="Redo (Ctrl+Y)">
          <span class="tool-icon" aria-hidden="true">↷</span><span class="tool-label">Redo</span>
        </button>
        <button id="diagnostics-button" class="tool-button" type="button" aria-expanded="false" aria-controls="diagnostics-panel">
          <span class="tool-icon issue-icon" aria-hidden="true">●</span><span class="tool-label">Issues</span>
          <span id="issue-count" class="issue-count">0</span>
        </button>
        <details id="action-menu" class="action-menu">
          <summary class="tool-button action-menu-toggle"><span class="tool-label">Actions</span><span class="tool-icon" aria-hidden="true">⋯</span></summary>
          <div class="action-menu-popover" role="group" aria-label="Document actions">
            <button id="select-line-button" class="action-menu-item" type="button">Select current line</button>
            <label class="action-menu-item action-menu-toggle-setting"><input id="wrap-lines-toggle" type="checkbox"> Wrap long lines</label>
            <label class="action-menu-item action-menu-select-setting" for="editor-font-size">Editor text size
              <select id="editor-font-size" aria-label="Editor text size">
                <option value="13px">Small</option>
                <option value="15px">Medium</option>
                <option value="18px">Large</option>
              </select>
            </label>
            <button id="new-script-button" class="action-menu-item" type="button">New script</button>
            <button id="import-script-button" class="action-menu-item" type="button">Import text file…</button>
            <button id="export-script-button" class="action-menu-item" type="button">Download script</button>
            <button id="paste-button" class="action-menu-item" type="button">Paste from clipboard</button>
            <button id="copy-button" class="action-menu-item" type="button">Copy all</button>
            <button id="format-button" class="action-menu-item" type="button">Format script</button>
          </div>
        </details>
        <input id="import-file" type="file" accept=".aut,.automator,.txt,text/plain" hidden>
      </div>
    </header>
    <main class="workspace">
      <section class="editor-panel" aria-label="Script editor">
        <div id="editor"></div>
      </section>
      <section id="diagnostics-panel" class="diagnostics-panel" aria-label="Syntax diagnostics" hidden>
        <div class="diagnostics-heading">
          <h2>Syntax checks</h2>
          <p>These diagnostics cover implemented syntax checks only; the game remains the authority on script validity.</p>
        </div>
        <div id="diagnostics-list" class="diagnostics-list" aria-live="polite"></div>
      </section>
    </main>
    <footer class="statusbar">
      <span>Automator</span><span>Spaces: 2</span><span id="character-count" data-state="normal" aria-label="Loading character count">0 / 10,000 chars</span><span id="draft-status">Draft: waiting for edits</span>
      <span id="action-feedback" class="action-feedback" role="status" aria-live="polite">Long lines scroll horizontally · Ctrl-Space for suggestions</span>
    </footer>
  </div>
`;

const mount = root.querySelector<HTMLElement>("#editor");
if (!mount) throw new Error("Editor mount point was not found.");
createAutomatorEditor(mount);
