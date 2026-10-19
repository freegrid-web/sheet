import { FixedAxis, ScrollProjection } from '../../src/rendering/engine/fixedAxis';
import { createScene } from '../../src/rendering/engine/scene';
import { columnLabel } from '../../src/rendering/engine/painters';

describe('experimental fixed geometry and visible scenes', () => {
  it('uses half-open cells at exact and fractional boundaries', () => {
    const axis = new FixedAxis(3, 2.5);
    expect([-1, 0, 2.49, 2.5, 7.49, 7.5, NaN].map(x => axis.indexAt(x)))
      .toEqual([null, 0, 0, 1, 2, null, null]);
    expect(axis.range(2.5, 2.5)).toEqual({ start: 1, end: 2 });
    expect(axis.range(2.49, 2.5)).toEqual({ start: 0, end: 2 });
    expect(axis.range(8, 1)).toEqual({ start: 3, end: 3 });
    expect(axis.range(-5, 2)).toEqual({ start: 0, end: 0 });
    expect(axis.range(0, 0)).toEqual({ start: 0, end: 0 });
  });
  it('rejects unusable dimensions and represents an empty axis', () => {
    for (const [count, size] of [[-1, 28], [1.5, 28], [1, 0], [1, Infinity], [Infinity, 28]]) {
      expect(() => new FixedAxis(count, size)).toThrow(RangeError);
    }
    const axis = new FixedAxis(0, 28);
    expect(axis.indexAt(0)).toBe(null);
    expect(axis.range(0, 100)).toEqual({ start: 0, end: 0 });
  });
  it('projects both endpoints and preserves unclamped fractional positions', () => {
    const projection = new ScrollProjection(28_000_000, 570);
    expect(projection.physicalExtent).toBe(8_000_000);
    expect(projection.toLogical(projection.physicalMax)).toBe(27_999_430);
    expect(projection.toPhysical(projection.logicalMax)).toBe(projection.physicalMax);
    expect(projection.toLogical(projection.toPhysical(12345.67))).toBeCloseTo(12345.67, 8);
    expect(projection.toLogical(-1)).toBe(0);
    expect(projection.toPhysical(Infinity)).toBe(projection.physicalMax);
    const short = new ScrollProjection(10, 570);
    expect(short.toLogical(100)).toBe(0);
    expect(short.physicalExtent).toBe(570);
  });
  it('reads only intersecting cells at a deep viewport, once each', () => {
    const source = { readCell: vi.fn(({ row, col }) => `${row}:${col}`) };
    const scene = createScene(new FixedAxis(1_000_000, 28), new FixedAxis(5000, 130), source,
      324, 86, 130 * 4000, 28 * 900000);
    expect(scene.cells.map(c => c.text)).toEqual(['900000:4000', '900000:4001', '900001:4000', '900001:4001']);
    expect(source.readCell).toHaveBeenCalledTimes(4);
    expect(scene.cells[0]).toMatchObject({ x: 64, y: 30, width: 130, height: 28 });
    expect(scene.rows).toHaveLength(2); expect(scene.columns).toHaveLength(2);
  });
  it('does not read values when the viewport has no body area or source is empty', () => {
    const source = { readCell: vi.fn() };
    expect(createScene(new FixedAxis(100, 28), new FixedAxis(20, 130), source,
      64, 30, 0, 0).cells).toEqual([]);
    expect(createScene(new FixedAxis(0, 28), new FixedAxis(0, 130), source,
      1000, 600, 0, 0).cells).toEqual([]);
    expect(source.readCell).not.toHaveBeenCalled();
  });
  it('labels columns beyond the alphabet', () => {
    expect([0, 25, 26, 51, 52, 701, 702].map(columnLabel)).toEqual(['A', 'Z', 'AA', 'AZ', 'BA', 'ZZ', 'AAA']);
  });
});
