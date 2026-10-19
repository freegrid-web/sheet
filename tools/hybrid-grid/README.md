# Hybrid grid experiment

Standalone experiment authorized on 2026-10-19: compare Canvas body painting with a reusable DOM control,
while keeping the model, geometry, editor and real Vue cell components identical. All changes are in
`tools/hybrid-grid/`; production source, public APIs and wrapper implementations are unchanged.
This is a research artifact, not a proposed replacement renderer or a production performance fix.

## Run

From the repository root, with existing workspace dependencies installed:

```sh
node tools/hybrid-grid/serve.mjs
# http://localhost:4183
```

No CDN or new dependency is needed. The server serves the installed docs dependency's production Vue browser
runtime through one explicit route. It listens on loopback. Another port: `--port 4184`.

- Choose Canvas + DOM or DOM control and Apply. Applying resets the model and component state.
- Double-click or press Enter/F2 to create a native DOM textarea above a cell. Enter/Tab commit; Escape cancels.
- Arrows move selection. A scrolled-offscreen editor commits; sorting commits before moving records.
- Click Vue vote buttons. Votes belong to stable record IDs, surviving sorting and offscreen unmount/remount.
- Sort record IDs globally, jump to first/last cell, resize selected row/column, toggle variable sizes and frozen panes.
- The same Vue tree provides/injects context and teleports components into visible-cell hosts. Each mounted cell
  has a diagnostic timer; unmount clears it. The timer exercises cleanup, not a chart or rendering workload.

## Architecture and scope

`model.mjs` owns generated values, edits, votes, the full row permutation and prefix geometry.
`grid.mjs` produces one clipped display list for four frozen/scrolling panes, used by both renderers and
DOM positioning/hit testing. `renderers.mjs` paints that list into a viewport-sized high-DPI Canvas or reusable
DOM cells. `components.mjs` owns the Vue tree independently of either painter.

This tests the cell-host mechanism needed by wrappers; it implements Vue only. It does not establish React,
Angular or Svelte compatibility. Those frameworks still need their own lifecycle/context tests.

Rows/columns can have different sizes. Prefix storage and global row order are proportional to dimensions,
not cell count: approximately 12 bytes per row (8-byte prefix + 4-byte ID), plus column prefixes, sparse edits,
component state and normal object/DOM overhead. Initial prefix construction and a resize rebuild are O(N);
visible offset lookup is O(log N). This deliberately simple representation is not a production geometry design.
A million by 5,000 case generates values on demand: it does **not** allocate five billion cell values.

The native scroll extent is capped at 8 million CSS pixels and mapped onto logical coordinates. This is an
experimental cap, not a universal browser limit. Both renderers use identical mapping, sizing and frozen panes.

Missing: production plugins/hooks, legacy TD renderer compatibility, formulas, arbitrary-key sorting,
merged cells, wrapping/rich text, range selection, clipboard, touch gestures, drag auto-scroll, undo/redo and
full accessibility. The active-cell announcement is not an accessible spreadsheet implementation. Automated
composition checks guard Enter handling; real platform IMEs and screen readers require manual validation.
This is a functional comparison of two small renderers, not feature parity with FreeSheet.

## Checks

```sh
node --test tools/hybrid-grid/model.test.mjs
tools/in-playwright-docker.sh node tools/hybrid-grid/verify.mjs
tools/in-playwright-docker.sh node tools/hybrid-grid/verify.mjs --browser firefox
tools/in-playwright-docker.sh node tools/hybrid-grid/verify.mjs --browser webkit
pnpm lint
tools/in-playwright-docker.sh pnpm typecheck
```

Browser checks cover both painters: bounded visible DOM; high DPI; actual Vue context/state; frozen panes;
offscreen unmount/remount; editor commit/cancel/composition guard; full record-ID sort; host sizing; pointer
editing; container resize; last-cell reachability; complete component/timer/DOM cleanup. They also reach the
last logical cell of a million-row, 5,000-column case without frozen panes. Screenshots/reports are ignored.

## Measurements

```sh
tools/in-playwright-docker.sh node tools/hybrid-grid/benchmark.mjs
# Short probe: --trials 2 --warmup 1 --frames 20
```

Run separately from builds/tests/other benchmarks. Defaults: five measured fresh-page trials plus one warm-up;
alternate Canvas/DOM order every trial; Chromium, normal frame scheduling, device scale 1, browser 1400 × 1000,
grid 1000 × 600 (less native borders/scrollbars); variable sizes and two frozen rows/columns.
Cases: 100 × 20, 100k × 20, 1m × 20 and 100 × 5,000. Each runs with Vue cells disabled and enabled.

Each trial verifies last-cell reachability, then oscillates around the midpoint for 41 scroll mutations over
40 animation-frame intervals, followed by three settling callbacks. Matching display-list hashes assert equal
visible coordinates, sizes, values and rich-cell positions across all trials and both painters.

Reported boundaries:

- Ready time: model/geometry construction, attachment and first completed draw/Vue update. Not actual first paint.
- Draw submission: geometry/list generation, synchronous painting, awaited Vue update and overlay updates.
  Excludes deferred style/layout, raster, GPU completion and presentation.
- CDP task/script/layout/style counters: milliseconds over the **whole scroll sequence**, including harness
  work. Counters overlap; do not add them. No wrappers/coverage/profiling or forced GC run in this measurement.
- Frame-gap p95: animation scheduling, not trusted wheel-event input-to-display latency. Around 16.7 ms is the
  scheduling floor on a 60 Hz run, not 16.7 ms of renderer CPU work.
- Synchronous sort: complete record-ID permutation sort and navigation scheduling. Not general spreadsheet sort.

Reports include all samples, source and Vue hashes, browser/Node/CPU identity and `complete: true` only after
all trials finish. Results are ignored; no runtime RAM/process/GPU-memory savings are claimed from DOM counts.
The experiment does not measure production FreeSheet speed or justify a production renderer replacement alone.
