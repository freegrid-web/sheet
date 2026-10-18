import { describe, expect, it } from 'vitest';
import { trimEmptyEnd } from '../../../src/utils/emptyEnd';

describe('trimEmptyEnd', () => {
  it('drops the empty rows and columns at the end', () => {
    expect(trimEmptyEnd([['a', null, ''], ['', 'b', null], [null, '', null]])).toEqual([['a', null], ['', 'b']]);
  });

  it('keeps empty cells inside the data', () => {
    expect(trimEmptyEnd([['', 'a'], [null, null], ['b', '']])).toEqual([['', 'a'], [null, null], ['b', '']]);
  });

  it('keeps at least the rows and columns asked for', () => {
    expect(trimEmptyEnd([['a', null, null], [null, null, null], [null, null, null]], 2, 3))
      .toEqual([['a', null, null], [null, null, null]]);
  });

  it('drops empty object rows at the end and keeps their properties', () => {
    expect(trimEmptyEnd([{ a: 1, b: null }, { a: null, b: '' }])).toEqual([{ a: 1, b: null }]);
  });

  it('keeps nothing of empty data', () => {
    expect(trimEmptyEnd([[null], ['']])).toEqual([]);
  });
});
