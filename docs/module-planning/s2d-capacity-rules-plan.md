# S2D Capacity Rules Plan

## Current state

The S2D calculator derives its volume count from physical available pool
capacity. It does not reserve Azure Local platform volumes from usable capacity,
and tiered layouts allow more cache drives than capacity drives.

## Proposed change

- Deduct 256 GB for `Infrastructure_1` and 20 GB for
  `ClusterPerformanceHistory` from copy-adjusted usable capacity for Azure Local
  only.
- Round usable capacity divided by the maximum supported individual volume size
  up so no volume exceeds that limit, then use the higher of that count or the
  machine count.
- Reject tiered layouts where cache drives per machine exceed capacity drives
  per machine.
- Explain the automatic Azure Local reservation in the result and export.

## Files touched

- `s2d-calc/s2d-calc.js`
- `s2d-calc/index.html`
- `tests/index.html`
- `CHANGELOG.md`

## Open questions

None. Capacity units follow the calculator's existing decimal TB convention, so
the two platform volumes reserve 0.276 TB in total.

## Implementation order

1. Update the calculation contract and focused regression tests.
2. Render and export the Azure Local platform-reservation note.
3. Run lint, HTML validation, planning-note privacy scan, and the full test suite.