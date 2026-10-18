# FreeSheet performance measurements

These runners use Node built-ins and the repository's existing Playwright installation. They add no
runtime/development dependency and do not transpile, modify or instrument production source.
Use Node 24 and install the repository dependencies first (`pnpm install`). Browser scenarios require
a fresh production build in `packages/sheet/dist`; they load the minified full bundle and matching CSS.

## Run

From the repository root:

```sh
pnpm build
node tools/performance/micro.mjs
node tools/performance/browser.mjs
```

With the existing Docker helper (browsers, system libraries and repository fonts):

```sh
tools/in-playwright-docker.sh pnpm build
tools/in-playwright-docker.sh node tools/performance/micro.mjs
tools/in-playwright-docker.sh node tools/performance/browser.mjs --revision "$(git rev-parse HEAD)"
```

A linked worktree's shared Git directory may be outside the Docker mount. Pass `--revision` as above
so the commit is recorded even there. If Git metadata cannot be read, the corresponding fields are
`null`; bundle SHA-256 hashes are still recorded. Check that the production build matches that revision.
The runners do not automatically build, fetch, switch branches or push anything.

Quick validation and small/large row-removal measurements:

```sh
node --test tools/performance/common.test.mjs
tools/in-playwright-docker.sh node tools/performance/browser.mjs \
  --scenario remove-rows --rows 100,100000 --remove 1,1000 --trials 5 --warmup 1 \
  --revision "$(git rev-parse HEAD)" --output tools/performance/results/before.json
node tools/performance/micro.mjs --scenario membership --rows 100,100000 --trials 15 --warmup 5
```

The default row matrix is 100, 10,000, 100,000 and 1,000,000, with 20 columns. Rows and removal counts
are comma-separated positive integers. Each browser case gets five measured trials after one discarded
warmup. Each trial uses a fresh page/grid and prebuilt data. A 120-second page watchdog aborts an
unfinished case; results saved so far remain available, with `complete` absent. An exception or missing
postcondition exits unsuccessfully; incomplete results must not be used as a completed matrix.
Very large auto-column cases can take substantial memory/time; request them explicitly.

The current production build throws `RangeError: Maximum call stack size exceeded` when removing a row
from a million-row source: rebuilding survivors with `push.apply` exceeds the runtime argument limit.
The default `grid` scenario still covers all four sizes. Use at most 100,000 rows for successful
row-removal comparisons on this build; explicitly requesting a failing large deletion exits unsuccessfully
rather than reporting a timing as successful. The exact argument ceiling depends on the runtime.
This runner documents that existing limit and does not change data-removal behavior.

| Option | Default | Meaning |
|---|---|---|
| `--rows` | `100,10000,100000,1000000` | Dataset sizes; storage allocated before timing |
| `--columns` | `20` | Browser dataset width |
| `--trials` | `5` | Measured trials per case; increase to at least 10 for comparisons |
| `--warmup` | `1` | Discarded runs per case; zero is permitted |
| `--iterations` | `20` | Selection/update repetitions in a browser grid case |
| `--remove` | `1,100,1000` | Deletion counts; counts exceeding a dataset size are skipped |
| `--scenario` (browser) | `grid` | `grid`, `remove-rows`, `auto-columns`; `all` runs grid and row-removal cases |
| `--scenario` (micro) | `all` | `membership`, `iteration` or both |
| `--revision` | Git HEAD if readable | Source revision label, useful inside Docker |
| `--output` | `tools/performance/results/browser.json` or `micro.json` | Raw samples, settings and environment metadata; reruns overwrite this path |
| `--profile` | off | Separate Chromium CPU/timeline diagnostic; one size/scenario, trials=1, warmup=0 |

All default output files and profiler artifacts live in the ignored `tools/performance/results/`
directory. Do not commit generated results. A custom output outside that directory is not automatically
ignored. Preserve baseline files and select a different output for the candidate build.

## Browser scenarios and metric contracts

`grid` measures constructor duration, first `afterRender`, a two-RAF initial frame opportunity, scroll
jumps across the reachable height, selection API latency, update API latency, update frame opportunities
and RAF intervals. Explicit numeric dimensions disable auto-sizing in this baseline. Data is numeric;
column zero identifies the original row. Scroll offsets and first rendered rows are recorded to verify
that large-grid tests really reach the expected range. It reads the current engine scroller for that
verification but does not change rendering code.

`remove-rows` runs the real production `alter('remove_row', start, amount)` operation on a new grid per
trial. Initialization and source generation are excluded from the removal timer. Deletion starts in the
middle; source length, boundary identities and one `beforeDataFilter` call are checked after timing.
The synchronous API duration and two-RAF frame opportunity are separate. This includes render/hook/
mapper overhead: it is an end-to-end comparison, not just a membership lookup microbenchmark.

`auto-columns` repeats the grid scenario with automatic column widths/default column sizing, fixed row
heights and auto-row sizing disabled. It isolates that feature rather than pretending to measure every
default configuration. For example:

```sh
tools/in-playwright-docker.sh node tools/performance/browser.mjs \
  --scenario auto-columns --rows 100,10000 --trials 5 --revision "$(git rev-parse HEAD)"
```

