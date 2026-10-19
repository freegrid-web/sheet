import {
  addClass,
  empty,
  fastInnerHTML,
  fastInnerText,
  getScrollbarWidth,
  hasClass,
  isChildOf,
  isInput,
  isOutsideInput
} from './helpers/dom/element';
import { applyCellStyle } from './utils/cellStyle';
import type { CellStyle } from './utils/cellStyle';
import EventManager from './eventManager';
import Hooks from './pluginHooks';
import { stopPropagation, isImmediatePropagationStopped, isRightClick, isLeftClick } from './helpers/dom/event';
import Walkontable from './3rdparty/walkontable/src';
import type CellCoords from './3rdparty/walkontable/src/cell/coords';
import { getRowHeight } from './helpers/dom/theme';
import { handleMouseEvent } from './selection/mouseEventHandler';
import type Core from './core';
import type { GridSettings } from './types';
import type { RenderQueries } from './rendering/renderQueries';
import { WalkontableQueries } from './rendering/walkontableQueries';
import type { RenderCommands } from './rendering/renderCommands';
import { WalkontableCommands } from './rendering/walkontableCommands';

type Grid = Core;
type Wt = Walkontable;

/** What a mouse handler may block: selecting the row, the column or the cell. */
type BlockCalculations = { row: boolean; column: boolean; cell: boolean };

/** The rendered rows or columns that Walkontable computed, before the rendering offset is added. */
type ViewportCalc = { startRow: number; endRow: number; startColumn: number; endColumn: number };

/** A row or column header renderer. */
type HeaderRenderer = (index: number, TH: HTMLTableCellElement) => void;

/**
 * Cross-platform helper to clear text selection.
 */
const clearTextSelection = (): void => {
  const selection = window.getSelection();

  // http://stackoverflow.com/questions/3169786/clear-text-selection-with-javascript
  if (selection?.empty) { // Chrome
    selection.empty();
  } else if (selection?.removeAllRanges) { // Firefox
    selection.removeAllRanges();
  }
};

/**
 * The grid's view: builds the table, starts Walkontable with the grid's settings and handles the mouse on and
 * around the table.
 */
class TableView {
  eventManager: EventManager;
  instance: Grid;
  settings: GridSettings;
  selectionMouseDown = false;
  THEAD: HTMLTableSectionElement;
  TBODY: HTMLTableSectionElement;
  wt: Wt;
  activeWt: Wt;
  readonly renderQueries: RenderQueries;
  readonly renderCommands: RenderCommands;
  #isMouseDown = false;

  /**
   * @param {Object} instance Instance of FreeSheet.
   */
  constructor(instance: Grid) {
    this.eventManager = new EventManager(instance);
    this.instance = instance;
    this.settings = instance.getSettings();

    const originalStyle = instance.rootElement.getAttribute('style');

    if (originalStyle) {
      instance.rootElement.setAttribute('data-originalstyle', originalStyle); // needed to retrieve original style in jsFiddle link generator in HT examples. may be removed in future versions
    }

    addClass(instance.rootElement, 'freesheet');

    const table = document.createElement('TABLE') as HTMLTableElement;
    addClass(table, 'fs-core');

    if (instance.getSettings().tableClassName) {
      addClass(table, instance.getSettings().tableClassName);
    }
    this.THEAD = document.createElement('THEAD') as HTMLTableSectionElement;
    table.appendChild(this.THEAD);
    this.TBODY = document.createElement('TBODY') as HTMLTableSectionElement;
    table.appendChild(this.TBODY);

    instance.table = table;

    instance.container.insertBefore(table, instance.container.firstChild);

    this.#registerDocumentEvents(table);

    const walkontableConfig = this.#walkontableConfig(table);

    instance.runHooks('beforeInitWalkontable', walkontableConfig);

    this.wt = new Walkontable(walkontableConfig);
    this.activeWt = this.wt;
    this.renderQueries = new WalkontableQueries(() => this.wt);
    this.renderCommands = new WalkontableCommands(() => this.wt);

    this.#registerSpreaderEvents();
  }

