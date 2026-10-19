// Independent lab model: generated values, stable record IDs and an explicit global row permutation.
export class Model {
  constructor(rows, columns) {
    if (!Number.isSafeInteger(rows) || rows < 2 || rows > 1000000 ||
        !Number.isSafeInteger(columns) || columns < 4 || columns > 5000) throw new Error('Invalid dimensions');
    this.rows = rows;
    this.columns = columns;
    this.order = Uint32Array.from({ length: rows }, (_, index) => index);
    this.edits = new Map();
    this.votes = new Map();
    this.descending = false;
  }
  value(id, column) {
    return this.edits.get(`${id}:${column}`) ?? (column === 0 ? `Record ${id}` : String((id * 31 + column * 17) % 100000));
  }
  set(id, column, value) { this.edits.set(`${id}:${column}`, String(value)); }
  sort() {
    this.descending = !this.descending;
    // Full permutation sort by immutable record ID, including rows outside the viewport.
    this.order.sort(this.descending ? (a, b) => b - a : (a, b) => a - b);
  }
}

export class Geometry {
  constructor(count, base, varied = false) {
    this.count = count;
    this.base = base;
    this.varied = varied;
    this.overrides = new Map();
    this.rebuild();
  }
  size(index) { return this.overrides.get(index) ?? this.base + (this.varied ? index % 5 * 2 : 0); }
  rebuild() {
    this.prefix = new Float64Array(this.count + 1);
    for (let index = 0; index < this.count; index++) this.prefix[index + 1] = this.prefix[index] + this.size(index);
  }
  resize(index, size) {
    if (!Number.isInteger(index) || index < 0 || index >= this.count || !Number.isFinite(size) || size < 20) {
      throw new Error('Invalid size');
    }
    this.overrides.set(index, size);
    this.rebuild();
  }
  at(offset) {
    let low = 0;
    let high = this.count - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (this.prefix[middle] <= offset) low = middle;
      else high = middle - 1;
    }
    return low;
  }
}

const HEADER_X = 64;
const HEADER_Y = 30;
const LIMIT = 8000000;
export { HEADER_X, HEADER_Y };
export function axis(geometry, header, viewport) {
  const logicalMax = Math.max(0, geometry.prefix[geometry.count] + header - viewport);
  const physicalMax = Math.max(0, Math.min(LIMIT, geometry.prefix[geometry.count] + header) - viewport);
  const scale = physicalMax ? logicalMax / physicalMax : 1;
  return { logicalMax, physicalMax, scale, extent: physicalMax + viewport };
}

// Frozen and scrolling regions are clipped independently, using the same geometry for painting and DOM hosts.
export function layout(model, rows, columns, width, height, left, top, frozenRows, frozenColumns, rich) {
  const freezeX = HEADER_X + columns.prefix[frozenColumns];
  const freezeY = HEADER_Y + rows.prefix[frozenRows];
  const panes = [];
  for (const fixedY of [false, true]) {
    for (const fixedX of [false, true]) {
      const x = fixedX ? HEADER_X : freezeX;
      const y = fixedY ? HEADER_Y : freezeY;
      const right = fixedX ? Math.min(freezeX, width) : width;
      const bottom = fixedY ? Math.min(freezeY, height) : height;
      const cells = [];
      const firstRow = fixedY ? 0 : Math.max(frozenRows, rows.at(top + rows.prefix[frozenRows]));
      const endRow = fixedY ? frozenRows : Math.min(model.rows, rows.at(top + height - HEADER_Y) + 1);
      const firstColumn = fixedX ? 0 : Math.max(frozenColumns, columns.at(left + columns.prefix[frozenColumns]));
      const endColumn = fixedX ? frozenColumns : Math.min(model.columns, columns.at(left + width - HEADER_X) + 1);
      if (right > x && bottom > y) {
        for (let row = firstRow; row < endRow; row++) {
          for (let column = firstColumn; column < endColumn; column++) {
            const id = model.order[row];
            cells.push({ row, column, id, key: `${id}:${column}`, x: HEADER_X + columns.prefix[column] - (fixedX ? 0 : left),
              y: HEADER_Y + rows.prefix[row] - (fixedY ? 0 : top), w: columns.size(column), h: rows.size(row),
              text: model.value(id, column), rich: rich && column === 1 });
          }
        }
      }
      panes.push({ x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y), cells });
    }
  }
  return panes;
}
