# Private TypeScript engine lab

Development checkpoint on `experiment/render-engine`. It is not connected to Core, exported from the package
entry point, or available through a public renderer setting. The normal grid still uses its existing engine.

```sh
node tools/engine-lab/build.mjs
node tools/engine-lab/serve.mjs
# http://127.0.0.1:4184/?painter=canvas&rows=1000000&columns=5000
```

Use the selector to compare Canvas with a minimal DOM painter in the **same TypeScript engine**. Click a cell,
use arrows, F2/Enter or type to edit. Enter/Tab commits; Escape cancels. This initial editor does not move the
selection after commit. Scrolling a non-composing editor out of full view commits it. During composition it
stays pinned at its previous position until composition ends, then commits if still outside the viewport.
Destruction discards any remaining editor value; it never silently writes during cleanup.

The external source port owns generated values, sparse edits and selection. The engine reads only visible
values and has no row-order array or per-row geometry allocation. Selection movement within the current
viewport updates the DOM border without rereading data or repainting cells. Both painters consume the same
bounded scene. Geometry is uniform 28px rows and 130px columns, with 64px/30px headers. Scroll projection uses
an experimental eight-million-pixel body extent cap, not a proven browser limit. Programmatic reveal preserves an exact logical anchor despite native offset rounding. Wheel distances are applied in logical pixels; native scrollbar/touch
positions still have browser-dependent deep-scroll precision; this is not yet the production geometry contract.

## Verification and measurement

Build before running these commands. From the repository root:

```sh
tools/in-playwright-docker.sh node tools/engine-lab/verify.mjs
tools/in-playwright-docker.sh node tools/engine-lab/verify.mjs --browser firefox
tools/in-playwright-docker.sh node tools/engine-lab/verify.mjs --browser webkit
tools/in-playwright-docker.sh node tools/performance/engine.mjs
```

The browser checks exercise both painters, trusted pointer/keyboard/wheel input, edit commit/cancel,
composition guards, deep reveal, resizing, DPR2, pending-frame destruction and remount. Composition events
are synthetic: real IMEs, assistive technology and mobile keyboards still require separate testing.
Unit specs in `packages/sheet/test/unit/renderEngine.unit.js` pin pure geometry and scene boundaries.

`tools/performance/engine.mjs` writes ignored raw samples to `tools/performance/results/engine.json`.
It alternates Canvas/DOM order on fresh pages, discards one warm-up per case/painter, measures five trials,
and asserts identical full scenes. Cases: 100, 10k, 100k, 1m rows by 20 columns and 100 rows by 5k columns.
Production-minified engine source hashes and the environment are included. No builds or other suites should
run concurrently with measurements.

Scroll submission timers include source reads and paint submission, excluding deferred presentation. CDP
counters cover a whole 31-mutation sequence; they overlap and must not be added together. Trusted-key timers
bracket the synchronous engine keydown listener. They measure handler work, **not input-to-visible latency**.
The initial attachment timer ends at the first synchronous paint submission and excludes subsequent observer
work or presentation. These are Canvas/DOM controls, not a production before/after speed-up comparison.

## Remaining scope

This slice has no frozen/variable/merged/hidden cells, custom renderers, cell framework hosts, plugins,
production events, structural mutations, clipboard, range selection, history, sorting, formulas or complete
accessibility. It does not implement TD queries or return fabricated DOM cells. Sharing the command interface
only establishes a TypeScript boundary; it does not prove production scroll semantics or plugin compatibility.

The earlier `tools/hybrid-grid/` lab still holds the separate Vue/frozen/variable-size experiment. Those
features have not yet been ported to this engine. Keep that lab available until matching contracts are tested.
Integration, presentation traces, real IME/accessibility tests and framework hosts remain later checkpoints.
