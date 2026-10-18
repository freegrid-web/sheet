import { vi } from 'vitest';
import * as dateFormat from '../../../../helpers/dateFormat';
import { rootComparator } from '../../rootComparator';
import { compareFunctionFactory as dateSort } from '../../sortFunction/date';
import { compareFunctionFactory as timeSort } from '../../sortFunction/time';

const fixtures = [
  ['date', 'dateFormat', 'YYYY-MM-DD', dateSort,
    ['2024-02-03', '', 'invalid', '2023/1/2', null, '2024-2-3', undefined, 'bad', '2022-12-31']],
  ['time', 'timeFormat', 'h:mm:ss a', timeSort,
    ['2:03:00 pm', '', 'invalid', '9:01:00 am', null, '02:03:00 PM', undefined, 'bad', '1:00:00 am']],
];

for (const [type, formatKey, format, factory, values] of fixtures) {
  for (const sortOrder of ['asc', 'desc']) for (const sortEmptyCells of [false, true]) {
    it(`preserves ${type} row order (${sortOrder}, sortEmptyCells=${sortEmptyCells})`, () => {
      const settings = { sortEmptyCells };
      const meta = { type, [formatKey]: format, columnSorting: settings };
      const rows = values.map((value, index) => [index, value]);
      const direct = factory(sortOrder, meta, settings);
      const expected = sortOrder === 'asc'
        ? (sortEmptyCells ? [1, 4, 6, 8, 3, 0, 5, 2, 7] : [8, 3, 0, 5, 2, 7, 1, 4, 6])
        : [0, 5, 3, 8, 2, 7, 1, 4, 6];

      expect([...rows].sort((a, b) => direct(a[1], b[1])).map(row => row[0])).toEqual(expected);
      expect([...rows].sort(rootComparator([sortOrder], [meta])).map(row => row[0])).toEqual(expected);
      expect(direct('invalid', 'bad')).toBe(1);
      expect(direct('bad', 'invalid')).toBe(1);
      expect(direct('invalid', 'invalid')).toBe(0);
    });
  }
}

for (const [type, formatKey, format, , values] of fixtures) {
  it(`parses each ${type} row at most once per sort and discards keys between sorts`, () => {
    const parse = vi.spyOn(dateFormat, 'parseDate');
    const meta = { type, [formatKey]: format, columnSorting: {} };
    const rows = values.map((value, index) => [index, value]);

    try {
      const compare = rootComparator(['asc'], [meta]);

      for (const row of rows) {
        compare(row, rows[0]);
        compare(rows[0], row);
        compare(row, rows[0]);
      }
      expect(parse).toHaveBeenCalledTimes(6);
      parse.mockClear();
      rootComparator(['desc'], [meta])(rows[0], rows[3]);
      expect(parse).toHaveBeenCalledTimes(2);
    } finally {
      parse.mockRestore();
    }
  });
}

it('keeps custom temporal factories and their per-comparison calls', () => {
  const compare = vi.fn(() => 17);
  const factory = vi.fn(() => compare);
  const meta = { type: 'date', columnSorting: { compareFunctionFactory: factory } };
  const root = rootComparator(['asc'], [meta]);

  expect(factory).not.toHaveBeenCalled();
  expect(root([0, 'a'], [1, 'b'])).toBe(17);
  expect(root([0, 'a'], [1, 'b'])).toBe(17);
  expect(factory).toHaveBeenCalledTimes(2);
  expect(compare).toHaveBeenNthCalledWith(1, 'a', 'b');
});

it('keeps object coercions observable on every comparison', () => {
  const toString = vi.fn(() => '2024-01-02');
  const value = { toString };
  const compare = rootComparator(['asc'], [{ type: 'date', dateFormat: 'YYYY-MM-DD', columnSorting: {} }]);
  const first = [0, value];
  const next = [1, '2024-01-01'];

  expect(compare(first, next)).toBe(1);
  expect(compare(first, next)).toBe(1);
  expect(toString).toHaveBeenCalledTimes(2);
});