  /**
   * Whether the mouse button went down on a cell and is still down.
   *
   * @returns {Boolean}
   */
  isMouseDown(): boolean {
    return this.#isMouseDown;
  }

  /** Listens on the root element, the table and the document (selection, outside clicks, text selection). */
  #registerDocumentEvents(table: HTMLTableElement): void {
    const { instance } = this;

    this.eventManager.addEventListener(instance.rootElement, 'mousedown', (event: MouseEvent) => {
      this.selectionMouseDown = true;

      if (!this.isTextSelectionAllowed(event.target as Element)) {
        clearTextSelection();
        event.preventDefault();
        window.focus(); // make sure that window that contains HOT is active. Important when HOT is in iframe.
      }
    });
    this.eventManager.addEventListener(instance.rootElement, 'mouseup', () => {
      this.selectionMouseDown = false;
    });
    this.eventManager.addEventListener(instance.rootElement, 'mousemove', (event: MouseEvent) => {
      if (this.selectionMouseDown && !this.isTextSelectionAllowed(event.target as Element)) {
        // Clear selection only when fragmentSelection is enabled, otherwise clearing selection breakes the IME editor.
        if (this.settings.fragmentSelection) {
          clearTextSelection();
        }
        event.preventDefault();
      }
    });

    this.eventManager.addEventListener(document.documentElement, 'keyup', (event: KeyboardEvent) => {
      if (instance.selection.isInProgress() && !event.shiftKey) {
        instance.selection.finish();
      }
    });

    this.eventManager.addEventListener(document.documentElement, 'mouseup', (event: MouseEvent) => {
      if (instance.selection.isInProgress() && isLeftClick(event)) { // is left mouse button
        instance.selection.finish();
      }

      this.#isMouseDown = false;

      if (isOutsideInput(document.activeElement) || (!instance.selection.isSelected() && !isRightClick(event))) {
        instance.unlisten();
      }
    });

    this.eventManager.addEventListener(document.documentElement, 'contextmenu', (event: MouseEvent) => {
      if (instance.selection.isInProgress() && isRightClick(event)) {
        instance.selection.finish();

        this.#isMouseDown = false;
      }
    });

    this.eventManager.addEventListener(document.documentElement, 'touchend', () => {
      if (instance.selection.isInProgress()) {
        instance.selection.finish();
      }

      this.#isMouseDown = false;
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the event carries `isTargetWebComponent` (set by EventManager)
    this.eventManager.addEventListener(document.documentElement, 'mousedown', (event: any) => {
      const originalTarget = event.target;
      const eventX = event.x || event.clientX;
      const eventY = event.y || event.clientY;
      let next = event.target;

      if (this.#isMouseDown || !instance.rootElement) {
        return; // it must have been started in a cell
      }

      // immediate click on "holder" means click on the right side of vertical scrollbar
      if (next === instance.view.wt.wtTable.holder) {
        const scrollbarWidth = getScrollbarWidth();

        if (document.elementFromPoint(eventX + scrollbarWidth, eventY) !== instance.view.wt.wtTable.holder ||
          document.elementFromPoint(eventX, eventY + scrollbarWidth) !== instance.view.wt.wtTable.holder) {
          return;
        }
      } else {
        while (next !== document.documentElement) {
          if (next === null) {
            if (event.isTargetWebComponent) {
              break;
            }
            // click on something that was a row but now is detached (possibly because your click triggered a rerender)
            return;
          }
          if (next === instance.rootElement) {
            // click inside container
            return;
          }
          next = next.parentNode;
        }
      }

      // function did not return until here, we have an outside click!

      const outsideClickDeselects = typeof this.settings.outsideClickDeselects === 'function' ?
        this.settings.outsideClickDeselects(originalTarget) :
        this.settings.outsideClickDeselects;

      if (outsideClickDeselects) {
        instance.deselectCell();
      } else {
        instance.destroyEditor(false, false);
      }
    });

    this.eventManager.addEventListener(table, 'selectstart', (event: Event) => {
      if (this.settings.fragmentSelection || isInput(event.target as Element)) {
        return;
      }
      // https://github.com/handsontable/handsontable/issues/160
      // Prevent text from being selected when performing drag down.
      event.preventDefault();
    });
  }

  /** Listens on Walkontable's spreader and redraws an interrupted render on the next click. */
  #registerSpreaderEvents(): void {
    const { spreader } = this.wt.wtTable;

    // right mouse button exactly on spreader means right click on the right hand side of vertical scrollbar
    const stopRightClickOnSpreader = (event: MouseEvent) => {
      if (event.target === spreader && event.which === 3) {
        stopPropagation(event);
      }
    };

    this.eventManager.addEventListener(spreader, 'mousedown', stopRightClickOnSpreader);
    this.eventManager.addEventListener(spreader, 'contextmenu', stopRightClickOnSpreader);

    this.eventManager.addEventListener(document.documentElement, 'click', () => {
      if (this.settings.observeDOMVisibility) {
        if (this.wt.drawInterrupted) {
          this.instance.forceFullRender = true;
          this.render();
        }
      }
    });
  }

