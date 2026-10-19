import type CellCoords from '../3rdparty/walkontable/src/cell/coords';

/**
 * The first backend boundary: public cell and viewport queries.
 * DOM cell identity and the existing coordinate class remain part of the compatibility contract.
 * Counts preserve the public -1 sentinel before a successful draw; offsets keep their existing behavior.
 */
export interface RenderQueries {
  getCell(coords: CellCoords, topmost?: boolean): HTMLTableCellElement | null;
  getCoords(element: Element): CellCoords | null;
  rowOffset(): number;
  colOffset(): number;
  countRenderedRows(): number;
  countVisibleRows(): number;
  countRenderedCols(): number;
  countVisibleCols(): number;
}
