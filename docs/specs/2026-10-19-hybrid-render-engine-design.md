# FreeSheet hybrid rendering engine

Status: proposed implementation plan following the authorized 2026-10-19 hybrid experiment.
Production still uses the existing DOM engine. This proposal does not change a public setting or remove it.
The earlier [DOM decision](2026-10-15-dom-rendering-and-canvas-decision.md) remains the production baseline;
this document proposes how to investigate and introduce a replacement, rather than declaring parity.

## Outcome

Build an internal TypeScript rendering engine with viewport-sized Canvas painting and explicit DOM hosting.
Optimize perceived response to scrolling, keyboard selection and editing. Zero input-to-display delay is not
a physically achievable guarantee, and FPS alone is not the acceptance measure.

Keep FreeSheet's data, formulas, sorting, history and workbook ownership outside the engine. The engine owns
geometry, visible scenes, painting, hit testing and host placement. Integration uses an adapter; it must not
start a second independent spreadsheet model.

The local, unpublished experiment in `tools/hybrid-grid/` demonstrates a shared Canvas/DOM controller, variable dimensions,
frozen panes, editing and actual Vue hosts with stable record state. Its generated data, record-ID sort and
small component set do not establish production compatibility. Its model and controller are not a drop-in
implementation of this proposal. React, Angular and Svelte integration remains untested.

## Internal boundaries

Proposed home: `packages/sheet/src/rendering/`, within the existing package. No new npm package initially.

| Module | Owns | Must not own |
| --- | --- | --- |
| `geometry/` | Axis offsets, offset lookup, range sums, dimension versions and logical scroll mapping | Source values or framework state |
| `viewport/` | A bounded visible scene with clipped scrolling/frozen panes | Independent caches in each frozen pane |
| `canvas/` | Text, backgrounds, borders and simple icons; font/DPR-aware measurement caches | Arbitrary HTML renderer execution |
| `interaction/` | Pointer hit testing, selection geometry, keyboard/scroll coordination | A second copy of Core's selection or edit state |
| `dom/` | Editor positioning, focus, visible cell hosts, popup placement and accessibility integration | Framework-specific component implementations |
| `objects/` | Future sheet-object bounds, anchoring, clipping and z-order | Chart data calculations or a mandatory chart library |
| `adapter/` | Read existing data/state, apply edit commands, translate coordinates and invalidate versions | A simulated Walkontable object tree |

Do not add empty modules to satisfy this layout. Introduce each boundary with a working consumer and checks.

The scene carries visual coordinates, stable row/column keys, cell rectangles, content/style descriptors,
pane clipping and a version. Canvas drawing, DOM hosts, selection and hit testing consume the same scene.
Read the required values once when producing a scene; selection-only changes should update their own overlay.
Do not inspect all rows or columns to discover a small viewport on every frame.

Internal operations should cover `attach`, `resize`, `invalidate`, `getCellRect`, `hitTest`, `revealCell` and
`destroy`. These are design responsibilities, not a public API commitment. Prefer a narrow adapter over
exposing new engine internals to plugins or wrappers.

## Geometry and identity

Start with uniform known sizes and sparse overrides. Extend variable dimensions only after boundary,
mutation and performance tests justify a representation. The lab's dense prefix arrays and O(N) resize
rebuild are experimental; they are not the production choice by default.

Version data/order, row sizes, column sizes, styles/fonts and viewport state separately. A frame uses one
coherent geometry version. Resize, insert/remove, sorting/filtering/moving, source replacement, measured
content and font/theme/zoom changes must invalidate the relevant version explicitly. Preserve the logical
scroll anchor and intra-cell offset when preceding sizes change.

Live mutable arrays, metadata and arbitrary callbacks cannot be cached by object identity alone. Initially
leave unproven sizing configurations on the existing renderer. Any managed sizing mode must define mutation
notifications rather than silently stop observing external writes.