  /** Walkontable's settings: the grid's data, sizes and renderers, and the mouse and scroll callbacks. */
  #walkontableConfig(table: HTMLTableElement) {
    const { instance } = this;

    /**
     * Runs the `beforeOnCell{name}` and `afterOnCell{name}` hooks with `wt` as the active Walkontable (it stays
     * active when a `before…` hook stops the event).
     */
    const mouseHandler = (name: string) => (event: MouseEvent, coords: CellCoords, TD: HTMLTableCellElement) => {
      instance.runHooks(`beforeOnCell${name}`, event, coords, TD);

      if (isImmediatePropagationStopped(event)) {
        return;
      }

      instance.runHooks(`afterOnCell${name}`, event, coords, TD);
      this.activeWt = this.wt;
    };

    return {
      debug: () => this.settings.debug,
      // From the theme (--fs-row-height); refreshed by updateSettings().
      defaultRowHeight: getRowHeight(instance.rootElement),
      externalRowCalculator: instance.getPlugin('autoRowSize') && instance.getPlugin('autoRowSize').isEnabled(),
      table,
      preventOverflow: () => this.settings.preventOverflow,
      stretchH: () => this.settings.stretchH,
      data: instance.getDataAtCell,
      totalRows: () => instance.countRows(),
      totalColumns: () => instance.countCols(),
      fixedColumnsLeft: () => this.settings.fixedColumnsLeft,
      fixedRowsTop: () => this.settings.fixedRowsTop,
      fixedRowsBottom: () => this.settings.fixedRowsBottom,
      minSpareRows: () => this.settings.minSpareRows,
      renderAllRows: this.settings.renderAllRows,
      rowHeaders: () => {
        const headerRenderers: HeaderRenderer[] = [];

        if (instance.hasRowHeaders()) {
          headerRenderers.push((row, TH) => this.appendRowHeader(row, TH));
        }

        instance.runHooks('afterGetRowHeaderRenderers', headerRenderers);

        return headerRenderers;
      },
      columnHeaders: () => {
        const headerRenderers: HeaderRenderer[] = [];

        if (instance.hasColHeaders()) {
          headerRenderers.push((column, TH) => this.appendColHeader(column, TH));
        }

        instance.runHooks('afterGetColumnHeaderRenderers', headerRenderers);

        return headerRenderers;
      },
      columnWidth: instance.getColWidth,
      rowHeight: instance.getRowHeight,
      // Every row has the same height when `rowHeights` is not per row and no `modifyRowHeight` hook can change it.
      rowHeightsUniform: () => {
        const { rowHeights } = instance.getSettings();

        return typeof rowHeights !== 'function' && !Array.isArray(rowHeights) &&
          !instance.hasHook('modifyRowHeight') && !Hooks.getSingleton().has('modifyRowHeight');
      },
      cellRenderer: (row: number, col: number, TD: HTMLTableCellElement) => {
        const cellProperties = instance.getCellMeta(row, col);
        const prop = instance.colToProp(col);
        let value = instance.getDataAtRowProp(row, prop);

        if (instance.hasHook('beforeValueRender')) {
          value = instance.runHooks('beforeValueRender', value, cellProperties);
        }

        instance.runHooks('beforeRenderer', TD, row, col, prop, value, cellProperties);
        instance.getCellRenderer(cellProperties)(instance, TD, row, col, prop, value, cellProperties);
        // The cell's own style (`style` meta), under what afterRenderer hooks (conditional formatting) draw.
        applyCellStyle(TD, cellProperties.style as CellStyle | undefined);
        instance.runHooks('afterRenderer', TD, row, col, prop, value, cellProperties);
      },
      selections: instance.selection.highlight,
      hideBorderOnMouseDownOver: () => this.settings.fragmentSelection,
      onCellMouseDown: (event: MouseEvent, coords: CellCoords, TD: HTMLTableCellElement, wt: Wt) => {
        const blockCalculations: BlockCalculations = {
          row: false,
          column: false,
          cell: false
        };

        instance.listen();

        this.activeWt = wt;
        this.#isMouseDown = true;

        instance.runHooks('beforeOnCellMouseDown', event, coords, TD, blockCalculations);

        if (isImmediatePropagationStopped(event)) {
          return;
        }

        handleMouseEvent(event, {
          coords,
          selection: instance.selection,
          controller: blockCalculations,
        });

        instance.runHooks('afterOnCellMouseDown', event, coords, TD);
        this.activeWt = this.wt;
      },
      onCellContextMenu: (event: MouseEvent, coords: CellCoords, TD: HTMLTableCellElement, wt: Wt) => {
        this.activeWt = wt;
        this.#isMouseDown = false;

        if (instance.selection.isInProgress()) {
          instance.selection.finish();
        }

        mouseHandler('ContextMenu')(event, coords, TD);
      },
      onCellMouseOut: (event: MouseEvent, coords: CellCoords, TD: HTMLTableCellElement, wt: Wt) => {
        this.activeWt = wt;
        mouseHandler('MouseOut')(event, coords, TD);
      },
      onCellMouseOver: (event: MouseEvent, coords: CellCoords, TD: HTMLTableCellElement, wt: Wt) => {
        const blockCalculations: BlockCalculations = {
          row: false,
          column: false,
          cell: false
        };

        this.activeWt = wt;

        instance.runHooks('beforeOnCellMouseOver', event, coords, TD, blockCalculations);

        if (isImmediatePropagationStopped(event)) {
          return;
        }

        if (this.#isMouseDown) {
          handleMouseEvent(event, {
            coords,
            selection: instance.selection,
            controller: blockCalculations,
          });
        }

        instance.runHooks('afterOnCellMouseOver', event, coords, TD);
        this.activeWt = this.wt;
      },
      onCellMouseUp: (event: MouseEvent, coords: CellCoords, TD: HTMLTableCellElement, wt: Wt) => {
        this.activeWt = wt;
        instance.runHooks('beforeOnCellMouseUp', event, coords, TD);

        instance.runHooks('afterOnCellMouseUp', event, coords, TD);
        this.activeWt = this.wt;
      },
      onCellCornerMouseDown(event: MouseEvent) {
        event.preventDefault();
        instance.runHooks('afterOnCellCornerMouseDown', event);
      },
      onCellCornerDblClick(event: MouseEvent) {
        event.preventDefault();
        instance.runHooks('afterOnCellCornerDblClick', event);
      },
      beforeDraw: (force: boolean, skipRender: boolean) => this.beforeRender(force, skipRender),
      onDraw: (force: boolean) => this.onDraw(force),
      onScrollVertically() {
        instance.runHooks('afterScrollVertically');
      },
      onScrollHorizontally() {
        instance.runHooks('afterScrollHorizontally');
      },
      onBeforeRemoveCellClassNames: () => instance.runHooks('beforeRemoveCellClassNames'),
      onAfterDrawSelection: (currentRow: number, currentColumn: number, cornersOfSelection: number[], layerLevel: number) =>
        instance.runHooks('afterDrawSelection', currentRow, currentColumn, cornersOfSelection, layerLevel),
      onBeforeDrawBorders(corners: number[], borderClassName: string) {
        instance.runHooks('beforeDrawBorders', corners, borderClassName);
      },
      onBeforeTouchScroll() {
        instance.runHooks('beforeTouchScroll');
      },
      onAfterMomentumScroll() {
        instance.runHooks('afterMomentumScroll');
      },
      onBeforeStretchingColumnWidth: (stretchedWidth: number, column: number) =>
        instance.runHooks('beforeStretchingColumnWidth', stretchedWidth, column),
      onModifyRowHeaderWidth: (rowHeaderWidth: number) => instance.runHooks('modifyRowHeaderWidth', rowHeaderWidth),
      onModifyGetCellCoords: (row: number, column: number, topmost: boolean) =>
        instance.runHooks('modifyGetCellCoords', row, column, topmost),
      viewportRowCalculatorOverride: (calc: ViewportCalc) => {
        const rows = instance.countRows();
        let viewportOffset = this.settings.viewportRowRenderingOffset;

        if (viewportOffset === 'auto' && this.settings.fixedRowsTop) {
          viewportOffset = 10;
        }
        if (typeof viewportOffset === 'number') {
          calc.startRow = Math.max(calc.startRow - viewportOffset, 0);
          calc.endRow = Math.min(calc.endRow + viewportOffset, rows - 1);
        }
        if (viewportOffset === 'auto') {
          const center = calc.startRow + calc.endRow - calc.startRow;
          const offset = Math.ceil(center / rows * 12);

          calc.startRow = Math.max(calc.startRow - offset, 0);
          calc.endRow = Math.min(calc.endRow + offset, rows - 1);
        }
        instance.runHooks('afterViewportRowCalculatorOverride', calc);
      },
      viewportColumnCalculatorOverride: (calc: ViewportCalc) => {
        const cols = instance.countCols();
        let viewportOffset = this.settings.viewportColumnRenderingOffset;

        if (viewportOffset === 'auto' && this.settings.fixedColumnsLeft) {
          viewportOffset = 10;
        }
        if (typeof viewportOffset === 'number') {
          calc.startColumn = Math.max(calc.startColumn - viewportOffset, 0);
          calc.endColumn = Math.min(calc.endColumn + viewportOffset, cols - 1);
        }
        if (viewportOffset === 'auto') {
          const center = calc.startColumn + calc.endColumn - calc.startColumn;
          const offset = Math.ceil(center / cols * 12);

          // Upstream sets `startRow` here, so 'auto' adds columns on the right only. Setting `startColumn` changes
          // which columns every grid renders by default (and the scrolling that depends on it): a change of its own.
          calc.startRow = Math.max(calc.startColumn - offset, 0);
          calc.endColumn = Math.min(calc.endColumn + offset, cols - 1);
        }
        instance.runHooks('afterViewportColumnCalculatorOverride', calc);
      },
      rowHeaderWidth: () => this.settings.rowHeaderWidth,
      columnHeaderHeight: () => {
        const columnHeaderHeight = instance.runHooks('modifyColumnHeaderHeight');

        return this.settings.columnHeaderHeight || columnHeaderHeight;
      }
    };
  }

  /**
   * Whether the browser may select text under `el`: in inputs, and in the table with `fragmentSelection` (or in
   * the edited cell).
   *
   * @param {HTMLElement} el
   * @returns {Boolean}
   */
  isTextSelectionAllowed(el: Element): boolean {
    if (isInput(el)) {
      return true;
    }
    const isChildOfTableBody = isChildOf(el, this.instance.view.wt.wtTable.spreader);

    if (this.settings.fragmentSelection === true && isChildOfTableBody) {
      return true;
    }
    if (this.settings.fragmentSelection === 'cell' && this.isSelectedOnlyCell() && isChildOfTableBody) {
      return true;
    }
    if (!this.settings.fragmentSelection && this.isCellEdited() && this.isSelectedOnlyCell()) {
      return true;
    }

    return false;
  }

  /**
   * Check if selected only one cell.
   *
   * @returns {Boolean}
   */
  isSelectedOnlyCell(): boolean {
    const [row, col, rowEnd, colEnd] = this.instance.getSelectedLast() || [];

    return row !== void 0 && row === rowEnd && col === colEnd;
  }

  /**
   * Whether a cell editor is open.
   *
   * @returns {Boolean}
   */
  isCellEdited(): boolean {
    const activeEditor = this.instance.getActiveEditor();

    return Boolean(activeEditor && activeEditor.isOpened());
  }

  /**
   * Runs `beforeRender` when Walkontable draws the whole table.
   *
   * @param {Boolean} force
   * @param {Boolean} skipRender
   */
  beforeRender(force: boolean, skipRender: boolean): void {
    if (force) {
      // this.instance.forceFullRender = did FreeSheet request full render?
      this.instance.runHooks('beforeRender', this.instance.forceFullRender, skipRender);
    }
  }

  /**
   * Runs `afterRender` when Walkontable drew the whole table.
   *
   * @param {Boolean} force
   */
  onDraw(force: boolean): void {
    if (force) {
      // this.instance.forceFullRender = did FreeSheet request full render?
      this.instance.runHooks('afterRender', this.instance.forceFullRender);
    }
  }

  /** Draws the table (fully when the grid asked for a full render). */
  render(): void {
    this.renderCommands.draw(!this.instance.forceFullRender);
    this.instance.forceFullRender = false;
    this.instance.renderCall = false;
  }

  /**
   * Returns td object given coordinates
   *
   * @param {CellCoords} coords
   * @param {Boolean} topmost
   */
  getCellAtCoords(coords: CellCoords, topmost?: boolean): HTMLTableCellElement | null {
    return this.renderQueries.getCell(coords, topmost);
  }

  /**
   * Scroll viewport to a cell.
   *
   * @param {CellCoords} coords
   * @param {Boolean} [snapToTop]
   * @param {Boolean} [snapToRight]
   * @param {Boolean} [snapToBottom]
   * @param {Boolean} [snapToLeft]
   * @returns {Boolean}
   */
  scrollViewport(coords: CellCoords, snapToTop?: boolean, snapToRight?: boolean, snapToBottom?: boolean, snapToLeft?: boolean): boolean {
    return this.renderCommands.scrollViewport(coords, snapToTop, snapToRight, snapToBottom, snapToLeft);
  }

  /**
   * Scroll viewport to a column.
   *
   * @param {Number} column Visual column index.
   * @param {Boolean} [snapToLeft]
   * @param {Boolean} [snapToRight]
   * @returns {Boolean}
   */
  scrollViewportHorizontally(column: number, snapToRight?: boolean, snapToLeft?: boolean): boolean {
    return this.renderCommands.scrollViewportHorizontally(column, snapToRight, snapToLeft);
  }

  /**
   * Scroll viewport to a row.
   *
   * @param {Number} row Visual row index.
   * @param {Boolean} [snapToTop]
   * @param {Boolean} [snapToBottom]
   * @returns {Boolean}
   */
  scrollViewportVertically(row: number, snapToTop?: boolean, snapToBottom?: boolean): boolean {
    return this.renderCommands.scrollViewportVertically(row, snapToTop, snapToBottom);
  }

  /**
   * Append row header to a TH element
   * @param row
   * @param TH
   */
  appendRowHeader(row: number, TH: HTMLTableCellElement): void {
    this.#appendHeader(row, TH, 'rowHeader', this.instance.getRowHeader);
    this.instance.runHooks('afterGetRowHeader', row, TH);
  }

  /**
   * Append column header to a TH element
   * @param col
   * @param TH
   */
  appendColHeader(col: number, TH: HTMLTableCellElement): void {
    this.#appendHeader(col, TH, 'colHeader', this.instance.getColHeader);
    this.instance.runHooks('afterGetColHeader', col, TH);
  }

  /** Puts `<div class="relative"><span class="{className}">` into the header (once) and fills the span. */
  #appendHeader(index: number, TH: HTMLTableCellElement, className: string, content: (index: number) => string): void {
    // Plugins may put their own elements next to it (a column outline's gutter, before it).
    const container = TH.querySelector(':scope > .relative') as HTMLElement | null;

    if (container) {
      this.updateCellHeader(container.querySelector(`.${className}`) as HTMLElement, index, content);

      return;
    }
    if (TH.firstChild) {
      empty(TH);
    }

    const div = document.createElement('div');
    const span = document.createElement('span');

    div.className = 'relative';
    span.className = className;
    this.updateCellHeader(span, index, content);

    div.appendChild(span);
    TH.appendChild(div);
  }

  /**
   * Update header cell content
   *
   * @since 0.15.0-beta4
   * @param {HTMLElement} element Element to update
   * @param {Number} index Row index or column index
   * @param {Function} content Function which should be returns content for this cell
   */
  updateCellHeader(element: HTMLElement, index: number, content: (index: number) => string): void {
    let renderedIndex = index;
    const parentOverlay = this.wt.wtOverlays.getParentOverlay(element) || this.wt;

    // prevent wrong calculations from SampleGenerator
    if (element.parentNode) {
      if (hasClass(element, 'colHeader')) {
        renderedIndex = parentOverlay.wtTable.columnFilter.sourceToRendered(index);
      } else if (hasClass(element, 'rowHeader')) {
        renderedIndex = parentOverlay.wtTable.rowFilter.sourceToRendered(index);
      }
    }

    if (renderedIndex > -1) {
      fastInnerHTML(element, content(index));

    } else {
      // workaround for https://github.com/handsontable/handsontable/issues/1946
      fastInnerText(element, String.fromCharCode(160));
      addClass(element, 'cornerHeader');
    }
  }

  /**
   * Given a element's left position relative to the viewport, returns maximum element width until the right
   * edge of the viewport (before scrollbar)
   *
   * @param {Number} leftOffset
   * @return {Number}
   */
  maximumVisibleElementWidth(leftOffset: number): number {
    const workspaceWidth = this.wt.wtViewport.getWorkspaceWidth();
    const maxWidth = workspaceWidth - leftOffset;

    return maxWidth > 0 ? maxWidth : 0;
  }

  /**
   * Given a element's top position relative to the viewport, returns maximum element height until the bottom
   * edge of the viewport (before scrollbar)
   *
   * @param {Number} topOffset
   * @return {Number}
   */
  maximumVisibleElementHeight(topOffset: number): number {
    const workspaceHeight = this.wt.wtViewport.getWorkspaceHeight();
    const maxHeight = workspaceHeight - topOffset;

    return maxHeight > 0 ? maxHeight : 0;
  }

  /**
   * Whether the main table (not an overlay) handles the current mouse event.
   *
   * @returns {Boolean}
   */
  mainViewIsActive(): boolean {
    return this.wt === this.activeWt;
  }

  /** Destroys Walkontable and removes the listeners. */
  destroy(): void {
    this.renderCommands.destroy();
    this.eventManager.destroy();
  }
}

export default TableView;