Each ordinary browser trial snapshots JS heap after explicit collection: empty page, external dataset,
initialized grid, interactions, destroyed grid with data retained, then external data released. Subtract
`dataHeap` from `initializedHeap` for approximate engine JS overhead; subtract `emptyHeap` from `dataHeap`
for source storage. A row deletion also shrinks the caller's data array, so post-deletion heap changes
include that storage reduction. These snapshots exclude native DOM/process memory. Residual heap after one destruction is not
proof of a leak: diagnose repeated-cycle growth and retaining paths separately.

`afterRender` is a hook milestone, not completed paint. Two RAF callbacks include scheduling delays and
only provide a frame opportunity. Scroll jumps are not a sustained wheel/trackpad benchmark. Selection
uses `scrollIntoView=false` and near-top cells while the viewport is deep. Actual input-to-presentation,
continuous scrolling, multi-range selection, plugin configurations and lifecycle slopes require separate
scenarios. Neither worst interval nor a handful of samples establishes a reliable p99.

Normal frame scheduling is retained; the correctness runner's frame-cap/vsync-disabling flags are not
used. The JSON records raw samples, Node/V8, CPU, OS, source revision (when available), tracked changes,
bundle hashes, browser version, viewport/device scale and options. Record host power/throttling and
container resource limits alongside a comparison; those are not inferred by this runner.

## Microbenchmarks

`membership` compares filtering with `indexOf` against filtering with a once-built Set, including Set
construction and survivor allocation. Inputs are generated outside timing. Dense outputs and sparse
fixtures with duplicate/NaN/undefined/string deletion entries are checked for equality. Since filter's
row index is always an integer, Set's NaN matching does not change this operation's membership result.

`iteration` compares dense `filter/map` against a single pass and dense `forEach` against an indexed
loop. These are synthetic controls, not rewrites proposed for production source. They deliberately use
dense, immutable inputs: an indexed loop is not generally equivalent to array methods on sparse arrays
or arrays mutated by callbacks. Each alternative output is checked; variant order alternates by trial,
warmup is excluded, and results are consumed outside timing. Median, p95 and raw samples are retained.
For small operations, increase repetitions/trials and inspect noise before choosing a threshold.

Microbenchmarks support hypotheses about data structures. They do not measure the built grid and do not
replace before/after browser measurements or behavior specs for a later production change.

## Compare a later fix

Build baseline and candidate independently with the same production command. Run the same scenario,
small and large sizes, settings, warmup and trial count; use distinct `--output` paths and accurate
`--revision` labels. Compare like-for-like raw samples/medians from both JSON files. For row deletion,
compare `interaction.synchronousMs`; separately compare `frameOpportunityMs` so frame waits do not
hide a small-case regression. Include Set/indexOf synthetic controls only as supporting evidence.

Use the same dedicated host, browser, image/fonts, dimensions and limits. Alternate baseline/candidate
order and repeat enough trials to establish noise; do not choose the best run. Keep cold-page semantics
consistent. Confirm postconditions, completion and actual reachable ranges. Include small cases where
the existing implementation may win, data structure construction/invalidation cost and retained memory.
PR descriptions should contain numbers and conditions, not percentage claims inferred from one sample.

## CPU and garbage collection diagnostics

Use a separate run so profiler overhead is excluded from timing comparisons:

```sh
tools/in-playwright-docker.sh node tools/performance/browser.mjs \
  --scenario grid --rows 1000000 --trials 1 --warmup 0 --profile \
  --revision "$(git rev-parse HEAD)" --output tools/performance/results/diagnostic.json
```

The CPU profile and timeline are saved beside the requested output, with the scenario/size in their
filenames. Inspect the CPU profile in developer tools and the timeline for natural GC/layout events.
Explicit-GC memory snapshots are disabled in diagnostic runs; heap fields are `null`, avoiding forced
collections inside the recorded workload. Do not add nested/background GC durations together, interpret
all layout events as avoidable forced layout, or combine profiled timings with baseline samples.

## Date and time sorting

`temporal-sort.mjs` times the synchronous production `columnSorting.sort()` call, including key preparation,
row permutation and render. It uses deterministic shuffled date/time strings, a single temporal column and
numeric key/identity columns, fixed dimensions, no automatic sizing and `observeChanges: false`. Each trial
uses a fresh page/grid; source creation and construction are outside timing. The complete sorted identity
sequence is checked against an independent numeric stable sort after timing. Time keys repeat above 86,400
rows, also exercising stable ties. Date and time results are separate; do not combine them with numeric sorts.

```sh
tools/in-playwright-docker.sh node tools/performance/temporal-sort.mjs \
  --rows 100,10000,100000 --trials 10 --warmup 2 --revision "$(git rev-parse HEAD)" \
  --output tools/performance/results/temporal-before.json
```

Rebuild the candidate and repeat with a different output path. Preserve baseline/candidate bundles to repeat
in reverse order on the same idle host. Raw samples, median/p95, browser version and bundle hashes are saved.
