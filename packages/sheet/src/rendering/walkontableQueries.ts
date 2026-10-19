import type Walkontable from '../3rdparty/walkontable/src';
import type CellCoords from '../3rdparty/walkontable/src/cell/coords';
import type { RenderQueries } from './renderQueries';

/** Delegates to the live engine without snapshots, cached nodes or changed callback timing. */
export class WalkontableQueries implements RenderQueries {
  constructor(private readonly current: () => Walkontable) {}

  getCell(coords: CellCoords, topmost?: boolean): HTMLTableCellElement | null {
    const cell = this.current().getCell(coords, topmost);

    // Preserve the existing normalization of the engine's out-of-bounds exit codes.
    return (cell as number) < 0 ? null : cell as HTMLTableCellElement;
  }

  getCoords(element: Element): CellCoords | null {
    return this.current().wtTable.getCoords(element);
  }

  rowOffset(): number {
    return this.current().wtTable.getFirstRenderedRow();
  }

  colOffset(): number {
    return this.current().wtTable.getFirstRenderedColumn();
  }

  countRenderedRows(): number {
    const engine = this.current();

    return engine.drawn ? engine.wtTable.getRenderedRowsCount() : -1;
  }

  countVisibleRows(): number {
    const engine = this.current();

    return engine.drawn ? engine.wtTable.getVisibleRowsCount() : -1;
  }

  countRenderedCols(): number {
    const engine = this.current();

    return engine.drawn ? engine.wtTable.getRenderedColumnsCount() : -1;
  }

  countVisibleCols(): number {
    const engine = this.current();

    return engine.drawn ? engine.wtTable.getVisibleColumnsCount() : -1;
  }
}
