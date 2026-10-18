---
api: [Conditional formatting]
---

# Conditional formatting

Cells can format themselves from their values, as in Excel: a total over 1000 turns red, numbers get a color scale,
data bars or icons. A rule applies to a range of cells and uses the value a cell shows, so formulas are formatted by
their result.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['Store', 'Jan', 'Feb', 'Mar', 'Apr', 'Total'],
    ['Vilnius', 310, 290, 340, 360, 1300],
    ['Kaunas', 180, 210, 190, 205, 785],
    ['Klaipėda', 240, 220, 260, 300, 1020],
    ['Šiauliai', 90, 120, 110, 95, 415],
  ],
  colHeaders: true,
  rowHeaders: true,
  contextMenu: true,
  conditionalFormatting: [
    { range: 'F2:F5', when: 'gt', value: 1000, style: { background: '#f8d7da', color: '#842029' } },
    { range: 'B2:E5', colorScale: ['#f8696b', '#ffeb84', '#63be7b'] },
  ],
});
```

## Ranges

`range` is an A1 range, or a list of them: `B2`, `B2:F20`, `C:C` (whole columns), `3:5` (whole rows). Ranges name
data rows and columns, as formulas do: sorting moves the values and the formatting with them, and inserting or
removing rows and columns moves and resizes the ranges.

For one column there is a shorter form, on the column itself:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    { region: 'North', total: 1240 },
    { region: 'South', total: 860 },
    { region: 'West', total: 1530 },
  ],
  columns: [
    { data: 'region', title: 'Region' },
    { data: 'total', title: 'Total', format: [{ when: 'gt', value: 1000, style: { fontWeight: 'bold' } }] },
  ],
});
```

Data bars and icons:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['Ana', 82, 0.12], ['Ben', 45, -0.04], ['Cleo', 97, 0.31], ['Dan', 63, 0.02]],
  colHeaders: ['Name', 'Score', 'Change'],
  conditionalFormatting: [
    { range: 'B1:B4', dataBar: '#638ec6' },
    { range: 'C1:C4', iconSet: 'arrows' },
  ],
});
```

## Kinds of rules

| Rule | Formats |
| --- | --- |
| `when: 'gt', value: 100` | cells greater than 100; also `gte`, `lt`, `lte`, `eq`, `neq` |
| `when: 'between', value: [10, 20]` | cells between two values; also `not_between` |
| `when: 'contains', value: 'late'` | text containing a value; also `not_contains`, `begins_with`, `ends_with` |
| `when: 'empty'` | blank cells; also `not_empty` |
| `when: 'date_this_week'` | dates in a period: `date_today`, `date_yesterday`, `date_tomorrow`, `date_last_7_days`, `date_this_week`, `date_last_week`, `date_next_week`, `date_this_month`, `date_last_month`, `date_next_month`, `date_before`, `date_after` |
| `when: 'duplicate'` | values that appear more than once in the range; `unique` for once |
| `when: 'top', value: 10` | the 10 largest numbers; `percent: true` for the top 10 %; `bottom` for the smallest |
| `when: 'aboveAverage'` | numbers above the range's average; `belowAverage` |
| `when: '=$F2<0'` | cells where a formula is true (see below) |
| `colorScale: ['#f8696b', '#63be7b']` | a color from the lowest number to the highest (2 or 3 colors, `#rrggbb`) |
| `dataBar: '#638ec6'` | a bar as long as the number |
| `iconSet: 'arrows'` | icons by thirds of the numbers: `arrows`, `trafficLights`, `signs` |

Conditions added with `FreeSheet.filters.registerCondition` work here too.

Highlight and formula rules draw with `style` (`background`, `color`, `fontWeight`, `fontStyle`, `textDecoration`,
`border`) or `className` (your own CSS class).

## Formulas as conditions

`when: '=…'` is a formula written for the range's first cell; for the other cells its relative references move, as
when a formula is copied (`$` fixes a column or a row). `{ range: 'A2:F20', when: '=$F2<0' }` formats a whole row
when its F is negative. A formula rule needs `formulas`; without an engine it does nothing.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';
import init, { Model } from '@ironcalc/wasm';

await init(); // loads the formula engine's WebAssembly

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['Account', 'In', 'Out', 'Balance'],
    ['Rent', 0, 1200, '=B2-C2'],
    ['Sales', 4200, 300, '=B3-C3'],
    ['Travel', 0, 450, '=B4-C4'],
  ],
  colHeaders: true,
  rowHeaders: true,
  formulas: { engine: Model },
  // A whole row turns red when its balance (column D) is negative.
  conditionalFormatting: [{ range: 'A2:D4', when: '=$D2<0', style: { color: '#c00000' } }],
});
```

## Priority

Rules are in priority order: where two rules set the same style, the first wins; others still add their styles.
`stopIfTrue: true` stops the rules after it for the cells it formats.

## In the grid

With `contextMenu: true`, the context menu has **Conditional formatting ▸** with Excel's menu (Highlight Cell
Rules, Top/Bottom Rules, Data Bars, Color Scales, Icon Sets, New Rule, Clear Rules, Manage Rules); rules are written
in the [side panel](./side-panel). `conditionalFormatting: true` turns the plugin on without rules.

## The API

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['Rent', -1200], ['Sales', 4200], ['Travel', -450], ['Fees', 80]],
  colHeaders: ['Account', 'Amount'],
  conditionalFormatting: true,
});
const rules = grid.getPlugin('conditionalFormatting');

const id = rules.addRule({ range: 'B1:B4', when: 'lt', value: 0, style: { color: '#c00000' } });

rules.updateRule(id, { range: 'B1:B4', when: 'lt', value: 0, style: { color: '#c00000', fontWeight: 'bold' } });
console.log(rules.getRulesAt(0, 1).length); // 1: the rules of a cell (visual row and column)
```

The other methods:

```js
rules.moveRule(id, 0);          // highest priority
rules.getRules();               // the sheet's rules, JSON-safe, with ids
rules.clearRules('B5:B10');     // removes the rules from these cells (a larger rule keeps the rest)
rules.clearRules();             // removes every rule
rules.removeRule(id);
```

`afterConditionalFormattingChange` runs after a change. `getDocument()` saves the rules of each sheet and
`loadDocument()` restores them. `conditionalFormatting: true` turns the plugin on without rules.
