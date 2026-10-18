import { temporalCompareFunctionFactory, temporalRowCompareFunctionFactory } from './date';
import type { CompareFunctionFactory } from '../utils';

/** Time sorting compare function factory: the column's `timeFormat` (default `h:mm:ss a`, as the time cell type). */
// Made on use: date.ts and this module load each other through the sort service.
export const compareFunctionFactory: CompareFunctionFactory = (...args) =>
  temporalCompareFunctionFactory('timeFormat', 'h:mm:ss a')(...args);

export const COLUMN_DATA_TYPE = 'time';

/** Makes row keys with the same default format as the standalone time comparator. */
export const rowCompareFunctionFactory = (...args: Parameters<CompareFunctionFactory>) =>
  temporalRowCompareFunctionFactory('timeFormat', 'h:mm:ss a')(...args);
