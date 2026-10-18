import type Walkontable from './core';
import {
  getScrollbarWidth,
  getStyle,
  offset,
  outerHeight,
  outerWidth,
} from './../../../helpers/dom/element';
import { objectEach } from './../../../helpers/object';
import EventManager from './../../../eventManager';
import ViewportColumnsCalculator from './calculator/viewportColumns';
import RowGeometry from './calculator/rowGeometry';
import type { AxisGeometry } from './calculator/axisGeometry';
import ViewportRowsCalculator from './calculator/viewportRows';

/**
 * @class Viewport
 */
class Viewport {
  #engine: Walkontable;
  declare instance: Walkontable;
  declare oversizedRows: (number | undefined)[];
  /** Changes whenever `oversizedRows` changes (see getRowGeometry). */
  oversizedRowsVersion = 0;
  #rowGeometry: { height: number; totalRows: number; version: number; geometry: AxisGeometry } | null = null;
  declare oversizedColumnHeaders: (number | undefined)[];
  declare hasOversizedColumnHeadersMarked: Record<string, boolean | undefined>;
  declare clientHeight: number;
  declare containerWidth: number | null;
  declare rowHeaderWidth: number;
  declare columnHeaderHeight: number;
  declare rowsVisibleCalculator: ViewportRowsCalculator;
  declare columnsVisibleCalculator: ViewportColumnsCalculator;
  declare rowsRenderCalculator: ViewportRowsCalculator;
  declare columnsRenderCalculator: ViewportColumnsCalculator;
  #eventManager: EventManager;

