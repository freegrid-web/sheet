// FreeSheet: more date sorting specs with valid formats (next to the date spec in columnSorting.e2e.js).
describe('ColumnSorting (FreeSheet) data type: date with a valid format', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}" style="overflow: auto; width: 300px; height: 200px;"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
  });

  it('should sort date columns along with empty and null values', () => {
    handsontable({
      data: [
        ['Mercedes', 'A 160', '01/14/2006', 6999.9999],
        ['Citroen', 'C4 Coupe', '12/01/2008', 8330],
        ['Citroen', 'C4 Coupe null', null, 8330],
        ['Citroen', 'C4 Coupe empty', '', 8330],
        ['Audi', 'A4 Avant', '11/19/2011', 33900],
        ['Opel', 'Astra', '02/02/2004', 7000],
        ['BMW', '320i Coupe', '07/24/2011', 30500]
      ],
      columns: [
        {},
        {},
        {
          type: 'date',
          dateFormat: 'MM/DD/YYYY'
        },
        {
          type: 'numeric'
        }
      ],
      colHeaders: true,
      columnSorting: true
    });

    getPlugin('columnSorting').sort({ column: 2, sortOrder: 'asc' });

    expect(getDataAtCol(2)).toEqual(['02/02/2004', '01/14/2006', '12/01/2008', '07/24/2011', '11/19/2011', null, '']);

    getPlugin('columnSorting').sort({ column: 2, sortOrder: 'desc' });

    expect(getDataAtCol(2)).toEqual(['11/19/2011', '07/24/2011', '12/01/2008', '01/14/2006', '02/02/2004', null, '']);
  });
});

// Pin temporal row identities, including equal parsed values and different invalid strings.
describe('ColumnSorting (FreeSheet) temporal row keys', () => {
  beforeEach(function() {
    this.$container = $('<div id="testContainer"></div>').appendTo('body');
  });

  afterEach(function() {
    destroy();
    this.$container.remove();
  });

  const fixtures = [
    ['date', { dateFormat: 'YYYY-MM-DD' },
      ['2024-02-03', '', 'invalid', '2023/1/2', null, '2024-2-3', undefined, 'bad', '2022-12-31']],
    ['time', { timeFormat: 'h:mm:ss a' },
      ['2:03:00 pm', '', 'invalid', '9:01:00 am', null, '02:03:00 PM', undefined, 'bad', '1:00:00 am']],
  ];

  for (const [type, format, values] of fixtures) {
    for (const sortOrder of ['asc', 'desc']) for (const sortEmptyCells of [false, true]) {
      it(`preserves ${type} row identities (${sortOrder}, sortEmptyCells=${sortEmptyCells})`, () => {
        handsontable({
          data: values.map((value, index) => [value, index]),
          columns: [{ type, ...format }, {}],
          columnSorting: { sortEmptyCells },
        });
        getPlugin('columnSorting').sort({ column: 0, sortOrder });

        // Different invalid strings compare as "after" in both directions. Native sort algorithms give
        // different historical orders: pin each engine's existing result rather than normalize it.
        const invalid = navigator.userAgent.includes('Firefox/') ? [7, 2] : [2, 7];
        const expected = sortOrder === 'asc'
          ? (sortEmptyCells ? [1, 4, 6, 8, 3, 0, 5, ...invalid] : [8, 3, 0, 5, ...invalid, 1, 4, 6])
          : [0, 5, 3, 8, ...invalid, 1, 4, 6];

        expect(getDataAtCol(1)).toEqual(expected);
      });
    }
  }
});
