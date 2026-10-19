import type { RenderCommands } from '../renderCommands';
import { FixedAxis, ScrollProjection } from './fixedAxis';
import { canvasPainter, domPainter } from './painters';
import type { Painter } from './painters';
import { createScene } from './scene';
import type { CellAddress, CellRect, EngineSource, Scene } from './scene';

export interface EngineOptions {
  rows: number;
  columns: number;
  rowHeight?: number;
  columnWidth?: number;
  painter?: 'canvas' | 'dom';
}

/** Private, fixed-size plain-cell slice. Not a Core backend or a legacy TD-query implementation. */
export class GridEngine implements RenderCommands {
  readonly element: HTMLDivElement;
  readonly rows: FixedAxis;
  readonly columns: FixedAxis;
  readonly metrics = { paints: 0, cells: 0 };
  private readonly surface: HTMLDivElement;
  private readonly spacer: HTMLDivElement;
  private readonly selection: HTMLDivElement;
  private readonly painter: Painter;
  private readonly observer: ResizeObserver;
  private readonly listeners: AbortController;
  private readonly window: Window;
  private scene: Scene | null = null;
  private x = new ScrollProjection(0, 0);
  private y = new ScrollProjection(0, 0);
  private left = 0;
  private top = 0;
  private anchor = { physicalLeft: 0, physicalTop: 0, left: 0, top: 0 };
  private width = 0;
  private height = 0;
  private frame = 0;
  private dirty = true;
  private destroyed = false;
  private editor: { element: HTMLTextAreaElement; address: CellAddress; composing: boolean } | null = null;

  constructor(host: HTMLElement, private readonly source: EngineSource, options: EngineOptions) {
    const document = host.ownerDocument;
    const window = document.defaultView;
    if (!window) throw new Error('Engine requires a mounted browser document');
    this.window = window;
    this.rows = new FixedAxis(options.rows, options.rowHeight ?? 28);
    this.columns = new FixedAxis(options.columns, options.columnWidth ?? 130);
    this.element = document.createElement('div');
    this.element.className = 'engine-viewport'; this.element.tabIndex = 0;
    this.element.setAttribute('aria-label', 'Experimental grid; accessibility incomplete');
    this.element.style.cssText = 'position:relative;overflow:auto;width:100%;height:100%;outline:none;overscroll-behavior:contain;';
    this.spacer = document.createElement('div');
    this.spacer.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
    this.surface = document.createElement('div');
    this.surface.style.cssText = 'position:sticky;left:0;top:0;overflow:hidden;';
    this.painter = options.painter === 'dom' ? domPainter(document) : canvasPainter(document);
    this.painter.element.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;';
    this.selection = document.createElement('div');
    this.selection.className = 'engine-selection';
    this.selection.style.cssText = 'position:absolute;border:2px solid #2563eb;box-sizing:border-box;pointer-events:none;';
    this.surface.append(this.painter.element, this.selection);
    this.element.append(this.spacer, this.surface); host.append(this.element);
    this.listeners = new AbortController();
    const signal = this.listeners.signal;
    this.element.addEventListener('scroll', () => this.schedule(), { signal });
    this.element.addEventListener('wheel', event => {
      if (event.ctrlKey) return;
      const unit = event.deltaMode === 1 ? this.rows.size : event.deltaMode === 2 ? Math.max(0, this.height - 30) : 1;
      const dx = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
      const dy = event.shiftKey ? 0 : event.deltaY;
      this.scroll(this.left + dx * unit, this.top + dy * unit);
      event.preventDefault();
    }, { signal, passive: false });
    this.surface.addEventListener('pointerdown', event => {
      if (this.editor?.element === event.target || event.button !== 0) return;
      if (this.editor?.composing) return;
      const bounds = this.surface.getBoundingClientRect();
      const address = this.hitTest(event.clientX - bounds.left, event.clientY - bounds.top);
      if (!address) return;
      event.preventDefault(); this.finishEdit(true);
      this.source.select(address); this.element.focus({ preventScroll: true }); this.updateSelection();
    }, { signal });
    this.surface.addEventListener('dblclick', event => {
      const bounds = this.surface.getBoundingClientRect();
      if (this.hitTest(event.clientX - bounds.left, event.clientY - bounds.top)) this.beginEdit();
    }, { signal });
    this.element.addEventListener('keydown', event => this.keydown(event), { signal });
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(this.element);
    this.resize();
  }

  /** Explicit data invalidation; selection-only draws do not reread or repaint cell contents. */
  invalidate(): void { if (!this.destroyed) { this.dirty = true; this.draw(false); } }

