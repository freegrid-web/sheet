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
