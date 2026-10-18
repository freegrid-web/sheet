# Sales report

A year of sales by region. Each quarter's months are a [column group](../guide/row-groups#column-groups): Q1 is
open, the other quarters show only their total. Click **+** above a quarter, or a level button in the corner, to see
its months.

- The quarter, year and total cells are [formulas](../guide/formulas); change a month and they follow.
- The quarter totals are on a color scale, and the year has data bars ([conditional formatting](../guide/conditional-formatting)).
- The header row and the region column stay in view ([frozen panes](../guide/status-bar-and-freezing)).
- Select some months: the [status bar](../guide/status-bar-and-freezing) shows their sum and average.

<LiveExample name="sales-report" />

<<< @/examples/sales-report.js
