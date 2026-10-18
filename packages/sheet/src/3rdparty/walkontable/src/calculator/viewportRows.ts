import type { AxisGeometry } from './axisGeometry';

/**
 * Calculates indexes of rows to render OR rows that are visible.
 * To redo the calculation, you need to create a new calculator.
 *
 * @class ViewportRowsCalculator
 */
class ViewportRowsCalculator {
  #options: {
    viewportHeight: number;
    scrollOffset: number;
    totalRows: number;
    rowHeightFn: (index: number) => number | undefined;
    overrideFn?: ((calculator: ViewportRowsCalculator) => void) | null;
    onlyFullyVisible?: boolean;
    horizontalScrollbarHeight?: number;
    geometry?: AxisGeometry | null;
  };
  declare count: number;
  declare startRow: number | null;
  declare endRow: number | null;
  declare startPosition: number | null;

  /**
   * Default row height
   *
   * @type {Number}
   */
  static get DEFAULT_HEIGHT() {
    return 23;
  }

  /**
   * @param {Number} viewportHeight Height of the viewport
   * @param {Number} scrollOffset Current vertical scroll position of the viewport
   * @param {Number} totalRows Total number of rows
   * @param {Function} rowHeightFn Function that returns the height of the row at a given index (in px)
   * @param {Function} overrideFn Function that changes calculated this.startRow, this.endRow (used by MergeCells plugin)
   * @param {Boolean} onlyFullyVisible if `true`, only startRow and endRow will be indexes of rows that are fully in viewport
   * @param {Number} horizontalScrollbarHeight
   */
  constructor(viewportHeight: number, scrollOffset: number, totalRows: number,
              rowHeightFn: (row: number) => number | undefined, overrideFn?: ((calculator: ViewportRowsCalculator) => void) | null,
              onlyFullyVisible?: boolean, horizontalScrollbarHeight?: number, geometry?: AxisGeometry | null) {
    this.#options = {
      viewportHeight,
      scrollOffset,
      totalRows,
      rowHeightFn,
      overrideFn,
      onlyFullyVisible,
      horizontalScrollbarHeight,
      geometry
    };

    /**
     * Number of rendered/visible rows
     *
     * @type {Number}
     */
    this.count = 0;

    /**
     * Index of the first rendered/visible row (can be overwritten using overrideFn)
     *
     * @type {Number|null}
     */
    this.startRow = null;

    /**
     * Index of the last rendered/visible row (can be overwritten using overrideFn)
     *
     * @type {null}
     */
    this.endRow = null;

    /**
     * Position of the first rendered/visible row (in px)
     *
     * @type {Number|null}
     */
    this.startPosition = null;

    this.calculate();
  }

  /**
   * Calculates viewport
   */
  calculate() {
    let sum = 0;
    let needReverse = true;
    const startPositions: number[] = [];

    const options = this.#options;
    const onlyFullyVisible = options.onlyFullyVisible;
    const overrideFn = options.overrideFn;
    const rowHeightFn = options.rowHeightFn;
    const scrollOffset = options.scrollOffset;
    const totalRows = options.totalRows;
    const viewportHeight = options.viewportHeight;
    const horizontalScrollbarHeight = options.horizontalScrollbarHeight || 0;
    // With a row geometry (every row has the same base height; the caller checks that), a row's position is computed,
    // not summed: the rows above the viewport are skipped instead of being asked for their height one by one.
    const geometry = options.geometry || null;
    const positionOf = (row: number) => (geometry ? geometry.positionOf(row) : startPositions[row]);
    let rowHeight!: number;
    let firstRow = 0;

    // Rows before `firstRow` end above the viewport, so in the loop below they would only set `startRow` and `endRow`
    // to themselves (when not only fully visible rows count). Skip them, keeping one row of margin.
    if (geometry && viewportHeight - horizontalScrollbarHeight > 0) {
      firstRow = Math.min(totalRows, Math.max(0, geometry.indexAt(scrollOffset) - 1));

      if (firstRow > 0 && !onlyFullyVisible) {
        this.startRow = firstRow - 1;
        this.endRow = firstRow - 1;
      }
      sum = geometry.positionOf(firstRow);
      rowHeight = geometry.sizeOf(Math.max(0, firstRow - 1));
    }

    // Calculate the number (start and end index) of rows needed
    for (let i = firstRow; i < totalRows; i++) {
      rowHeight = geometry ? geometry.sizeOf(i) : rowHeightFn(i) as number;

      if (isNaN(rowHeight)) {
        rowHeight = ViewportRowsCalculator.DEFAULT_HEIGHT;
      }
      if (sum <= scrollOffset && !onlyFullyVisible) {
        this.startRow = i;
      }

      // the row is within the "visible range"
      if (sum >= scrollOffset && sum + rowHeight <= scrollOffset + viewportHeight - horizontalScrollbarHeight) {
        if (this.startRow === null) {
          this.startRow = i;
        }
        this.endRow = i;
      }
      if (!geometry) {
        startPositions.push(sum);
      }
      sum += rowHeight;

      if (!onlyFullyVisible) {
        this.endRow = i;
      }
      if (sum >= scrollOffset + viewportHeight - horizontalScrollbarHeight) {
        needReverse = false;
        break;
      }
    }

    // If the estimation has reached the last row and there is still some space available in the viewport,
    // we need to render in reverse in order to fill the whole viewport with rows
    if (this.endRow === totalRows - 1 && needReverse) {
      this.startRow = this.endRow;

      while (this.startRow > 0) {
        // rowHeight is the height of the last row
        const viewportSum = positionOf(this.endRow!) + rowHeight - positionOf(this.startRow - 1);

        if (viewportSum <= viewportHeight - horizontalScrollbarHeight || !onlyFullyVisible) {
          this.startRow -= 1;
        }
        if (viewportSum >= viewportHeight - horizontalScrollbarHeight) {
          break;
        }
      }
    }

    if (this.startRow !== null && overrideFn) {
      overrideFn(this);
    }
    this.startPosition = this.startRow === null ? null : positionOf(this.startRow);

    if (this.startPosition === void 0) {
      this.startPosition = null;
    }
    if (this.startRow !== null) {
      this.count = this.endRow! - this.startRow + 1;
    }
  }
}

export default ViewportRowsCalculator;
