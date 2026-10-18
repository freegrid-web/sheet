# Roadmap

FreeSheet is developed in stages. Larger stages get their own design document in the repository.

| Stage | What | Status |
| --- | --- | --- |
| **0** | Repository with the full history of the MIT code, a modern toolchain (Vite, Vitest, Playwright, Node 24), every upstream test passing, CI and this site. | ✅ Done |
| **1** | First npm release (`0.1.0`), Firefox and Safari test fixes, FreeSheet CSS class names (with a transition period), release automation. | ✅ Done |
| **2** | TypeScript rewrite of the grid (core, plugins, editors, renderers, validators, selection, helpers). Theming with CSS variables and a dark theme. FreeSheet's own date and number formatting and date picker (no runtime dependencies). A generated API reference. A review of known bugs, with fixes. | ✅ Done (`0.2.0`, `0.3.0`) |
| **3** | The package becomes `@freegrid/sheet`: FreeSheet is an Excel-style spreadsheet, and more components will follow under `@freegrid/*`. | ✅ Done (`0.3.0`, `0.4.0`) |
| **4** | The rendering engine (Walkontable): first in TypeScript, then reworked — rendering straight to the DOM, `position: sticky` for frozen rows, columns and headers instead of cloned overlays, cell meta computed only when needed. | In progress: TypeScript and fast row positions for large grids in `0.5.0` |
| **5** | Features that were never part of the MIT release, written from scratch: formulas (through a formula engine plugin), sheets, filters, a column dropdown menu, hidden rows and columns, nested rows, column groups, conditional formatting, Excel files, a new context menu. React, Vue and Angular wrappers. An optional Tailwind preset. | In progress: formulas and a formula bar in `0.5.0`; sheets in `0.6.0`; hidden rows and columns, filters and a column menu, nested rows, column groups, conditional formatting and a side panel in `0.7.0`; `.xlsx` and CSV files, a formatting bar, row and column outlines, data validation, hyperlinks, find and replace, a status bar and change history in `0.8.0`. Next: React and Vue wrappers and threaded comments. |
| **6** | A virtual sheet size with sparse data, as in Excel: a sheet of up to 1,048,576 rows × 16,384 columns where only the filled cells are stored. Every cell can be reached (scrolling, the formula bar's address box) without creating rows in the data. Needs its own design (data model, row count, paste, sorting). | Planned |

`1.0.0` will mark FreeSheet's own stable API. The compatibility layer for older code and the deprecated APIs are
removed then.

Ideas and help are welcome on [GitHub](https://github.com/freegrid-web/sheet/issues).
