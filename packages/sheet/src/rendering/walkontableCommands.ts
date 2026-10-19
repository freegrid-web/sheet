import type Walkontable from '../3rdparty/walkontable/src';
import type CellCoords from '../3rdparty/walkontable/src/cell/coords';
import type { RenderCommands } from './renderCommands';

/** Commands for the live engine; the view still owns Core's render flags and its own event manager. */
export class WalkontableCommands implements RenderCommands {
  constructor(private readonly current: () => Walkontable) {}

  draw(fastDraw: boolean): void {
    this.current().draw(fastDraw);
  }

  scrollViewport(coords: CellCoords, snapToTop?: boolean, snapToRight?: boolean,
                 snapToBottom?: boolean, snapToLeft?: boolean): boolean {
    return this.current().scrollViewport(coords, snapToTop, snapToRight, snapToBottom, snapToLeft);
  }

  scrollViewportHorizontally(column: number, snapToRight?: boolean, snapToLeft?: boolean): boolean {
    return this.current().scrollViewportHorizontally(column, snapToRight, snapToLeft);
  }

  scrollViewportVertically(row: number, snapToTop?: boolean, snapToBottom?: boolean): boolean {
    return this.current().scrollViewportVertically(row, snapToTop, snapToBottom);
  }

  destroy(): void {
    this.current().destroy();
  }
}
