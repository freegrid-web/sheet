const isEmpty = (value: unknown): boolean => value === null || value === void 0 || value === '';

/** A row's values: an array row's items, an object row's properties. */
const valuesOf = (row: unknown): unknown[] => {
  if (Array.isArray(row)) {
    return row;
  }

  return row && typeof row === 'object' ? Object.values(row) : [row];
};

/**
 * Rows without the empty rows and columns at their end (what `fillContainer` adds), but at least `minRows` rows and
 * `minColumns` columns: the last ones something else needs, such as a cell's own settings. Object rows keep their
 * properties; only empty rows at the end go.
 */
export const trimEmptyEnd = <T>(rows: T[], minRows = 0, minColumns = 0): T[] => {
  let count = rows.length;

  while (count > minRows && valuesOf(rows[count - 1]).every(isEmpty)) {
    count -= 1;
  }
  const kept = rows.slice(0, count);

  if (!kept.every(row => Array.isArray(row))) {
    return kept;
  }
  const width = Math.max(minColumns, 0, ...kept.map((row) => {
    let used = (row as unknown[]).length;

    while (used > 0 && isEmpty((row as unknown[])[used - 1])) {
      used -= 1;
    }

    return used;
  }));

  return kept.map(row => (row as unknown[]).slice(0, width) as T);
};
