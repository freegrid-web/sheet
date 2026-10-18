/**
 * Immutable geometry queries for one visual axis. The viewport owns the snapshot and shares it with its clones.
 * A changed base size, item count or measured-size revision replaces the snapshot; consumers do not cache sizes.
 * Indexes are zero-based. Positions are unrounded pixels, and range bounds are [from, to), with empty/reversed
 * ranges returning zero. Callers keep indexes within the axis; positionOf(count) is the trailing edge.
 */
export interface AxisGeometry {
  /** The axis's trailing edge. */
  readonly totalSize: number;
  /** The effective size of one item. */
  sizeOf(index: number): number;
  /** The item's leading edge (the sum of all preceding sizes). */
  positionOf(index: number): number;
  /** The last item whose leading edge is at or before the offset, clamped to the axis (zero for an empty axis). */
  indexAt(offset: number): number;
  /** The sum of sizes in [from, to). */
  rangeSize(from: number, to: number): number;
}
