# S2D Calc Plan

## Current state

ODIN exposes Designer, Knowledge, Sizer, and ToR Switch through the shared
navigation component. Storage Spaces Direct volume and pool calculations are
not currently available as a standalone ODIN tool.

The starting calculator is the public TomTools S2D calculator, licensed under
the MIT License. Its calculation behavior covers maximum volume size, supported
node and copy combinations, pool capacity, rebuild reservation, and volume
count.

## Proposed change

Add an `S2D Calc` navigation destination immediately after `ToR Switch` and a
new browser-only calculator page. Preserve the upstream formulas and validation
behavior while rebuilding the presentation with ODIN's shared navigation,
theme, disclaimer, privacy, responsive, and accessibility patterns.

Keep the upstream MIT copyright and permission notice in source code. The page
will not transmit calculator inputs or add runtime dependencies.

## Files touched

- `js/nav.js`
- `js/analytics.js`
- `js/stats-bar.js`
- `js/footer.js`
- `css/style.css`
- `index.html`
- `arm/arm.html`
- `report/report.html`
- `switch-config/index.html`
- `sizer/index.html`
- `sizer/sizer.css`
- `sizer/sizer.js`
- `s2d-calc/index.html`
- `s2d-calc/s2d-calc.css`
- `s2d-calc/s2d-calc.js`
- `tests/index.html`
- `CHANGELOG.md`

## Open questions

None. The source license permits adaptation when its notice is retained, and
the requested navigation position and visual direction are explicit.

## Implementation order

1. Extract the calculator logic into a testable browser global and add focused
   formula and validation tests.
2. Build the ODIN-styled page and connect its controls, live results, export,
   and reset behavior.
3. Add the shared navigation entry and release-note entry.
4. Validate JavaScript, HTML, CSS, responsive rendering, keyboard behavior,
   privacy, attribution, and the full test suite.