  /**
   * @param wotInstance
   */
  constructor(wotInstance: Walkontable) {
    this.#engine = wotInstance;
    // legacy support
    this.instance = this.#engine;

    this.oversizedRows = [];
    this.oversizedColumnHeaders = [];
    this.hasOversizedColumnHeadersMarked = {};
    this.clientHeight = 0;
    this.containerWidth = NaN;
    this.rowHeaderWidth = NaN;
    this.rowsVisibleCalculator = null!;
    this.columnsVisibleCalculator = null!;

    this.#eventManager = new EventManager(this.#engine);
    this.#eventManager.addEventListener(window, 'resize', () => {
      this.clientHeight = this.getWorkspaceHeight();
    });
  }

  /**
   * @returns {number}
   */
  getWorkspaceHeight() {
    const trimmingContainer = this.instance.wtOverlays.topOverlay.trimmingContainer;
    let elemHeight;
    let height = 0;

    if (trimmingContainer === window) {
      height = document.documentElement.clientHeight;

    } else {
      elemHeight = outerHeight(trimmingContainer as HTMLElement);
      // returns height without DIV scrollbar
      height = (elemHeight > 0 && (trimmingContainer as HTMLElement).clientHeight > 0) ? (trimmingContainer as HTMLElement).clientHeight : Infinity;
    }

    return height;
  }

  getWorkspaceWidth() {
    let width;
    const totalColumns = this.#engine.getSetting('totalColumns');
    const trimmingContainer = this.instance.wtOverlays.leftOverlay.trimmingContainer;
    let overflow;
    const stretchSetting = this.#engine.getSetting('stretchH');
    const docOffsetWidth = document.documentElement.offsetWidth;
    const preventOverflow = this.#engine.getSetting('preventOverflow');

    if (preventOverflow) {
      return outerWidth(this.instance.wtTable.wtRootElement);
    }

    if (this.#engine.getSetting('freezeOverlays')) {
      width = Math.min(docOffsetWidth - this.getWorkspaceOffset().left, docOffsetWidth);
    } else {
      width = Math.min(this.getContainerFillWidth(), docOffsetWidth - this.getWorkspaceOffset().left, docOffsetWidth);
    }

    if (trimmingContainer === window && totalColumns > 0 && this.sumColumnWidths(0, totalColumns - 1) > width) {
      // in case sum of column widths is higher than available stylesheet width, let's assume using the whole window
      // otherwise continue below, which will allow stretching
      // this is used in `scroll_window.html`
      // TODO test me
      return document.documentElement.clientWidth;
    }

    if (trimmingContainer !== window) {
      overflow = getStyle(this.instance.wtOverlays.leftOverlay.trimmingContainer, 'overflow');

      if (overflow === 'scroll' || overflow === 'hidden' || overflow === 'auto') {
        // this is used in `scroll.html`
        // TODO test me
        return Math.max(width, (trimmingContainer as HTMLElement).clientWidth);
      }
    }

    if (stretchSetting === 'none' || !stretchSetting) {
      // if no stretching is used, return the maximum used workspace width
      return Math.max(width, outerWidth(this.instance.wtTable.TABLE));
    }

    // if stretching is used, return the actual container width, so the columns can fit inside it
    return width;
  }

  /**
   * Checks if viewport has vertical scroll
   *
   * @returns {Boolean}
   */
  hasVerticalScroll() {
    return this.getWorkspaceActualHeight() > this.getWorkspaceHeight();
  }

  /**
   * Checks if viewport has horizontal scroll
   *
   * @returns {Boolean}
   */
  hasHorizontalScroll() {
    return this.getWorkspaceActualWidth() > this.getWorkspaceWidth();
  }

  /**
   * @param from
   * @param length
   * @returns {Number}
   */
  sumColumnWidths(from: number, length: number) {
    const wtTable = this.#engine.wtTable;
    let sum = 0;
    let column = from;

    while (column < length) {
      sum += wtTable.getColumnWidth(column);
      column += 1;
    }

    return sum;
  }

  /**
   * @returns {Number}
   */
  getContainerFillWidth() {
    if (this.containerWidth) {
      return this.containerWidth;
    }

    const mainContainer = this.instance.wtTable.holder;
    const dummyElement = document.createElement('div');

    dummyElement.style.width = '100%';
    dummyElement.style.height = '1px';
    mainContainer.appendChild(dummyElement);

    const fillWidth = dummyElement.offsetWidth;

    this.containerWidth = fillWidth;
    mainContainer.removeChild(dummyElement);

    return fillWidth;
  }

  /**
   * @returns {Number}
   */
  getWorkspaceOffset() {
    return offset(this.#engine.wtTable.TABLE);
  }

  /**
   * @returns {Number}
   */
  getWorkspaceActualHeight() {
    return outerHeight(this.#engine.wtTable.TABLE);
  }

  /**
   * @returns {Number}
   */
  getWorkspaceActualWidth() {
    return outerWidth(this.#engine.wtTable.TABLE) ||
      outerWidth(this.#engine.wtTable.TBODY) ||
      outerWidth(this.#engine.wtTable.THEAD); // IE8 reports 0 as <table> offsetWidth;
  }

  /**
   * @returns {Number}
   */
  getColumnHeaderHeight() {
    if (isNaN(this.columnHeaderHeight)) {
      this.columnHeaderHeight = outerHeight(this.#engine.wtTable.THEAD);
    }

    return this.columnHeaderHeight;
  }

  /** Removes a rendered row's measured height, invalidating the shared snapshot when a height was present. */
  clearOversizedRowHeight(row: number): void {
    if (this.oversizedRows && this.oversizedRows[row]) {
      // Keep the sparse cache sparse: geometry construction visits only the measured rows.
      delete this.oversizedRows[row];
      this.oversizedRowsVersion += 1;
    }
  }

  /** Records a measured height and advances the shared snapshot revision only when the value changes. */
  setOversizedRowHeight(row: number, height: number): void {
    if (this.oversizedRows[row] !== height) {
      this.oversizedRows[row] = height;
      this.oversizedRowsVersion += 1;
    }
  }

  /**
   * The row geometry when every row has the same base height (only some rendered rows turned out taller), or `null`.
   * It is rebuilt only when the base height, the number of rows or the taller rows change.
   */
  getRowGeometry(): AxisGeometry | null {
    const engine = this.#engine;
    const totalRows = engine.getSetting('totalRows') as number;
    const rowHeightsUniform = engine.wtSettings.settings.rowHeightsUniform as () => boolean;

    if (totalRows === 0 || !rowHeightsUniform()) {
      return null;
    }
    // The base height, without the measured (oversized) height of row 0.
    const setHeight = (engine.wtSettings.settings.rowHeight as (row: number) => number | undefined)(0);
    const height = (setHeight === void 0 ? engine.wtSettings.settings.defaultRowHeight : setHeight) as number;

    if (!(Number.isFinite(height) && height > 0)) {
      return null;
    }
    const cache = this.#rowGeometry;

    if (!cache || cache.height !== height || cache.totalRows !== totalRows || cache.version !== this.oversizedRowsVersion) {
      this.#rowGeometry = { height, totalRows, version: this.oversizedRowsVersion,
        geometry: new RowGeometry(height, totalRows, this.oversizedRows) };
    }

    return this.#rowGeometry!.geometry;
  }

  getViewportHeight() {
    let containerHeight = this.getWorkspaceHeight();

    if (containerHeight === Infinity) {
      return containerHeight;
    }

    const columnHeaderHeight = this.getColumnHeaderHeight();

    if (columnHeaderHeight > 0) {
      containerHeight -= columnHeaderHeight;
    }

    return containerHeight;
  }

  /**
   * @returns {Number}
   */
  getRowHeaderWidth(): number {
    const rowHeadersHeightSetting = this.instance.getSetting('rowHeaderWidth');
    const rowHeaders = this.instance.getSetting('rowHeaders');

    if (rowHeadersHeightSetting) {
      this.rowHeaderWidth = 0;

      for (let i = 0, len = rowHeaders.length; i < len; i++) {
        this.rowHeaderWidth += (rowHeadersHeightSetting as number[])[i] || rowHeadersHeightSetting as number;
      }
    }

    if (this.#engine.cloneSource) {
      return this.#engine.cloneSource.wtViewport.getRowHeaderWidth();
    }

    if (isNaN(this.rowHeaderWidth)) {

      if (rowHeaders.length) {
        let TH: HTMLElement | null = this.instance.wtTable.TABLE.querySelector('TH');
        this.rowHeaderWidth = 0;

        for (let i = 0, len = rowHeaders.length; i < len; i++) {
          if (TH) {
            this.rowHeaderWidth += outerWidth(TH);
            TH = TH.nextSibling as HTMLElement | null;

          } else {
            // yes this is a cheat but it worked like that before, just taking assumption from CSS instead of measuring.
            // TODO: proper fix
            this.rowHeaderWidth += 50;
          }
        }
      } else {
        this.rowHeaderWidth = 0;
      }
    }

    this.rowHeaderWidth = this.instance.getSetting('onModifyRowHeaderWidth', this.rowHeaderWidth) as number || this.rowHeaderWidth;

    return this.rowHeaderWidth;
  }

  /**
   * @returns {Number}
   */
  getViewportWidth() {
    const containerWidth = this.getWorkspaceWidth();

    if (containerWidth === Infinity) {
      return containerWidth;
    }

    const rowHeaderWidth = this.getRowHeaderWidth();

    if (rowHeaderWidth > 0) {
      return containerWidth - rowHeaderWidth;
    }

    return containerWidth;
  }

  /**
   * Creates:
   *  - rowsRenderCalculator (before draw, to qualify rows for rendering)
   *  - rowsVisibleCalculator (after draw, to measure which rows are actually visible)
   *
   * @returns {ViewportRowsCalculator}
   */
  createRowsCalculator(visible = false) {
    let height;
    let scrollbarHeight;
    let fixedRowsHeight;

    this.rowHeaderWidth = NaN;

    if (this.#engine.wtSettings.settings.renderAllRows && !visible) {
      height = Infinity;
    } else {
      height = this.getViewportHeight();
    }

    let pos = this.#engine.wtOverlays.topOverlay.getScrollPosition() - this.#engine.wtOverlays.topOverlay.getTableParentOffset();

    if (pos < 0) {
      pos = 0;
    }

    const fixedRowsTop = this.#engine.getSetting('fixedRowsTop');
    const fixedRowsBottom = this.#engine.getSetting('fixedRowsBottom');
    const totalRows = this.#engine.getSetting('totalRows');

    if (fixedRowsTop) {
      fixedRowsHeight = this.#engine.wtOverlays.topOverlay.sumCellSizes(0, fixedRowsTop);
      pos += fixedRowsHeight;
      height -= fixedRowsHeight;
    }

    if (fixedRowsBottom && this.#engine.wtOverlays.bottomOverlay.clone) {
      fixedRowsHeight = this.#engine.wtOverlays.bottomOverlay.sumCellSizes(totalRows - fixedRowsBottom, totalRows);

      height -= fixedRowsHeight;
    }

    if (this.#engine.wtTable.holder.clientHeight === this.#engine.wtTable.holder.offsetHeight) {
      scrollbarHeight = 0;
    } else {
      scrollbarHeight = getScrollbarWidth();
    }

    return new ViewportRowsCalculator(
      height,
      pos,
      this.#engine.getSetting('totalRows'),
      // Rows without their own height use the configured default (FreeSheet's --fs-row-height), not the calculator's 23.
      (sourceRow: number) => {
        const height = this.#engine.wtTable.getRowHeight(sourceRow);

        return height === void 0 ? this.#engine.wtSettings.settings.defaultRowHeight : height;
      },
      (visible ? null : this.#engine.wtSettings.settings.viewportRowCalculatorOverride) as ConstructorParameters<typeof ViewportRowsCalculator>[4],
      visible,
      scrollbarHeight,
      this.getRowGeometry()
    );
  }

  /**
   * Creates:
   *  - columnsRenderCalculator (before draw, to qualify columns for rendering)
   *  - columnsVisibleCalculator (after draw, to measure which columns are actually visible)
   *
   * @returns {ViewportRowsCalculator}
   */
  createColumnsCalculator(visible = false) {
    let width = this.getViewportWidth();
    let pos = this.#engine.wtOverlays.leftOverlay.getScrollPosition() - this.#engine.wtOverlays.leftOverlay.getTableParentOffset();

    this.columnHeaderHeight = NaN;

    if (pos < 0) {
      pos = 0;
    }

    const fixedColumnsLeft = this.#engine.getSetting('fixedColumnsLeft');

    if (fixedColumnsLeft) {
      const fixedColumnsWidth = this.#engine.wtOverlays.leftOverlay.sumCellSizes(0, fixedColumnsLeft);
      pos += fixedColumnsWidth;
      width -= fixedColumnsWidth;
    }
    if (this.#engine.wtTable.holder.clientWidth !== this.#engine.wtTable.holder.offsetWidth) {
      width -= getScrollbarWidth();
    }

    return new ViewportColumnsCalculator(
      width,
      pos,
      this.#engine.getSetting('totalColumns'),
      (sourceCol: number) => this.#engine.wtTable.getColumnWidth(sourceCol),
      (visible ? null : this.#engine.wtSettings.settings.viewportColumnCalculatorOverride) as ConstructorParameters<typeof ViewportColumnsCalculator>[4],
      visible,
      // The unconverted calculator's JSDoc says boolean, although the runtime accepts a stretch mode string.
      this.#engine.getSetting('stretchH') as unknown as ConstructorParameters<typeof ViewportColumnsCalculator>[6],
      (stretchedWidth: number | undefined, column: number) => this.#engine.getSetting('onBeforeStretchingColumnWidth', stretchedWidth, column)
    );
  }

  /**
   * Creates rowsRenderCalculator and columnsRenderCalculator (before draw, to determine what rows and
   * cols should be rendered)
   *
   * @param fastDraw {Boolean} If `true`, will try to avoid full redraw and only update the border positions.
   *                           If `false` or `undefined`, will perform a full redraw
   * @returns fastDraw {Boolean} The fastDraw value, possibly modified
   */
  createRenderCalculators(fastDraw = false) {
    let runFastDraw = fastDraw;

    if (runFastDraw) {
      const proposedRowsVisibleCalculator = this.createRowsCalculator(true);
      const proposedColumnsVisibleCalculator = this.createColumnsCalculator(true);

      if (!(this.areAllProposedVisibleRowsAlreadyRendered(proposedRowsVisibleCalculator) &&
          this.areAllProposedVisibleColumnsAlreadyRendered(proposedColumnsVisibleCalculator))) {
        runFastDraw = false;
      }
    }

    if (!runFastDraw) {
      this.rowsRenderCalculator = this.createRowsCalculator();
      this.columnsRenderCalculator = this.createColumnsCalculator();
    }
    // delete temporarily to make sure that renderers always use rowsRenderCalculator, not rowsVisibleCalculator
    this.rowsVisibleCalculator = null!;
    this.columnsVisibleCalculator = null!;

    return runFastDraw;
  }

  /**
   * Creates rowsVisibleCalculator and columnsVisibleCalculator (after draw, to determine what are
   * the actually visible rows and columns)
   */
  createVisibleCalculators() {
    this.rowsVisibleCalculator = this.createRowsCalculator(true);
    this.columnsVisibleCalculator = this.createColumnsCalculator(true);
  }

  /**
   * Returns information whether proposedRowsVisibleCalculator viewport
   * is contained inside rows rendered in previous draw (cached in rowsRenderCalculator)
   *
   * @param {Object} proposedRowsVisibleCalculator
   * @returns {Boolean} Returns `true` if all proposed visible rows are already rendered (meaning: redraw is not needed).
   *                    Returns `false` if at least one proposed visible row is not already rendered (meaning: redraw is needed)
   */
  areAllProposedVisibleRowsAlreadyRendered(proposedRowsVisibleCalculator: ViewportRowsCalculator) {
    if (this.rowsVisibleCalculator) {
      if (proposedRowsVisibleCalculator.startRow! < this.rowsRenderCalculator.startRow! ||
          (proposedRowsVisibleCalculator.startRow! === this.rowsRenderCalculator.startRow! &&
          proposedRowsVisibleCalculator.startRow! > 0)) {
        return false;

      } else if (proposedRowsVisibleCalculator.endRow! > this.rowsRenderCalculator.endRow! ||
          (proposedRowsVisibleCalculator.endRow! === this.rowsRenderCalculator.endRow! &&
          proposedRowsVisibleCalculator.endRow! < this.#engine.getSetting('totalRows') - 1)) {
        return false;

      }
      return true;

    }

    return false;
  }

  /**
   * Returns information whether proposedColumnsVisibleCalculator viewport
   * is contained inside column rendered in previous draw (cached in columnsRenderCalculator)
   *
   * @param {Object} proposedColumnsVisibleCalculator
   * @returns {Boolean} Returns `true` if all proposed visible columns are already rendered (meaning: redraw is not needed).
   *                    Returns `false` if at least one proposed visible column is not already rendered (meaning: redraw is needed)
   */
  areAllProposedVisibleColumnsAlreadyRendered(proposedColumnsVisibleCalculator: ViewportColumnsCalculator) {
    if (this.columnsVisibleCalculator) {
      if (proposedColumnsVisibleCalculator.startColumn! < this.columnsRenderCalculator.startColumn! ||
          (proposedColumnsVisibleCalculator.startColumn! === this.columnsRenderCalculator.startColumn! &&
          proposedColumnsVisibleCalculator.startColumn! > 0)) {
        return false;

      } else if (proposedColumnsVisibleCalculator.endColumn! > this.columnsRenderCalculator.endColumn! ||
          (proposedColumnsVisibleCalculator.endColumn! === this.columnsRenderCalculator.endColumn! &&
          proposedColumnsVisibleCalculator.endColumn! < this.#engine.getSetting('totalColumns') - 1)) {
        return false;

      }
      return true;

    }

    return false;
  }

  /**
   * Resets values in keys of the hasOversizedColumnHeadersMarked object after updateSettings.
   */
  resetHasOversizedColumnHeadersMarked() {
    objectEach(this.hasOversizedColumnHeadersMarked, (value, key, object) => {
      object[key] = void 0;
    });
  }
}

export default Viewport;
