# Sizer Enterprise Recommendation Review

## Current state

- Sizer auto-selection calculates a minimum-fit configuration from the entered
  workloads, selected growth buffer, N+1 capacity, host reservations, and
  utilization thresholds.
- GPU-equipped multi-machine configurations have a 24-physical-core automatic
  floor, but memory can select the next valid tier as low as 64 or 128 GB.
- Sizing Notes do not clearly distinguish a supportable minimum-fit result from
  a prudent new-hardware procurement baseline.
- GPU count is increased before the conservative node loop. When that loop adds
  machines, GPU count is not reconciled downward against the final N-1 capacity.

## Proposed change

- Keep low-core and low-memory configurations valid; do not impose an arbitrary
  enterprise hardware minimum.
- Add a Sizing Notes caveat when the selected hardware is below 40 physical
  cores and/or 512 GB memory per machine. Explain that the result is minimum-fit
  for the entered demand and growth setting, not a procurement baseline.
- Reconcile automatically managed GPUs per machine after node scaling so the
  final configuration is the smallest supported count that remains below the
  existing 90% N-1 utilization threshold.

## Files touched

- `sizer/sizer.js`
- `tests/index.html`
- `CHANGELOG.md`
- `README.md`
- `js/changelog.js`

## Open questions

- Longer term, should Sizer offer separate "minimum fit" and "procurement
  baseline" recommendation modes backed by published OEM profiles?
- Should future procurement guidance consider workload-specific throughput and
  concurrency inputs once those inputs are available?

## Implementation order

1. Add focused tests for the threshold caveat and final GPU reconciliation.
2. Implement pure helpers and connect them to auto-scaling and Sizing Notes.
3. Verify the default Foundry vLLM scenario in the browser.
4. Update current-release notes and run the complete validation suite.