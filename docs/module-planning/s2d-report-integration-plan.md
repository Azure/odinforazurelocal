# S2D Report Integration Plan

## Current state

The S2D Calculator owns pure functions for maximum supported individual volume
size and storage-pool consumption, but those functions live in the calculator UI
script. Sizer already captures the hyperconverged machine count, mirror copy
count, capacity-only or cache-and-capacity layout, and per-machine disk counts
and sizes. The Sizer-to-Designer payload does not currently include an S2D
calculation result, so generated design reports cannot show volume guidance.

## Proposed change

- Add an explicit calculation-only mode to the S2D Calculator script. Its
  existing pure `volumeCalculator` API is still exported, while calculator-page
  DOM initialization, storage, analytics, and telemetry are skipped.
- Load the S2D Calculator script in calculation-only mode before Sizer.
- For Single Node, hyperconverged, and rack-aware Sizer handoff, map `2way`,
  `3way`, and `4way` mirror
  resiliency to two, three, and four copies; default provisioning to Thin with
  1 GiB extents; and map Sizer disk configuration to either capacity-only or
  cache-and-capacity calculator input.
- Store a bounded calculation snapshot under `sizerHardware.s2dCalculation`,
  including inputs, maximum supported individual volume size, volume count,
  pool-capacity values, and preformatted derivation lines. Omit the snapshot for
  disaggregated deployments or invalid/incomplete configurations.
- Add a report section titled `S2D Calculation | Supported Maximum Volume Size`
  to HTML/Word, Markdown, and PowerPoint output. Show `Number of Volumes to
  Create`, `Maximum supported size of each volume`, and a `How the result is
  calculated` explanation below the values.
- Keep older Designer payloads compatible by omitting the section when no
  snapshot exists.

## Files touched

- `s2d-calc/s2d-calc.js`
- `sizer/index.html`
- `sizer/sizer.js`
- `report/report.js`
- `report/pptx-export.js`
- `docs/json-schema/odin-design.schema.json`
- `scripts/run-tests.js`
- `tests/index.html`
- `README.md`
- `CHANGELOG.md`
- `js/changelog.js`

## Open questions

None for the initial integration. Thin provisioning with 1 GiB extents is an
explicit integration default, matching the current Azure Local calculator
default. The report records that assumption so it is not hidden. Cache drives
do not add usable capacity; capacity-drive count and size determine the pool.
Single Node follows the calculator's existing rule of two effective machines
for a two-copy mirror. ALDO management and disaggregated deployments omit the
calculation.

## Implementation order

1. Add and regression-test calculation-only reuse of the pure API.
2. Add a pure Sizer-to-S2D input mapper and handoff snapshot builder.
3. Extend the Designer schema and renderer-coverage guard.
4. Render the result and derivation in HTML/Word, Markdown, and PowerPoint.
5. Add GPU instance-total output adjacent to the existing per-machine row.
6. Update current-release documentation and run privacy, lint, HTML, style,
   PowerPoint smoke, browser interaction, and full-suite validation.
