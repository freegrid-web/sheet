import { getCompareFunctionFactory } from './sortService';
import { compareFunctionFactory as dateSort, rowCompareFunctionFactory as dateRowSort } from './sortFunction/date';
import { compareFunctionFactory as timeSort, rowCompareFunctionFactory as timeRowSort } from './sortFunction/time';
import type { CompareFunctionFactory, SortOrder, SortSettings } from './utils';

/** A row to sort: `[rowIndex, value]` (the sorted column's value). */
export type RowWithValues = [number, ...unknown[]];

/**
 * Sort comparator handled by conventional sort algorithm: compares the sorted column's values of two rows, with the
 * column's compare function (its `compareFunctionFactory` setting, or the one of its type).
 *
 * @param sortingOrders Sort orders (`asc` for ascending, `desc` for descending).
 * @param columnMetas Column meta objects.
 */
export const rootComparator = (sortingOrders: SortOrder[], columnMetas: Record<string, unknown>[]) => {
  const columnMeta = columnMetas[0];
  const pluginSettings = columnMeta.columnSorting as SortSettings;
  const factory = getCompareFunctionFactory(columnMeta.type as string);

  if (!pluginSettings.compareFunctionFactory) {
    if (factory === dateSort) {
      return dateRowSort(sortingOrders[0], columnMeta, pluginSettings);
    }
    if (factory === timeSort) {
      return timeRowSort(sortingOrders[0], columnMeta, pluginSettings);
    }
  }

  return ([, ...values]: RowWithValues, [, ...nextValues]: RowWithValues): number => {
    // Only the first column: ColumnSorting sorts by one column. Keep custom factories per comparison.
    const currentMeta = columnMetas[0];
    const currentSettings = currentMeta.columnSorting as SortSettings;
    const compareFunctionFactory: CompareFunctionFactory = currentSettings.compareFunctionFactory ||
      getCompareFunctionFactory(currentMeta.type as string);

    return compareFunctionFactory(sortingOrders[0], currentMeta, currentSettings)(values[0], nextValues[0]);
  };
};
