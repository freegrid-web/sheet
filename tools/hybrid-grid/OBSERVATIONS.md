# Hybrid experiment observations — 2026-10-19

Completed local run: 80 measured fresh-page trials, five per configuration plus one discarded warm-up; alternating renderer order.
Intel(R) Core(TM) i7-14700KF; Chromium 156.0.8078.4; Node v24.21.0. Same visible display-list hashes for every comparable trial.

Both controls have variable sizes, 2 frozen rows/columns, the same model and DOM editor.
Rich cases have 19 real Vue button hosts at the final measured viewport. All cases draw 152 body cells there.
The table reports medians across five trials. CPU counters cover a **whole 41-mutation scroll sequence**, not a frame.

| Case | Vue cells | Task ms, Canvas / DOM | Layout ms, Canvas / DOM | Script ms, Canvas / DOM | Frame-gap p95 ms, Canvas / DOM |
| --- | --- | ---: | ---: | ---: | ---: |
| small | off | 77.6 / 95.7 | 2.9 / 12.3 | 18.9 / 15.8 | 16.7 / 16.8 |
| small | on | 77.5 / 100.6 | 3.4 / 11.0 | 16.6 / 16.2 | 16.7 / 16.8 |
| tall100k | off | 75.8 / 94.9 | 2.8 / 11.6 | 18.0 / 15.4 | 16.8 / 16.7 |
| tall100k | on | 87.8 / 104.9 | 3.7 / 11.7 | 19.3 / 16.3 | 16.8 / 16.7 |
| tall1m | off | 78.5 / 95.4 | 3.0 / 11.5 | 18.5 / 15.5 | 16.7 / 16.7 |
| tall1m | on | 89.6 / 105.0 | 3.5 / 11.7 | 19.4 / 17.0 | 16.7 / 16.7 |
| wide | off | 71.0 / 94.2 | 2.6 / 11.4 | 16.6 / 14.5 | 16.7 / 16.7 |
| wide | on | 87.9 / 106.3 | 3.8 / 11.9 | 19.1 / 17.5 | 16.7 / 16.7 |

Canvas reduced task/layout work in this lab; JavaScript work was slightly higher. Both painters remained near
the 60 Hz scheduling floor, so no visible scrolling advantage was established. These counters overlap and
must not be summed. This is not a comparison with the production engine and does not establish input latency,
accessibility parity or total memory savings.

| Case | Vue cells | Ready median ms, Canvas / DOM | Ready range ms, Canvas / DOM |
| --- | --- | ---: | --- |
| small | off | 5.7 / 4.8 | 5.6–6.1 / 4.7–5.0 |
| small | on | 7.8 / 6.5 | 7.5–8.0 / 6.3–6.8 |
| tall100k | off | 9.3 / 7.7 | 8.9–9.5 / 7.4–8.3 |
| tall100k | on | 11.4 / 9.7 | 10.9–12.1 / 9.4–10.1 |
| tall1m | off | 36.0 / 35.8 | 35.0–36.6 / 33.1–36.1 |
| tall1m | on | 37.5 / 37.3 | 36.5–40.6 / 36.2–38.6 |
| wide | off | 6.4 / 5.3 | 6.3–7.0 / 4.9–5.4 |
| wide | on | 8.5 / 7.0 | 8.2–9.1 / 6.8–11.7 |

Ready includes initial model/geometry construction, attachment and completed first draw/Vue update; excludes
actual presentation. Canvas did not improve initialization in these samples. Model values are generated,
not a fully populated source. This prototype has 12-byte-per-row geometry/order storage before other overhead.

The cell-host design worked with one Vue tree, inherited context, stable record IDs and controlled unmounting.
React/Angular/Svelte are untested. Rich components retain their DOM/framework costs under either painter.
Production TD renderers, plugins, accessibility, merged cells, wrapping and platform IMEs remain unvalidated.

Reproduce with [the README](README.md). Raw samples, ranges and source hashes are in ignored
`results/final-benchmark.json` (`complete: true`). No production files or public APIs were changed.
