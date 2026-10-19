import type { FixedAxis } from './fixedAxis';

export interface CellAddress { row: number; col: number }
export interface CellRect { x: number; y: number; width: number; height: number }
export interface SceneCell extends CellAddress, CellRect { text: string }

/** Values and selection belong to the caller. No second spreadsheet data model lives in the engine. */
export interface EngineSource {
  readCell(address: CellAddress): string;
  writeCell(address: CellAddress, value: string): void;
  getSelection(): CellAddress | null;
  select(address: CellAddress): void;
}

export interface Scene {
  width: number;
  height: number;
  headerWidth: number;
  headerHeight: number;
  cells: SceneCell[];
  rows: { index: number; y: number; height: number }[];
  columns: { index: number; x: number; width: number }[];
}

export function createScene(rows: FixedAxis, columns: FixedAxis, source: EngineSource,
  width: number, height: number, left: number, top: number, headerWidth = 64, headerHeight = 30): Scene {
  const rowRange = rows.range(top, Math.max(0, height - headerHeight));
  const colRange = columns.range(left, Math.max(0, width - headerWidth));
  const scene: Scene = { width, height, headerWidth, headerHeight, cells: [], rows: [], columns: [] };

  for (let col = colRange.start; col < colRange.end; col++) {
    scene.columns.push({ index: col, x: headerWidth + col * columns.size - left, width: columns.size });
  }
  for (let row = rowRange.start; row < rowRange.end; row++) {
    const y = headerHeight + row * rows.size - top;
    scene.rows.push({ index: row, y, height: rows.size });
    for (const column of scene.columns) {
      scene.cells.push({ row, col: column.index, x: column.x, y, width: column.width, height: rows.size,
        text: source.readCell({ row, col: column.index }) });
    }
  }
  return scene;
}
