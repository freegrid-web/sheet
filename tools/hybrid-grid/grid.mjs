import { Model, Geometry, axis, HEADER_X, HEADER_Y, layout } from './model.mjs';
import { CanvasRenderer, DOMRenderer } from './renderers.mjs';
import { CellComponents } from './components.mjs';

const position = (element, rect) => Object.assign(element.style, {
  left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px`,
});
const clamp = (value, count) => Math.max(0, Math.min(count - 1, value));
export class Grid {
  constructor(host, config) {
    this.host = host;
    this.config = config;
    this.model = new Model(config.rows, config.columns);
    this.rows = new Geometry(config.rows, 28, config.varied);
    this.columns = new Geometry(config.columns, 130, config.varied);
    this.focus = { row: 0, column: 0 };
    this.metrics = { draws: [], cells: 0, paints: 0 };
    this.hosts = new Map();
    this.abort = new AbortController();
    host.innerHTML = `<div class="port" tabindex="0" role="grid" aria-label="Hybrid renderer experiment">
      <div class="spacer"></div><div class="scene"><div class="drawing"></div><div class="hosts"></div>
      <div class="headers"></div><div class="selection"></div></div></div><div class="vue-root"></div>
      <div class="sr-only" role="status" aria-live="polite"></div>`;
    const find = selector => host.querySelector(selector);
    this.port = find('.port'); this.scene = find('.scene'); this.spacer = find('.spacer');
    this.hostLayer = find('.hosts'); this.headers = find('.headers'); this.selection = find('.selection');
    this.status = find('[role=status]');
    this.port.setAttribute('aria-rowcount', config.rows);
    this.port.setAttribute('aria-colcount', config.columns);
    this.renderer = config.renderer === 'canvas' ? new CanvasRenderer(find('.drawing')) : new DOMRenderer(find('.drawing'));
    this.components = new CellComponents(find('.vue-root'), this.model);
    this.panes = [];
    this.hostPanes = Array.from({ length: 4 }, () => {
      const element = document.createElement('div'); element.className = 'pane'; this.hostLayer.append(element); return element;
    });
    const listen = (element, event, callback, options = {}) =>
      element.addEventListener(event, callback, { ...options, signal: this.abort.signal });
    listen(this.port, 'scroll', () => this.invalidate());
    listen(this.port, 'wheel', event => {
      if (event.ctrlKey) return;
      const unit = event.deltaMode === 1 ? 28 : event.deltaMode === 2 ? this.height : 1;
      const dx = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
      const dy = event.shiftKey ? 0 : event.deltaY;
      this.scroll(this.left + dx * unit, this.top + dy * unit);
      event.preventDefault();
    }, { passive: false });
    listen(this.port, 'pointerdown', event => {
      if (event.target === this.editor) return;
      const cell = this.hit(event);
      if (cell) { this.finishEdit(true); this.focus = { row: cell.row, column: cell.column }; this.updateSelection(); }
      this.port.focus({ preventScroll: true });
    });
    listen(this.port, 'dblclick', event => { if (this.hit(event)) this.startEdit(); });
    listen(this.port, 'keydown', event => {
      if (event.target === this.editor || event.isComposing || event.keyCode === 229) return;
      const move = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1] }[event.key];
      if (move) {
        event.preventDefault(); this.focus.row = clamp(this.focus.row + move[0], config.rows);
        this.focus.column = clamp(this.focus.column + move[1], config.columns); this.reveal(); this.updateSelection();
      } else if (event.key === 'Enter' || event.key === 'F2') { event.preventDefault(); this.startEdit(); }
    });
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(this.port);
    this.ready = new Promise(resolve => { this.firstDraw = resolve; });
    this.resize();
  }
  get left() { return this.port.scrollLeft * this.xAxis.scale; }
  get top() { return this.port.scrollTop * this.yAxis.scale; }
  resize() {
    const left = this.xAxis ? this.left : 0;
    const top = this.yAxis ? this.top : 0;
    this.width = this.port.clientWidth; this.height = this.port.clientHeight;
    this.xAxis = axis(this.columns, HEADER_X, this.width); this.yAxis = axis(this.rows, HEADER_Y, this.height);
    Object.assign(this.spacer.style, { width: `${this.xAxis.extent}px`, height: `${this.yAxis.extent}px` });
    Object.assign(this.scene.style, { width: `${this.width}px`, height: `${this.height}px` });
    this.scroll(left, top); this.invalidate();
  }
  scroll(left, top) {
    this.port.scrollLeft = Math.max(0, Math.min(this.xAxis.logicalMax, left)) / this.xAxis.scale;
    this.port.scrollTop = Math.max(0, Math.min(this.yAxis.logicalMax, top)) / this.yAxis.scale;
    this.invalidate();
  }
  invalidate() {
    if (this.destroyed) return;
    this.dirty = true;
    if (!this.frame) this.frame = requestAnimationFrame(() => this.draw());
  }
  async draw() {
    this.frame = 0;
    if (this.destroyed) return;
    if (this.drawing) { this.invalidate(); return; }
    this.drawing = true; this.dirty = false;
    const start = performance.now();
    this.panes = layout(this.model, this.rows, this.columns, this.width, this.height,
      this.left, this.top, this.config.frozenRows, this.config.frozenColumns, this.config.rich);
    this.renderer.draw(this.panes, this.width, this.height);
    const wanted = new Set();
    const entries = [];
    this.panes.forEach((pane, index) => {
      position(this.hostPanes[index], pane);
      for (const cell of pane.cells) {
        if (!cell.rich) continue;
        wanted.add(cell.key);
        let host = this.hosts.get(cell.key);
        if (!host) {
          host = document.createElement('div'); host.className = 'cell-host'; host.dataset.key = cell.key;
          this.hosts.set(cell.key, host);
        }
        if (host.parentElement !== this.hostPanes[index]) this.hostPanes[index].append(host);
        position(host, { x: cell.x - pane.x, y: cell.y - pane.y, w: cell.w, h: cell.h });
        entries.push({ key: cell.key, id: cell.id, host });
      }
    });
    // Let Vue unmount children while their old hosts still exist.
    await this.components.update(entries);
    if (this.destroyed) return;
    for (const [key, host] of this.hosts) {
      if (!wanted.has(key)) { host.remove(); this.hosts.delete(key); }
    }
    this.drawHeaders(); this.updateSelection(); this.positionEditor();
    this.metrics.cells = this.panes.reduce((sum, pane) => sum + pane.cells.length, 0);
    this.metrics.paints++;
    this.metrics.draws.push(performance.now() - start);
    if (this.metrics.draws.length > 240) this.metrics.draws.shift();
    this.drawing = false;
    this.firstDraw?.(); this.firstDraw = null;
    if (this.dirty) this.invalidate();
  }
  drawHeaders() {
    const items = new Map();
    for (const pane of this.panes) for (const cell of pane.cells) {
      if (cell.x >= HEADER_X && !items.has(`c${cell.column}`)) items.set(`c${cell.column}`,
        { x: cell.x, y: 0, w: cell.w, h: HEADER_Y, text: cell.column === 1 ? 'Vue votes' : `Column ${cell.column}` });
      if (cell.y >= HEADER_Y && !items.has(`r${cell.row}`)) items.set(`r${cell.row}`,
        { x: 0, y: cell.y, w: HEADER_X, h: cell.h, text: String(cell.row + 1) });
    }
    // Clip scrolling headers behind frozen headers in the same order as body panes.
    const entries = [...items.values()];
    while (this.headers.childElementCount > entries.length) this.headers.lastElementChild.remove();
    entries.forEach((item, index) => {
      let element = this.headers.children[index];
      if (!element) { element = document.createElement('div'); element.className = 'heading'; this.headers.append(element); }
      position(element, item); element.textContent = item.text;
    });
  }
  cells() { return this.panes.flatMap(pane => pane.cells); }
  cell(row, column) { return this.cells().find(cell => cell.row === row && cell.column === column); }
  hit(event) {
    const rect = this.port.getBoundingClientRect();
    const x = event.clientX - rect.left; const y = event.clientY - rect.top;
    for (const pane of this.panes) {
      if (x < pane.x || y < pane.y || x >= pane.x + pane.w || y >= pane.y + pane.h) continue;
      return pane.cells.find(cell => x >= cell.x && y >= cell.y && x < cell.x + cell.w && y < cell.y + cell.h);
    }
    return null;
  }
  updateSelection() {
    const cell = this.cell(this.focus.row, this.focus.column);
    this.selection.hidden = !cell;
    if (cell) {
      const pane = this.panes.find(pane => pane.cells.includes(cell));
      position(this.selection, { x: Math.max(cell.x, pane.x), y: Math.max(cell.y, pane.y),
        w: Math.max(0, Math.min(cell.x + cell.w, pane.x + pane.w) - Math.max(cell.x, pane.x)),
        h: Math.max(0, Math.min(cell.y + cell.h, pane.y + pane.h) - Math.max(cell.y, pane.y)) });
      this.status.textContent = `Row ${cell.row + 1}, column ${cell.column + 1}, ${cell.text}`;
    }
  }
  reveal() {
    const { row, column } = this.focus;
    let left = this.left; let top = this.top;
    const freezeX = this.columns.prefix[this.config.frozenColumns];
    const freezeY = this.rows.prefix[this.config.frozenRows];
    if (row >= this.config.frozenRows) {
      if (this.rows.prefix[row] < top + freezeY) top = this.rows.prefix[row] - freezeY;
      if (this.rows.prefix[row + 1] > top + this.height - HEADER_Y) top = this.rows.prefix[row + 1] - this.height + HEADER_Y;
    }
    if (column >= this.config.frozenColumns) {
      if (this.columns.prefix[column] < left + freezeX) left = this.columns.prefix[column] - freezeX;
      if (this.columns.prefix[column + 1] > left + this.width - HEADER_X) left = this.columns.prefix[column + 1] - this.width + HEADER_X;
    }
    this.scroll(left, top);
  }
  startEdit() {
    this.finishEdit(true);
    const cell = this.cell(this.focus.row, this.focus.column);
    if (!cell) return;
    this.editing = { id: cell.id, column: cell.column };
    this.editor = document.createElement('textarea'); this.editor.className = 'editor';
    this.editor.setAttribute('aria-label', 'Cell editor'); this.editor.value = cell.text;
    this.scene.append(this.editor); this.positionEditor(); this.editor.focus(); this.editor.select();
    const editor = this.editor;
    editor.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === 'Enter' || event.key === 'Escape' || event.key === 'Tab') {
        event.preventDefault(); this.finishEdit(event.key !== 'Escape'); this.port.focus({ preventScroll: true });
      }
    });
    editor.addEventListener('blur', () => this.finishEdit(true));
  }
  positionEditor() {
    if (!this.editor) return;
    const cell = this.cells().find(cell => cell.id === this.editing.id && cell.column === this.editing.column);
    if (!cell) { this.finishEdit(true); return; }
    const pane = this.panes.find(pane => pane.cells.includes(cell));
    const x = Math.max(pane.x, cell.x); const y = Math.max(pane.y, cell.y);
    position(this.editor, { x, y, w: Math.min(pane.x + pane.w, cell.x + cell.w) - x,
      h: Math.min(pane.y + pane.h, cell.y + cell.h) - y });
  }
  finishEdit(commit) {
    if (!this.editor) return;
    const editor = this.editor; const editing = this.editing; this.editor = null; this.editing = null;
    if (commit) this.model.set(editing.id, editing.column, editor.value);
    editor.remove(); this.invalidate();
  }
  sort() {
    this.finishEdit(true);
    const id = this.model.order[this.focus.row]; this.model.sort();
    this.focus.row = this.model.order.indexOf(id); this.reveal(); this.invalidate();
  }
  snapshot() {
    return { config: this.config, focus: this.focus, left: this.left, top: this.top,
      cells: this.cells(), metrics: this.metrics, components: { ...this.components.counts },
      hosts: this.hosts.size, nodes: this.host.querySelectorAll('*').length, editing: this.editing,
      destroyed: Boolean(this.destroyed) };
  }
  destroy() {
    this.destroyed = true; cancelAnimationFrame(this.frame); this.abort.abort(); this.observer.disconnect();
    this.editor?.remove(); this.editor = null; this.components.destroy(); this.renderer.destroy();
    this.hosts.clear(); this.host.replaceChildren();
  }
}
