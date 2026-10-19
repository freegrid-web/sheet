/** Experimental uniform geometry: storage and lookup do not grow with the axis length. */
export class FixedAxis {
  readonly extent: number;

  constructor(readonly count: number, readonly size: number) {
    if (!Number.isSafeInteger(count) || count < 0 || !Number.isFinite(size) || size <= 0 ||
        !Number.isSafeInteger(Math.ceil(count * size))) {
      throw new RangeError('Invalid uniform axis');
    }
    this.extent = count * size;
  }

  indexAt(offset: number): number | null {
    if (!Number.isFinite(offset) || offset < 0 || offset >= this.extent) return null;
    return Math.min(this.count - 1, Math.floor(offset / this.size));
  }

  range(offset: number, length: number): { start: number; end: number } {
    if (!Number.isFinite(offset) || !Number.isFinite(length) || length <= 0) return { start: 0, end: 0 };
    const start = Math.max(0, Math.min(this.count, Math.floor(offset / this.size)));
    const end = Math.max(start, Math.min(this.count, Math.ceil((offset + length) / this.size)));
    return { start, end };
  }
}

/** Lab policy, not a universal browser limit. Keep exact logical coordinates until projection. */
export class ScrollProjection {
  readonly logicalMax: number;
  readonly physicalMax: number;
  readonly physicalExtent: number;

  constructor(extent: number, readonly viewport: number, cap = 8_000_000) {
    this.logicalMax = Math.max(0, extent - viewport);
    this.physicalExtent = Math.max(viewport, Math.min(extent, Math.max(cap, viewport)));
    this.physicalMax = Math.max(0, this.physicalExtent - viewport);
  }

  toLogical(pixel: number): number {
    return this.physicalMax ? Math.max(0, Math.min(this.physicalMax, pixel)) /
      this.physicalMax * this.logicalMax : 0;
  }

  toPhysical(pixel: number): number {
    return this.logicalMax ? Math.max(0, Math.min(this.logicalMax, pixel)) /
      this.logicalMax * this.physicalMax : 0;
  }
}