  private schedule(): void {
    if (!this.frame && !this.destroyed) this.frame = this.window.requestAnimationFrame(() => {
      this.frame = 0; this.draw(false);
    });
  }

  private resize(): void {
    if (this.destroyed) return;
    const width = this.element.clientWidth;
    const height = this.element.clientHeight;
    if (width === this.width && height === this.height && this.scene) return;
    this.width = width; this.height = height;
    this.x = new ScrollProjection(this.columns.extent, Math.max(0, width - 64));
    this.y = new ScrollProjection(this.rows.extent, Math.max(0, height - 30));
    this.spacer.style.width = `${64 + this.x.physicalExtent}px`;
    this.spacer.style.height = `${30 + this.y.physicalExtent}px`;
    this.surface.style.width = `${width}px`; this.surface.style.height = `${height}px`;
    this.dirty = true; this.scroll(this.left, this.top);
  }

  draw(_fastDraw: boolean): void {
    if (this.destroyed) return;
    // Browsers round native offsets differently. Preserve an exact logical reveal until native input moves it.
    const physicalLeft = this.element.scrollLeft; const physicalTop = this.element.scrollTop;
    const left = physicalLeft === this.anchor.physicalLeft ? this.anchor.left : this.x.toLogical(physicalLeft);
    const top = physicalTop === this.anchor.physicalTop ? this.anchor.top : this.y.toLogical(physicalTop);
    if (this.dirty || left !== this.left || top !== this.top || !this.scene) {
      this.left = left; this.top = top;
      this.scene = createScene(this.rows, this.columns, this.source, this.width, this.height, left, top);
      this.painter.paint(this.scene); this.metrics.paints++; this.metrics.cells = this.scene.cells.length;
      this.dirty = false;
    }
    this.updateSelection(); this.positionEditor();
  }

  getScene(): Scene | null { return this.scene; }
  getScroll(): { left: number; top: number; maxLeft: number; maxTop: number } {
    return { left: this.left, top: this.top, maxLeft: this.x.logicalMax, maxTop: this.y.logicalMax };
  }

  getCellRect(address: CellAddress): CellRect | null {
    if (!this.valid(address)) return null;
    return { x: 64 + address.col * this.columns.size - this.left,
      y: 30 + address.row * this.rows.size - this.top, width: this.columns.size, height: this.rows.size };
  }

  hitTest(x: number, y: number): CellAddress | null {
    if (x < 64 || y < 30 || x >= this.width || y >= this.height) return null;
    const row = this.rows.indexAt(y - 30 + this.top);
    const col = this.columns.indexAt(x - 64 + this.left);
    return row === null || col === null ? null : { row, col };
  }

  private valid(address: CellAddress): boolean {
    return Number.isInteger(address.row) && Number.isInteger(address.col) && address.row >= 0 &&
      address.row < this.rows.count && address.col >= 0 && address.col < this.columns.count;
  }

  scroll(left: number, top: number): void {
    if (this.destroyed || !Number.isFinite(left) || !Number.isFinite(top)) return;
    this.element.scrollLeft = this.x.toPhysical(left); this.element.scrollTop = this.y.toPhysical(top);
    this.anchor = { physicalLeft: this.element.scrollLeft, physicalTop: this.element.scrollTop,
      left: Math.max(0, Math.min(this.x.logicalMax, left)), top: Math.max(0, Math.min(this.y.logicalMax, top)) };
    this.draw(false);
  }

  private target(index: number, size: number, offset: number, viewport: number, start?: boolean, end?: boolean): number {
    if (start) return index * size;
    if (end) return (index + 1) * size - viewport;
    if (index * size < offset) return index * size;
    if ((index + 1) * size > offset + viewport) return (index + 1) * size - viewport;
    return offset;
  }

  scrollViewport(address: CellAddress, snapToTop?: boolean, snapToRight?: boolean,
    snapToBottom?: boolean, snapToLeft?: boolean): boolean {
    if (this.destroyed || !this.valid(address)) return false;
    const oldLeft = this.left; const oldTop = this.top;
    this.scroll(this.target(address.col, this.columns.size, this.left, this.width - 64, snapToLeft, snapToRight),
      this.target(address.row, this.rows.size, this.top, this.height - 30, snapToTop, snapToBottom));
    return oldLeft !== this.left || oldTop !== this.top;
  }

