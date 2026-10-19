import type CellCoords from '../3rdparty/walkontable/src/cell/coords';

/** Engine commands used by the view. Calls remain synchronous, with existing snap argument order. */
export interface RenderCommands {
  draw(fastDraw: boolean): void;
  scrollViewport(coords: CellCoords, snapToTop?: boolean, snapToRight?: boolean,
    snapToBottom?: boolean, snapToLeft?: boolean): boolean;
  scrollViewportHorizontally(column: number, snapToRight?: boolean, snapToLeft?: boolean): boolean;
  scrollViewportVertically(row: number, snapToTop?: boolean, snapToBottom?: boolean): boolean;
  destroy(): void;
}