Stable keys must come from the data owner. A visual index and a mutable physical array index are not durable
record identities across every operation. The adapter must define key lifetime for sort, insert/remove and
`loadData`; source replacement may explicitly end old component/editor state. Do not invent persistence by
keying hosts to viewport positions. Proving this contract is part of integration, not a solved lab feature.

Use one viewport-sized high-DPI Canvas with pane clips initially, and a synchronized DOM overlay. Browser
scroll extents require measured bounds and logical mapping; the lab's 8-million-pixel cap is not a standard.
Use fractional logical coordinates until final drawing/DOM placement. Test RTL and zoom explicitly.

## DOM editors, frameworks and accessibility

Define a framework-neutral host lifecycle: create a visible host, update its record/rect/context, and dispose
it when no longer needed. The grid owns host geometry; the framework owns children and their lifecycle.
Wrappers must not make competing changes to the same subtree. Keep one logical framework tree where its
portal/teleport mechanism permits it; preserve context and keyed identity.

Persistent state belongs to records or an explicit state store. Offscreen component instances may unmount.
Do not silently destroy focused input. Define commit/cancel/scroll-out policy and keyboard ownership for
inputs, comboboxes and popups. Native DOM editing handles text input, but still requires real IME, clipboard,
mobile keyboard and focus testing. Mount/update/unmount must clean listeners, timers and observers.

Canvas pixels do not expose a semantic table. Design a bounded semantic DOM with correct row/column positions,
selection and focus, then validate actual screen readers and keyboard use. Hidden active-cell text alone is
not accessibility parity. Accessibility is a release gate, not a feature deferred until after replacement.

## Compatibility and rollout

The existing `TableView` creates a table and supplies real TDs to renderers/hooks. Core and plugins also access
`view.wt`, overlays and table geometry directly. This is not a one-file painter swap.

Before production integration, inventory dependencies and classify each public behavior: supported, explicitly
unsupported in experimental mode, or remaining on the existing backend. Include `getCell`/element-coordinate
APIs, custom renderers, before/after hooks, editors, selection borders, headers, auto/manual sizing, merged and
hidden cells, frozen panes, scrolling containers, validation, comments and relevant plugins.

A Canvas cell is not an `HTMLTableCellElement`. Never pass fake TDs or discard a custom renderer's DOM output.
A new drawing descriptor and an explicit DOM-host descriptor can coexist with the legacy API. Configurations
requiring legacy TD behavior stay on DOM until an intentional compatibility decision is documented.

Do not add a public backend switch in the first PR. Use a development harness first. At the opt-in integration
stage, choose the backend before mounting. Explicit Canvas requests with unsupported features must report a
clear capability error; preserve default DOM behavior. Do not switch backends silently during editing.
Removing Walkontable requires a later decision after the agreed compatibility matrix passes.

## Charts and other sheet objects

Plan for objects above the grid rather than forcing every chart into one cell. An object has a stable ID,
cell-based anchor plus offsets, bounds, z-order and a referenced data range. Define whether it moves/resizes
with cells and what structural changes do to its anchor. Persistence and file import/export are separate work.

A chart may own DOM, SVG or its own Canvas in an object host. It need not paint into the grid bitmap. Small
in-cell sparklines can use grid drawing commands. Object clipping, selection, resize handles and focus need
coordination with frozen panes and scrolling. Build object APIs only when implementing the first object;
reserve the boundary now without implementing a chart library.

## Delivery steps

Each implementation PR is based on main and contains a demonstrable vertical slice, not unused scaffolding.
Keep the existing path and its tests green throughout. Measure each relevant step with `tools/performance`.

The agreed compatibility-first starting point precedes the Canvas implementation below: inventory public
methods/events/plugins and extract the existing backend's eight cell/viewport queries through a used internal
boundary. The [compatibility tracker](2026-10-19-render-backend-compatibility.md) records this scope. This is a
behavior-preserving dependency extraction, not a speed fix or a new renderer. No public engine selector ships
until the corresponding capability set has real implementations and compatibility coverage.

