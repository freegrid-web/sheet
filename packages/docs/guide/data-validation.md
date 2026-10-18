---
api: [Data validation]
---

# Data validation

A cell's or a column's `validation` allows only some values, as a spreadsheet's Data validation does.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['Write the report', 'Doing', 6],
    ['Check the numbers', 'Open', 0],
    ['Send it', 'Done', 2],
  ],
  colHeaders: ['Task', 'Status', 'Hours'],
  rowHeaders: true,
  columns: [
    {},
    { validation: { type: 'list', source: ['Open', 'Doing', 'Done'] } }, // a dropdown
    {
      validation: {
        type: 'integer', operator: 'between', value: 0, value2: 24,
        inputMessage: 'Hours: a whole number from 0 to 24', message: 'From 0 to 24',
      },
    },
  ],
});
```

Type 30 into an Hours cell: the value is refused and the message shows. A warning instead of a refusal, and a list
from a range of the sheet:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['Fruit', 'Order', 'Boxes'],
    ['Apples', 'Pears', 120],
    ['Pears', 'Kiwis', 30],
    ['Plums', 'Apples', 8],
  ],
  colHeaders: true,
  rowHeaders: true,
  cells: (row, col) => (row > 0 && col === 1 ? { validation: { type: 'list', source: 'A2:A4', strict: false } } :
    row > 0 && col === 2 ? { validation: { type: 'number', operator: 'greaterOrEqual', value: 10, strict: false } } :
    {}),
});
```

`Kiwis` and `8` are kept but marked: `strict: false` warns instead of refusing.

## Rules

| `type` | Allows |
| --- | --- |
| `'list'` | The items of `source`: an array, or a range of the sheet (`'A1:A5'`). The cell gets a dropdown. |
| `'number'` | Numbers that meet `operator` with `value` (and `value2`) |
| `'integer'` | Whole numbers, the same way |
| `'date'` | Dates (`value`: `'2026-01-01'`), the same way |
| `'textLength'` | Text whose length meets the operator |

The operators are:

- `'between'` and `'notBetween'`, which use `value2` too;
- `'equal'` and `'notEqual'`;
- `'greater'`, `'less'`, `'greaterOrEqual'` and `'lessOrEqual'`.

- **Empty cells** are valid. `allowBlank: false` makes them not valid.
- **Invalid values are refused.** `strict: false` keeps them and marks the cell, as a warning.
- **Messages:** `message` is shown when a value is not valid. `inputMessage` is shown under the cell while it is
  selected.

## The panel

The **Data validation** side panel sets a rule on the selected cells. It opens with `openPanel('dataValidation')` or
from the context menu key `'data_validation'`. It shows:

- the criteria and, for a list, its items (one per line, or a range such as `=A1:A5`);
- the condition and its values;
- whether values that are not valid are refused;
- both messages.

**Apply** sets the rule, **Remove** takes it away, and one undo step takes back either.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['', ''], ['', ''], ['', '']],
  colHeaders: true,
  rowHeaders: true,
  contextMenu: ['undo', 'redo', '---------', 'data_validation'],
  sidePanel: true,
});

grid.selectCell(0, 0, 2, 0);
grid.openPanel('dataValidation');
```

## From code

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [[5, 3], [8, -1], [2, 4]],
  colHeaders: ['Price', 'Stock'],
});
const validation = grid.getPlugin('dataValidation');

grid.selectCell(0, 0, 2, 1);
validation.setValidation({ type: 'number', operator: 'greater', value: 0, strict: false }); // the selected cells
validation.setValidation(null, [[0, 1], [1, 1]]); // removes it from two cells
console.log(validation.getValidation(2, 1));     // the rule of B3
```

`getDocument()` and Excel files keep the rules: a file from Excel brings its data validation, and Excel opens ours.
Turn the feature off with `dataValidation: false`.
