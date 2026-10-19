# Fixed-cell engine checkpoint, 2026-10-19

Status: experimental branch only. This is an initial private engine, not a production speed fix. Default
rendering, public methods, events and plugins still use the existing backend. The old Vue/frozen/variable-size
lab remains available and has not been replaced.

The benchmark in `tools/performance/engine.mjs` compares two painters in the same new TypeScript engine.
It cannot supply a production before/after ratio: the new engine is not connected to Core. No claim is made
that reduced feature scope preserves existing plugin behavior. Compatibility and presentation remain gates.

Environment: Intel i7-14700KF, Chromium 156.0.8078.4, Node 24.21.0 in the repository browser container.
Browser viewport 1400×1000, DPR1, grid content 1000×600, uniform cells 28×130, headers 64×30.
Generated source, no frozen or rich cells. Both painters read the same 176 body cells at the final measured
viewport. The source's logical dimensions are not allocations of all its values.

Raw report: ignored `tools/performance/results/engine.json`, including production-minified bundle hashes,
complete samples, scene hashes and environment. Five trials per case/painter after one discarded warm-up,
alternating pair order, fresh pages, no concurrent builds or suites. Scroll sequence: 31 diagonal mutations
across 30 animation-frame intervals. Trusted keyboard input exercises in-viewport arrow selection and F2.

Timings below are synchronous work or whole-sequence counters, **not input-to-display latency**. In particular,
a trusted-key bracket starts immediately before the engine keydown listener and ends after it; it excludes
input queueing and presentation. Values below the browser timer's resolution can appear as zero. CDP counters
overlap, include harness/browser work and must not be added to submission timers. First attachment ends at
the first synchronous paint submission, excluding later observer work and presentation.

## Final measurements

Pairs below are **Canvas / minimal DOM**, in milliseconds. Attachment is a median; submission is pooled
p95; task/layout are medians for the whole sequence. Both use identical scene hashes.

| Case | Attach | Scroll submission p95 | Whole-sequence task | Whole-sequence layout | Selection handler p95 | Edit activation handler p95 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| small | 2.50 / 1.90 | 0.80 / 1.30 | 44.92 / 109.87 | 0.00 / 13.53 | 0.10 / 0.10 | 0.60 / 0.60 |
| tall10k | 2.60 / 2.00 | 0.70 / 1.30 | 41.45 / 106.30 | 0.00 / 12.60 | 0.10 / 0.10 | 0.50 / 0.50 |
| tall100k | 2.60 / 2.00 | 0.90 / 1.30 | 43.77 / 106.89 | 0.00 / 13.05 | 0.10 / 0.10 | 0.50 / 0.60 |
| tall1m | 2.70 / 1.90 | 0.70 / 1.40 | 41.27 / 107.61 | 0.00 / 12.84 | 0.10 / 0.10 | 0.50 / 0.60 |
| wide | 2.60 / 2.00 | 0.70 / 1.30 | 41.42 / 104.84 | 0.00 / 12.65 | 0.10 / 0.10 | 0.60 / 0.50 |

Canvas attachment is slower than the DOM control in this cold, simple case. Canvas lowers measured scroll
submission and layout work; both have similar selection/edit handler costs. In-viewport arrows perform zero
value reads and zero content repaints in both variants. These observations do not show a production or
visible-latency advantage. There is no universal zero-delay claim.

Minified engine SHA-256: `cff1b60e8304669251193864b6ed353f2ff15f6e0f612ae3490d017e2d4abf57`.

## Validation

- Lint, typecheck, 678 unit specs, public types, build and 24 distribution checks passed.
- Production Chromium and minified: 2451 specs, zero failures each.
- Production Firefox: 14 failures matching the known list; WebKit: 12 matching known failures. No unexpected failures.
- Walkontable: 264 specs, zero failures. Existing pending specs remain unchanged.
- Docs build and complete docs smoke passed.
- Private engine: 20 check groups per browser in Chromium, Firefox and WebKit, each exercising both painters.
- Before-fix deep-editor and logical-wheel checks failed in the private implementation, then passed after correction.

Logs for this local checkpoint: `/tmp/engine-gates.log`, `/tmp/engine-final-checks.log`,
`/tmp/engine-browsers.log`, `/tmp/engine-browsers/`, `/tmp/engine-verify-all.log` and
`/tmp/engine-performance-final.log`. Raw timing reports remain ignored; tracked observations preserve the
contracts, results and source fingerprint. No public entry point or production runtime imports the new engine,
so no package behavior/speed change or changelog entry is claimed from this private checkpoint.

Next: presentation traces and real-input inspection, followed by the narrow production source/selection/edit
adapter and explicit compatibility checks. Variable/frozen geometry and framework hosts remain separate
checkpoints. Do not merge this branch or switch the production renderer based on these plain-cell results.

## Live Core adapter checkpoint

This follows `0055be0a`; the earlier section is the historical fixed-cell checkpoint. The new bridge is a
diagnostic mirror of one live Core, whose original DOM renderer stays active. It adds no public backend
selection. The adapter delegates source values, visual-coordinate edits, validation, change hooks, selection
and history. It owns notification bindings, not another data model. The lab README describes the cancellation
and keyboard policies and remaining identity/compatibility limits.

### Standalone regression controls

Five trials per case/painter after a discarded warm-up, alternating painter order and fresh pages. The first
run used `0055be0a`; the second used the candidate. A third run rebuilt the old engine from HEAD and verified
its bundle SHA-256 exactly matches the first run, then repeated it using the final harness after the candidate.
All corresponding 50 scene hashes match across all three runs. Builds and test suites were stopped during
measurement. Values are **old / candidate / old repeated**, in milliseconds.