1. **Independent Canvas slice in a development harness.** TypeScript engine, fixed-size plain cells and headers,
   viewport-bounded drawing, pointer/keyboard selection, a DOM text editor and complete destruction. Use a narrow
   source adapter. Compare an equivalent DOM control with actual input; do not call it a production speed-up.
2. **Production adapter and compatibility inventory.** Map existing source values, edit commands and selection
   into the engine; prove key lifetime and clean adapter ownership. Inventory direct Walkontable consumers.
   Add opt-in access only for a clearly defined capability set; default production behavior remains unchanged.
3. **Versioned geometry and panes.** Variable dimensions, frozen regions, logical scroll mapping, structural
   changes and anchor preservation. One shared geometry version feeds painting, selection, editors and hit tests.
4. **Framework cell hosts.** Port the proven lifecycle into the engine, implement one actual wrapper integration,
   then validate React/Vue/Angular/Svelte separately. Exercise sort, source updates, focus, scroll-out/return,
   context, popup clipping and repeated cleanup with buttons, comboboxes and a live chart.
5. **Compatibility and accessibility expansion.** Merged/hidden cells, wrapping, styles, supported renderer/hook
   contracts, plugins and element-based APIs, plus screen-reader/IME/mobile testing. Split into small PRs by
   capability. Do not weaken the DOM suite to make the new backend pass.
6. **Sheet objects and replacement decision.** First anchored chart with selection, movement and resizing;
   assess real workloads and the completed compatibility matrix before changing defaults or retiring the old
   engine. Object persistence can ship separately from renderer replacement.

Step 1 succeeds only with visible interaction, repeatable latency evidence and cleanup checks. Merely adding
interfaces, moving files or reducing DOM counts is not completion. A slower candidate stays experimental.

## Performance and verification gates

Use identical data representation, visible work, dimensions, sizing, headers, panes and component counts.
Include small, 10k/100k/1m-row and wide cases, source construction separately from engine attachment, and both
plain and rich content. Logical generated data is not evidence for storing a huge fully populated sheet.
Use production builds, fresh-page warm-ups, alternating renderer order, source hashes and complete raw samples.

Measure trusted wheel/trackpad or available real input, held-arrow selection, edit activation and typing,
resize, updates and sort. Report input handling, scene/paint submission and presentation latency separately;
use browser traces for presentation attribution and manual input where automation cannot reproduce devices.
A RAF interval or a draw function timer alone does not measure input-to-visible response. Report p50/p95/p99,
worst pauses and long tasks; inspect garbage collection and forced layout. Test 60/120 Hz where available and
a slower device/CPU configuration, plus Chromium, Firefox and WebKit. Do not promise universal zero delay.

Initial engineering budget for a controlled warm plain-cell case: p95 engine work <=4 ms and p99 <=8 ms per
interaction update, to be calibrated on named hardware. This excludes presentation, browser work and unrelated
application code; it is a target, not a measured result or sufficient release criterion. Input-to-display
latency must be measured independently. Existing small-case interaction must not regress unexplained.

Measure live and retained JS heap, backing buffers and available process/native metrics separately. Include
repeated create/interact/destroy cycles and many rich hosts. Fewer DOM nodes alone do not establish lower RAM.
Keep temporary per-frame state bounded by visible cells; account separately for data, geometry and edit state.

Behavior specs pin boundaries, invalid/default sizes, mutation invalidation, hit testing, scroll reachability,
selection/edit/clipboard semantics, key identity, panes, zoom, lifecycle and callbacks. Existing behavior stays
on its compatible path; intentional fixes get failing-before specs and changelog entries.

Every implementation PR follows the repository template, leaves both maintainer checkboxes unticked, includes
before/after evidence and passes lint, typecheck, unit, public types, build, dist, all five browser suites,
docs build and docs smoke before review. Docs-model comparisons apply when touching the documented source
entry points. Production speed claims need measurements of the integrated engine, not extrapolation from the lab.
