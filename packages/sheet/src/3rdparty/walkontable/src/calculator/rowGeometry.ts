import type { AxisGeometry } from './axisGeometry';

/**
 * Row positions for a grid where every row has the same base height, except a few rows that turned out taller when
 * rendered (oversized rows). A row's position is `row × height` plus the extra height of the taller rows above it,
 * found with a binary search: no work per row.
 */
class RowGeometry implements AxisGeometry {
  #height: number;
  #totalRows: number;
  /** The taller rows, in ascending order. */
  #rows: number[] = [];
  /** `#extra[i]`: the extra height of `#rows[0..i]` together. */
  #extra: number[] = [];
  #heights = new Map<number, number>();

  constructor(height: number, totalRows: number, oversizedRows: (number | undefined)[] = []) {
    this.#height = height;
    this.#totalRows = totalRows;

    // Object.keys lists only the rows that are set, in ascending order, however long the sparse array is.
    Object.keys(oversizedRows).forEach((key) => {
      const row = Number(key);
      const rowHeight = oversizedRows[row];

      if (rowHeight !== void 0 && rowHeight > height && row < totalRows) {
        this.#heights.set(row, rowHeight);
        this.#extra.push((this.#extra.length ? this.#extra[this.#extra.length - 1] : 0) + rowHeight - height);
        this.#rows.push(row);
      }
    });
  }

  /** Row-specific aliases remain available to existing callers. */
  heightOf(row: number): number {
    return this.sizeOf(row);
  }

  rowAt(offset: number): number {
    return this.indexAt(offset);
  }

  rangeSize(from: number, to: number): number {
    return to > from ? this.positionOf(to) - this.positionOf(from) : 0;
  }

  get totalSize(): number {
    return this.positionOf(this.#totalRows);
  }

  /** The effective size of one row. */
  sizeOf(index: number): number {
    return this.#heights.get(index) ?? this.#height;
  }

  /** The position of a row's top edge: the heights of all the rows above it. */
  positionOf(row: number): number {
    let low = 0;
    let high = this.#rows.length;

    // The number of taller rows above `row`.
    while (low < high) {
      const middle = (low + high) >> 1;

      if (this.#rows[middle] < row) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }

    return row * this.#height + (low ? this.#extra[low - 1] : 0);
  }

  /** The last row whose top edge is at or above `offset` (0 when there is none). */
  indexAt(offset: number): number {
    let low = 0;
    let high = Math.max(0, this.#totalRows - 1);

    while (low < high) {
      const middle = (low + high + 1) >> 1;

      if (this.positionOf(middle) <= offset) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }

    return low;
  }
}

export default RowGeometry;
