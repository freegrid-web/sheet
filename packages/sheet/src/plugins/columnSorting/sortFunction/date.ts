import { parseDate } from '../../../helpers/dateFormat';
import { isEmpty } from '../../../helpers/mixed';
import { DO_NOT_SWAP, FIRST_BEFORE_SECOND, FIRST_AFTER_SECOND } from '../sortService';
import type { CompareFunctionFactory, SortOrder, SortSettings } from '../utils';
import type { RowWithValues } from '../rootComparator';

/**
 * A raw value and its lazily parsed sort key. Undefined means it has not been parsed; null means invalid.
 */
type TemporalKey = { value: unknown; date?: Date | null };

const temporalKeyComparator = (sortOrder: SortOrder, columnMeta: Record<string, unknown>,
  columnPluginSettings: SortSettings, formatKey: 'dateFormat' | 'timeFormat', fallbackFormat?: string) => (
  (first: TemporalKey, next: TemporalKey): number => {
    const value = first.value;
    const nextValue = next.value;
    const { sortEmptyCells } = columnPluginSettings;

    if (value === nextValue) {
      return DO_NOT_SWAP;
    }

    if (isEmpty(value)) {
      if (isEmpty(nextValue)) {
        return DO_NOT_SWAP;
      }

      // Just fist value is empty and `sortEmptyCells` option was set
      if (sortEmptyCells) {
        return sortOrder === 'asc' ? FIRST_BEFORE_SECOND : FIRST_AFTER_SECOND;
      }

      return FIRST_AFTER_SECOND;
    }

    if (isEmpty(nextValue)) {
      // Just second value is empty and `sortEmptyCells` option was set
      if (sortEmptyCells) {
        return sortOrder === 'asc' ? FIRST_AFTER_SECOND : FIRST_BEFORE_SECOND;
      }

      return FIRST_BEFORE_SECOND;
    }

    const format = (columnMeta[formatKey] as string | undefined) || fallbackFormat;

    if (first.date === undefined) {
      first.date = parseDate(value as string, format);
    }
    if (next.date === undefined) {
      next.date = parseDate(nextValue as string, format);
    }
    const firstDate = first.date;
    const nextDate = next.date;

    if (!firstDate) {
      return FIRST_AFTER_SECOND;
    }

    if (!nextDate) {
      return FIRST_BEFORE_SECOND;
    }

    if (nextDate > firstDate) {
      return sortOrder === 'asc' ? FIRST_BEFORE_SECOND : FIRST_AFTER_SECOND;
    }

    if (nextDate < firstDate) {
      return sortOrder === 'asc' ? FIRST_AFTER_SECOND : FIRST_BEFORE_SECOND;
    }

    return DO_NOT_SWAP;
  });

/** Makes a standalone value comparator; its keys live for one comparison. */
export const temporalCompareFunctionFactory = (formatKey: 'dateFormat' | 'timeFormat',
  fallbackFormat?: string): CompareFunctionFactory => (sortOrder, columnMeta, columnPluginSettings) => {
  const compare = temporalKeyComparator(sortOrder, columnMeta, columnPluginSettings, formatKey, fallbackFormat);

  return (value, nextValue) => compare({ value }, { value: nextValue });
};

/** Makes a built-in row comparator with parsed keys scoped to this sort, including invalid keys. */
export const temporalRowCompareFunctionFactory = (formatKey: 'dateFormat' | 'timeFormat', fallbackFormat?: string) =>
  (sortOrder: SortOrder, columnMeta: Record<string, unknown>, columnPluginSettings: SortSettings) => {
    const keys = new WeakMap<RowWithValues, TemporalKey>();
    const compare = temporalKeyComparator(sortOrder, columnMeta, columnPluginSettings, formatKey, fallbackFormat);
    const key = (row: RowWithValues): TemporalKey => {
      const value = row[1];

      // Objects can have stateful coercions (or be mutable Dates); keep reading them per comparison.
      if ((typeof value === 'object' && value !== null) || typeof value === 'function') {
        return { value };
      }
      let result = keys.get(row);

      if (!result) {
        result = { value };
        keys.set(row, result);
      }

      return result;
    };

    return (row: RowWithValues, nextRow: RowWithValues): number => compare(key(row), key(nextRow));
  };

export const rowCompareFunctionFactory = temporalRowCompareFunctionFactory('dateFormat');

/**
 * Date sorting compare function factory. Method get as parameters `sortOrder` and `columnMeta` and return compare function.
 */
export const compareFunctionFactory = temporalCompareFunctionFactory('dateFormat');

export const COLUMN_DATA_TYPE = 'date';