| Case | Painter | Attach median | Scroll submission p95 | Whole-sequence task median |
| --- | --- | ---: | ---: | ---: |
| small | canvas | 2.60 / 2.70 / 2.60 | 0.60 / 0.90 / 0.90 | 40.90 / 47.45 / 50.00 |
| small | dom | 2.00 / 2.00 / 2.00 | 1.30 / 1.40 / 1.30 | 113.38 / 109.70 / 108.43 |
| tall10k | canvas | 2.70 / 2.50 / 2.90 | 0.60 / 0.90 / 0.90 | 42.67 / 50.31 / 48.01 |
| tall10k | dom | 1.90 / 2.10 / 2.20 | 1.30 / 1.50 / 1.60 | 107.09 / 110.36 / 106.99 |
| tall100k | canvas | 2.70 / 2.60 / 2.70 | 0.70 / 1.00 / 0.80 | 42.07 / 53.55 / 49.67 |
| tall100k | dom | 2.10 / 1.90 / 1.90 | 1.30 / 1.40 / 1.40 | 110.04 / 110.29 / 107.32 |
| tall1m | canvas | 2.80 / 2.60 / 2.90 | 0.60 / 1.00 / 0.90 | 44.51 / 46.62 / 41.40 |
| tall1m | dom | 2.10 / 1.90 / 2.20 | 1.30 / 1.40 / 1.30 | 110.92 / 107.70 / 106.09 |
| wide | canvas | 2.90 / 2.60 / 2.60 | 0.60 / 0.90 / 0.90 | 42.01 / 51.00 / 43.16 |
| wide | dom | 2.00 / 2.00 / 2.20 | 1.30 / 1.50 / 1.40 | 108.46 / 110.81 / 108.85 |

The first pair showed slower Canvas submission after the change. Repeating the identical old bundle also
raised its submission p95 in several cases. These controls show run-order/environment sensitivity; they do
not establish an engine speed-up or fully attribute every remaining difference. Candidate submission p95
is 0.9–1.0ms in this run. In-viewport selection remains 0.1ms p95, with no visible-value rereads/content repaint.
The baseline/after/repeated reports are ignored at `tools/performance/results/core-bridge-{before,after,before-reverse}.json`.

### Live Core measurements

Five trials per case/painter after warm-up, alternating pair order. Real array sources: 100, 10k and 100k
rows × 20 columns, up to two million values. Original Core/source construction is outside the mirror attach
timer. Both painters share Core and identical scenes. The existing DOM backend remains active: selection
measurements include its work. Input timing starts at document capture and includes keyboard transfer and
Core selection, unlike the standalone timer. These contracts cannot be treated as a before/after ratio.

| Case | Painter | Scroll submission p95 | Selection p50 / p95 / p99 | F2 activation p95 |
| --- | --- | ---: | ---: | ---: |
| small | canvas | 0.70 | 0.90 / 1.20 / 1.50 | 0.50 |
| small | dom | 1.30 | 1.00 / 1.30 / 1.50 | 0.40 |
| tall10k | canvas | 1.00 | 0.90 / 1.30 / 1.40 | 0.50 |
| tall10k | dom | 1.30 | 1.00 / 1.30 / 1.50 | 0.60 |
| tall100k | canvas | 1.00 | 1.00 / 1.50 / 4.60 | 0.50 |
| tall100k | dom | 1.30 | 1.00 / 1.40 / 5.00 | 0.40 |

These measure synchronous handling/submission, not input queueing, presentation or edit commit latency.
The 100k selection p99 reaches about 5ms; no zero-delay or production replacement claim follows.
Live raw report: `tools/performance/results/core-bridge-live.json` (30 complete measured samples), including
the production bundle fingerprint and all event timings. Generated controls contain 150 complete samples
across the three runs. Presentation traces and manual real-IME/accessibility tests remain open.

Final engine SHA-256: `0d1433e55ccfaedbfa658afc0bc6bbd0e4e4024ce2bb1050a6e1b7e44919513d`.

Core bridge SHA-256: `193e9ae9bc2c8eb4f9316569b64b2dceaf5f9b5a64ebdef5ceadac4948bd7dca`.

### Verification

- Lint, typecheck, 678 unit tests, public types, build, 24 dist checks, docs build and full docs smoke passed.
- Production Chromium and minified: 2451 specs, zero failures each; Walkontable: 264, zero failures.
- Firefox: 14 matched known failures; WebKit: 12 matched known failures. No unexpected failures or baseline changes.
- Standalone engine: 23 groups per browser; live Core: 22 groups per browser, Chromium/Firefox/WebKit, both painters.
- The edit-eligibility check failed on the previous committed engine before restoring the candidate.
- The stale composition-event check failed before binding events to their exact editor instance.
- Integration checks cover trusted input/focus, async validation, a delayed completion preserving a newer draft,
  readOnly, hook cancellation, undo/redo, sort/movement translation, structure, object data, replacement and cleanup.

Local logs: `/tmp/core-bridge-gates.log`, `/tmp/core-bridge-final-checks.log`,
`/tmp/core-bridge-browsers.log`, `/tmp/core-bridge-browsers/`, `/tmp/core-bridge-performance-final.log`,
`/tmp/core-bridge-before-reverse.log`, `/tmp/core-bridge-old-engine.log` and
`/tmp/core-bridge-stale-composition-before.log`. Final bundles were restored and their hashes checked against
the measured candidates. No package-visible behavior or changelog entry is claimed for this private lab.

Next: pending-write identity under source/order changes, actual presentation evidence and the production
selection/editor ownership boundary. Full plugin/event/TD compatibility and variable/frozen geometry remain
separate gates. Keep development on the experimental branch.
