---
api: [Filters and the column menu]
---

# Filters and the column menu

`dropdownMenu: true` puts a ▾ button in each column header. It opens the column menu: sorting (with
`columnSorting`), filtering (with `filters`) and hiding the column (with `hiddenColumns`).

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['North', 'Laptop', 1299, '2026-03-02'],
    ['South', 'Monitor', 249, '2026-03-05'],
    ['North', 'Keyboard', 79, '2026-03-09'],
    ['West', 'Laptop', 1249, '2026-03-11'],
    ['South', 'Mouse', 39, '2026-03-14'],
    ['West', 'Monitor', 259, '2026-03-20'],
  ],
  colHeaders: ['Region', 'Product', 'Price', 'Date'],
  rowHeaders: true,
  columns: [{}, {}, { type: 'numeric' }, { type: 'date', dateFormat: 'YYYY-MM-DD' }],
  columnSorting: true,
  filters: true,
  dropdownMenu: true, // the ▾ in each column header
});
```

## Filtering in the menu

- **Filter by condition**: choose a condition (Is equal to, Contains, Greater than, Is between, …) and type its
  value. Once a condition is chosen a second one appears, joined with **And** or **Or**. The menu offers the
  conditions that fit the column: number conditions for numbers, date conditions for `type: 'date'` columns.
- **Filter by value**: every value of the column, as the cells show it (formulas by their result), with a search box.
  Uncheck a value to hide its rows. **Select all** and **Clear** act on the values the search finds. The list shows
  only the values of rows the other columns' filters keep, as in Excel.
- **OK** applies, **Cancel** (or <kbd>Escape</kbd>) closes the menu, **Clear filter** removes the column's filter.

A filtered column shows a funnel instead of the arrow, and the row numbers turn blue. Columns are joined with AND: a
row is shown when it meets the filters of every column.

## Filtering with the API

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['North', 'Laptop', 1299],
    ['South', 'Monitor', 249],
    ['North', 'Keyboard', 79],
    ['West', 'Laptop', 1249],
    ['South', 'Mouse', ''],
  ],
  colHeaders: ['Region', 'Product', 'Price'],
  rowHeaders: true,
  filters: true,
  dropdownMenu: true,
});
const filters = grid.getPlugin('filters');

filters.addCondition(2, 'gt', [100]);                     // visual column, condition, arguments
filters.addCondition(2, 'empty', [], 'disjunction');      // OR with the column's other conditions
filters.addCondition(0, 'by_value', [['North', 'South']]); // keep these values (as text)
filters.filter();                                         // apply

console.log(filters.getConditions(2)); // the column's conditions: gt 100, empty
// filters.removeConditions(2) for one column (then filter()), filters.clearConditions() for all.
```

Conditions: `empty`, `not_empty`, `eq`, `neq`, `begins_with`, `ends_with`, `contains`, `not_contains`, `gt`, `gte`,
`lt`, `lte`, `between`, `not_between`, `date_before`, `date_after`, `date_today`, `date_tomorrow`,
`date_yesterday`, and `by_value`. Text comparisons ignore case; numbers compare as numbers; in a `type: 'date'` column
dates compare by day. A value list applies on top of the column's conditions.

`exportConditions()` returns every column's conditions as JSON-safe data and `importConditions()` takes them back;
the `filters` setting accepts them too (`filters: { conditions }`), and `getDocument()` saves them with each sheet.

## Your own conditions

`FreeSheet.filters.registerCondition(name, condition)` adds a condition for every grid on the page. It works like the
built-in ones: in `addCondition`, in the column menu, with And/Or, and in saved documents (which keep only its name
and arguments, so register it again before loading).

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

FreeSheet.filters.registerCondition('regex', {
  title: 'Matches pattern',   // its name in the column menu
  arity: 1,                   // how many values are typed in the menu: 0, 1 or 2 (default 1)
  types: ['text'],            // the column types the menu offers it for: 'text', 'numeric', 'date' (default all)
  test: (value, [pattern]) => new RegExp(pattern, 'i').test(String(value ?? '')),
});

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['North'], ['South'], ['Northwest'], ['East']],
  colHeaders: ['Region'],
  rowHeaders: true,
  filters: true,
  dropdownMenu: true,
});

grid.getPlugin('filters').addCondition(0, 'regex', ['^N']);
grid.getPlugin('filters').filter();
```

`test` gets the value the cell shows (a formula's result), the arguments and the column's type and date format, and
returns whether the row stays. Registering a built-in name (`contains`, `eq`, …) replaces that condition.
`FreeSheet.filters.getConditionNames()` lists every condition.

## How filtered rows behave

Filtered rows are hidden rows: `countRows()`, selection, the arrow keys and copying skip them, and the row headers
keep their numbers (1, 2, 5). Sorting sorts every row and keeps the filter. An edited row stays visible until the
filter is applied again, as in Excel; `filters: { reapplyOnChange: true }` filters again after every change.

`beforeFilter` runs before the rows are hidden (return `false` to cancel, for example to filter on a server) and
`afterFilter` after; both get the conditions.

## Choosing the menu items

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['Oslo', 709000], ['Riga', 605000], ['Bern', 134000]],
  colHeaders: ['City', 'Population'],
  columnSorting: true,
  filters: true,
  dropdownMenu: [
    'sort_asc', 'sort_desc', '---------',
    'filter_by_value', 'filter_action_bar',
    '---------',
    { name: 'Show the column number', callback: column => alert(`Column ${column + 1}`) },
  ],
});
```

Items: `sort_asc`, `sort_desc`, `clear_sort`, `filter_by_condition`, `filter_by_value`, `filter_action_bar` (OK and
Cancel), `clear_filter`, `hide_column`, `---------` (a separator), and custom items `{ name, callback, disabled }`.
