---
api: [Cell types and meta, Editing and validation]
---

# Cell types

A cell type bundles a renderer (how a value looks), an editor (how it is edited) and a validator (what is
allowed). Set it with `type`, usually per column:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['Laptop', 1299.5, '2026-03-02', true, 'Yes'],
    ['Monitor', 249, '2026-03-05', false, 'No'],
    ['Keyboard', 79.99, '2026-03-09', true, 'Yes'],
  ],
  colHeaders: ['Text', 'Numeric', 'Date', 'Checkbox', 'Dropdown'],
  rowHeaders: true,
  columns: [
    { type: 'text' },
    { type: 'numeric', numericFormat: { pattern: '0,0.00' } },
    { type: 'date', dateFormat: 'YYYY-MM-DD', correctFormat: true },
    { type: 'checkbox' },
    { type: 'dropdown', source: ['Yes', 'No'] },
  ],
});
```

| Type | Notes |
| --- | --- |
| `text` | The default. |
| `numeric` | Right-aligned. `numericFormat` sets the format (see [Number formats](#number-formats)). |
| `date` | A date picker. `dateFormat` sets the format (see [Date and time formats](#date-and-time-formats)); `correctFormat: true` reformats valid input. |
| `time` | `timeFormat` sets the format (see [Date and time formats](#date-and-time-formats)). |
| `checkbox` | `checkedTemplate` and `uncheckedTemplate` set the stored values. |
| `dropdown` | A fixed list from `source`. |
| `autocomplete` | Suggestions from `source` (an array or a function). `strict: false` also allows other values. |
| `password` | Shows the value masked. |

## Validation

Invalid values get the `htInvalid` class. `allowInvalid: false` rejects them instead of keeping them.
Your own rule:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['Short name'], ['A name that is far too long for this column']],
  colHeaders: ['Name (up to 20 letters)'],
  colWidths: 320,
  columns: [{
    validator(value, callback) {
      callback(typeof value === 'string' && value.length <= 20);
    },
  }],
});

grid.validateCells(); // marks the second cell
```

See it live in the [cell types example](../examples/cell-types).

## Number formats

`numericFormat` changes how a number is shown, not the stored value. A `pattern` uses numbro's syntax, so patterns
written for numbro keep working; `culture` (default `en-US`) gives the separators and the currency, from the browser,
for any locale.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [[1234.5, 1234.5, 1234.5, 0.125, 1234.5]],
  colHeaders: ['0,0.00', '$0,0.00', '0,0.00 $ (de-DE)', '0.0%', 'Intl: kilogram'],
  colWidths: 130,
  columns: [
    { type: 'numeric', numericFormat: { pattern: '0,0.00' } }, // 1,234.50
    { type: 'numeric', numericFormat: { pattern: '$0,0.00', culture: 'en-US' } }, // $1,234.50
    { type: 'numeric', numericFormat: { pattern: '0,0.00 $', culture: 'de-DE' } }, // 1.234,50 €
    { type: 'numeric', numericFormat: { pattern: '0.0%' } }, // 12.5%
    { type: 'numeric', numericFormat: { style: 'unit', unit: 'kilogram', culture: 'lt-LT' } }, // Intl options
  ],
});
```

| Pattern part | Meaning | Example (1234.5) |
| --- | --- | --- |
| `0` | The number as it is (no rounding without `.00`) | `1234.5` |
| `,` | Thousands separator | `0,0` → `1,234.5` |
| `.00` | Fixed decimals | `0,0.00` → `1,234.50` |
| `[.]00` | Decimals only when needed | `0[.]00` → `1234.50`, and `12` for 12 |
| `000` | Minimum digits before the point | `00000` → `01234.5` |
| `$` | The culture's currency, on the culture's side | `$0,0.00` → `$1,234.50` |
| `%` | Percent (× 100) | `0.0%` for 0.125 → `12.5%` |
| `a` | Thousands/millions/billions/trillions (`k`, `m`, `b`, `t`) | `0.0a` → `1.2k` |
| `o` | Ordinal (English; `.` in other cultures) | `0o` for 3 → `3rd` |
| `b`, `d`, `bd` | Bytes (KiB…, KB… by 1000, KB… by 1024) | `0.0b` → `1.2KiB` |
| `00:00:00` | Seconds as hours:minutes:seconds | `00:00:00` → `0:20:35` |
| `(…)`, `+` | Negative numbers in parentheses, always a sign | `(0,0)` for −5 → `(5)` |
| `{text}` | Text before or after | `{≈ }0` → `≈ 1234.5` |
| space | A space before the symbol or letter | `0,0.00 $` → `$ 1,234.50` |

Without `pattern`, the other options go to the browser's
[`Intl.NumberFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#options)
(`style`, `currency`, `unit`, `notation`, `minimumFractionDigits`, …).