  scrollViewportHorizontally(column: number, snapToRight?: boolean, snapToLeft?: boolean): boolean {
    if (this.destroyed || !Number.isInteger(column) || column < 0 || column >= this.columns.count) return false;
    const before = this.left;
    this.scroll(this.target(column, this.columns.size, this.left, this.width - 64, snapToLeft, snapToRight), this.top);
    return before !== this.left;
  }

  scrollViewportVertically(row: number, snapToTop?: boolean, snapToBottom?: boolean): boolean {
    if (this.destroyed || !Number.isInteger(row) || row < 0 || row >= this.rows.count) return false;
    const before = this.top;
    this.scroll(this.left, this.target(row, this.rows.size, this.top, this.height - 30, snapToTop, snapToBottom));
    return before !== this.top;
  }

  private updateSelection(): void {
    const address = this.source.getSelection();
    const rect = address && this.getCellRect(address);
    const visible = rect && rect.x + rect.width > 64 && rect.y + rect.height > 30 &&
      rect.x < this.width && rect.y < this.height;
    this.selection.style.display = visible ? 'block' : 'none';
    if (rect && visible) {
      // Clip the overlay at headers; partially visible cells must not cover them.
      this.selection.style.left = `${Math.max(64, rect.x)}px`; this.selection.style.top = `${Math.max(30, rect.y)}px`;
      this.selection.style.width = `${Math.min(this.width, rect.x + rect.width) - Math.max(64, rect.x)}px`;
      this.selection.style.height = `${Math.min(this.height, rect.y + rect.height) - Math.max(30, rect.y)}px`;
    }
  }

  beginEdit(initial?: string): void {
    if (this.destroyed || this.editor) return;
    const address = this.source.getSelection();
    if (!address || !this.valid(address)) return;
    this.scrollViewport(address);
    const element = this.element.ownerDocument.createElement('textarea');
    element.className = 'engine-editor'; element.setAttribute('aria-label', 'Cell editor');
    element.style.cssText = 'position:absolute;box-sizing:border-box;resize:none;margin:0;border:2px solid #2563eb;' +
      'font:13px sans-serif;padding:4px;background:white;color:#18202d;';
    element.value = initial ?? this.source.readCell(address);
    this.editor = { element, address: { ...address }, composing: false };
    element.addEventListener('compositionstart', () => { if (this.editor) this.editor.composing = true; });
    element.addEventListener('compositionend', () => {
      if (this.editor) { this.editor.composing = false; this.positionEditor(); }
    });
    this.surface.append(element); this.positionEditor(); element.focus();
    if (initial === undefined) element.select();
  }

  private positionEditor(): void {
    if (!this.editor) return;
    const rect = this.getCellRect(this.editor.address);
    if (!rect) return;
    if (rect.x < 64 || rect.y < 30 || rect.x + rect.width > this.width || rect.y + rect.height > this.height) {
      // A composing editor stays pinned until composition ends, then commits if still outside the viewport.
      if (!this.editor.composing) this.finishEdit(true);
      return;
    }
    Object.assign(this.editor.element.style, { left: `${rect.x}px`, top: `${rect.y}px`,
      width: `${rect.width}px`, height: `${rect.height}px` });
  }

  finishEdit(commit: boolean): void {
    const editor = this.editor;
    if (!editor || editor.composing) return;
    this.editor = null;
    if (commit) this.source.writeCell(editor.address, editor.element.value);
    const focused = this.element.ownerDocument.activeElement === editor.element;
    editor.element.remove();
    if (focused) this.element.focus({ preventScroll: true });
    if (commit) this.invalidate();
  }

  private keydown(event: KeyboardEvent): void {
    if (event.isComposing || this.editor?.composing || event.keyCode === 229) return;
    if (this.editor) {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault(); this.finishEdit(event.key !== 'Escape');
      }
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const address = this.source.getSelection();
    if (!address || !this.valid(address)) return;
    const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0],
      ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const move = delta[event.key];
    if (move) {
      event.preventDefault();
      const next = { row: Math.max(0, Math.min(this.rows.count - 1, address.row + move[0])),
        col: Math.max(0, Math.min(this.columns.count - 1, address.col + move[1])) };
      this.source.select(next); this.scrollViewport(next); this.updateSelection();
    } else if (event.key === 'F2' || event.key === 'Enter' || event.key.length === 1) {
      event.preventDefault(); this.beginEdit(event.key.length === 1 ? event.key : undefined);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true; this.listeners.abort(); this.observer.disconnect();
    if (this.frame) this.window.cancelAnimationFrame(this.frame);
    this.editor?.element.remove(); this.editor = null; this.scene = null; this.painter.destroy(); this.element.remove();
  }
}
