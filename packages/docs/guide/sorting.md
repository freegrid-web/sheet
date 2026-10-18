---
api: [Sorting]
---

# Sorting

`columnSorting: true` sorts by a column when its header is clicked: ascending, descending, then back to the data's own
order. An arrow in the header shows the order. Sorting changes only the order the rows are shown in: the data keeps
its order, and `getSourceData()` gives it as it was.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['Oslo', 'Norway', 709000, '2026-03-14'],
    ['Vilnius', 'Lithuania', 592000, '2025-11-02'],
    ['Lisbon', 'Portugal', 545000, '2026-01-20'],
    ['Tallinn', 'Estonia', 461000, '2025-09-08'],
  ],
  colHeaders: ['City', 'Country', 'Population', 'Visited'],
  rowHeaders: true,
  columns: [
    {},
    {},
    { type: 'numeric', numericFormat: { pattern: '0,0' } },
    { type: 'date', dateFormat: 'YYYY-MM-DD' },
  ],
  columnSorting: true,
});
```

Each column sorts by its type: numbers as numbers, `date` and `time` cells by their date and time, and text without
regard to case. Empty cells go last in both orders.

## Sorted at start

`initialConfig` sorts the rows when the grid starts:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['Pears', 4], ['Apples', 12], ['Plums', 7], ['Cherries', 30]],
  colHeaders: ['Fruit', 'Boxes'],
  columnSorting: {
    initialConfig: { column: 1, sortOrder: 'desc' },
  },
});
```

## Options

The options go on `columnSorting` for every column, or on a column in `columns` for that column only:

- `headerAction: false`: a click on the header does not sort (code and the column menu still can);
- `indicator: false`: no arrow in the header;
- `sortEmptyCells: true`: empty cells are sorted with the others instead of going last;
- `compareFunctionFactory(sortOrder, columnMeta)`: returns your own compare function, as for `Array.prototype.sort`.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['T-shirt', 'L', 'A-12'], ['Jacket', 'S', 'B-03'], ['Cap', 'XL', 'C-44'], ['Scarf', 'M', 'A-07']],
  colHeaders: ['Item', 'Size', 'Code'],
  columnSorting: true,
  columns: [
    {},
    // Sizes in their own order, not alphabetical.
    {
      columnSorting: {
        compareFunctionFactory: (sortOrder) => (a, b) => {
          const difference = SIZES.indexOf(a) - SIZES.indexOf(b);

          return sortOrder === 'asc' ? difference : -difference;
        },
      },
    },
    // This column does not sort on a click.
    { columnSorting: { headerAction: false, indicator: false } },
  ],
});
```

## Sorting from code

The plugin sorts, clears the order and tells how the rows are sorted. Its column indexes are visual.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['Ana', 31], ['Ben', 27], ['Cleo', 45], ['Dan', 19]],
  colHeaders: ['Name', 'Age'],
  columnSorting: true,
});
const sorting = grid.getPlugin('columnSorting');

sorting.sort({ column: 1, sortOrder: 'asc' });
console.log(sorting.getSortConfig()); // [{ column: 1, sortOrder: 'asc' }]
console.log(grid.getDataAtCell(0, 0)); // 'Dan', the youngest
// sorting.clearSort() shows the data's own order again.
```

## Sorting on a server

`beforeColumnSort` runs before every sort. Return `false` to keep the rows as they are, for example to ask a server
for sorted data and load it with `loadData`. `afterColumnSort` runs after the rows were sorted.

```js
grid.addHook('beforeColumnSort', (currentConfig, destinationConfig) => {
  fetchSorted(destinationConfig).then(rows => grid.loadData(rows));

  return false;
});
```

The [column menu](./filters) (`dropdownMenu: true`) has **Sort A → Z** and **Sort Z → A** when `columnSorting` is
on.
