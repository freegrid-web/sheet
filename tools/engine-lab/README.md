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

## Live Core adapter checkpoint

Open [the Core mirror](http://localhost:4184/core.html) after `pnpm build` and the lab build. It creates one
real Core with its existing DOM renderer, then connects a separate Canvas/DOM mirror through
`CoreEngineBridge`. Both views use the same source and selection. This is a diagnostic integration, not a
headless Core mode, replacement backend, public option or full plugin-compatibility claim.

The adapter calls `getDataAtCell`, `getSelectedRangeLast`, `selectCell` and `setDataAtCell`; it does not allocate
another row permutation or edit store. Core translates visual coordinates and owns change hooks, validators,
undo and redo. Plain display uses the shared string conversion helper, not renderer output or formatted text.
Native editing is limited to editable text cells (`readOnly`, `editor: false` and non-text types are checked).
Mirror input releases Core's document keyboard listener and restores mirror focus after Core prepares its
legacy editor. Shortcut/range/editor parity is not established.

Hooks refresh the mirror after data, order, visibility, metadata and settings changes. A full Core render also
refreshes it, preserving explicit `source mutation + render` behavior. Selection-only notifications update the
border. Dimension changes rebuild the small mirror and clamp its previous logical scroll position. This is
not variable-size or structural anchor preservation. The original DOM renderer still works and costs CPU;
visible value reads can invoke read hooks again. Never compare its combined work to a standalone backend as
a production speed-up.

Before source replacement, reordering and structural mutation, an uncommitted native draft is explicitly
cancelled, including composition, with a cancellation callback shown in the lab. Source/selection changes can
also cancel drafts. Conservative cancellation may occur even if a later Core hook cancels the requested
operation. A completed earlier validation or redraw does not cancel a newly opened editor. Already-dispatched
asynchronous writes still belong to Core: identity across reordering/replacement while validation is pending
is not certified. Stable framework-host identities and state lifetime remain separate work.

```sh
tools/in-playwright-docker.sh node tools/engine-lab/verify-core.mjs
tools/in-playwright-docker.sh node tools/engine-lab/verify-core.mjs --browser firefox
tools/in-playwright-docker.sh node tools/engine-lab/verify-core.mjs --browser webkit
tools/in-playwright-docker.sh node tools/performance/engine.mjs --source core \
  --output tools/performance/results/core-bridge-live.json
```

The Core benchmark uses real 100/10k/100k × 20 arrays (maximum two million cells), with source construction
and original Core attachment outside the mirror attachment timer. It alternates painters and checks identical
scenes. Key timings include the Core selection and keyboard-ownership work, starting at document capture;
standalone timings start at the engine listener. These are different contracts, not a before/after ratio.
Both exclude presentation. Core integration checks cover trusted editing, async validation, hooks, readOnly,
undo/redo, sort, row/column movement, insert/remove, object-property data, source replacement and cleanup.
They test specific scenarios while Core still has its old renderer; they do not certify those plugins on a
replacement backend.