## Date picker

A `date` cell opens a calendar under the cell. Pick a day with the mouse, or press <kbd>Alt</kbd>+<kbd>↓</kbd> to move
into the calendar: arrows move by day and week, <kbd>Page Up</kbd>/<kbd>Page Down</kbd> by month (with
<kbd>Shift</kbd> by year), <kbd>Home</kbd>/<kbd>End</kbd> to the start/end of the week, <kbd>Enter</kbd> picks the
day and <kbd>Esc</kbd> closes the calendar. While you type a date in the cell's format, the calendar follows it.

`datePickerConfig` sets the calendar:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['2026-03-02'], ['2026-03-16'], ['']],
  colHeaders: ['Meeting (double-click)'],
  colWidths: 220,
  columns: [{
    type: 'date',
    dateFormat: 'YYYY-MM-DD',
    datePickerConfig: {
      firstDay: 1, // weeks start on Monday (0 = Sunday, the default)
      minDate: new Date(2026, 0, 1),
      maxDate: new Date(2026, 11, 31),
      disableWeekends: true,
      disableDayFn: date => date.getDate() === 13, // days that cannot be picked
      yearRange: [2020, 2030], // the year list: [from, to], or n years around the shown year (default 10)
    },
  }],
});
```

More options: `i18n` names the months and days (`{ previousMonth, nextMonth, months, weekdays, weekdaysShort }`,
weekdays from Sunday), and `onSelect`, `onOpen`, `onClose` and `onDraw` are called with the calendar.

`defaultDate` (a cell setting) is the date shown when the cell is empty. The calendar's colors come from the
`--fs-datepicker-*` [theme variables](./theming).

## Date and time formats

`dateFormat` (default `DD/MM/YYYY`) and `timeFormat` (default `h:mm:ss a`) use the same tokens as moment.js, so
formats written for moment keep working. FreeSheet reads and writes them itself; no date library is needed.

| Token | Meaning | Example |
| --- | --- | --- |
| `YYYY`, `YY` | Year | `2026`, `26` |
| `M`, `MM`, `MMM`, `MMMM` | Month | `1`, `01`, `Jan`, `January` |
| `D`, `DD`, `Do` | Day of the month | `2`, `02`, `2nd` |
| `d`, `dd`, `ddd`, `dddd` | Weekday | `5`, `Fr`, `Fri`, `Friday` |
| `H`, `HH` / `h`, `hh` / `k`, `kk` | Hour: 0–23 / 1–12 / 1–24 | `15`, `3`, `15` |
| `m`, `mm`, `s`, `ss` | Minutes, seconds | `4`, `04` |
| `S`, `SS`, `SSS` | Fractions of a second | `1`, `12`, `123` |
| `a`, `A` | am/pm | `pm`, `PM` |
| `Z`, `ZZ` | Time zone offset | `+02:00`, `+0200` |
| `X`, `x` | Unix time in seconds, milliseconds | `1767225600` |
| `Q` | Quarter | `1` |
| `L`, `LL`, `LLL`, `LLLL`, `LT`, `LTS` | Long formats | `01/02/2026`, `January 2, 2026`, `3:04 PM` |
| `[text]` | Text as it is | `[at] h a` → `at 3 pm` |

Names are in English. When validating, a value in exactly the format is valid; other readable values (`1:00 pm` for
`h:mm:ss a`) are invalid unless `correctFormat: true`, which rewrites them in the format.
