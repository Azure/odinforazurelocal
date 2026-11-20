# Release Review Hardening

## Current state

PR #312 is open for release 0.23.09. Review confirmed unsafe DNS attribute
interpolation, malformed npm-audit records passing the policy gate, and
low-contrast report scope text in Print Friendly mode. Existing audit, node
transition, and fabric rasterization tests also have coverage gaps.

Full UI validation also measured normal light-theme scope text at 4.43:1,
below the 4.5:1 threshold. Use the existing primary-text variable rather than
changing the shared theme palette or relaxing the regression assertion.

## Proposed change

- Render DNS values through DOM properties and preserve add/remove, validation,
  identity-mode labels, and keyboard accessibility.
- Validate audit records and advisory shapes before filtering. Keep legitimate
  transitive references and the existing scoped, expiring exception unchanged.
- Give scope text an accessible foreground in light, dark, and Print Friendly
  modes.
- Cover successful nonblocking audits, malformed reports, DNS import/rerender,
  and report contrast. Assert node values before editing after each transition.
- Capture cloned PNG sources atomically before PDF iframe cleanup; measure
  fabric foreground glyphs and local contrast from actual PNG pixels.

## Files touched

- `js/dns.js`
- `report/report.html`
- `scripts/check-npm-audit.js`, `scripts/check-npm-audit.test.js`
- `scripts/ui-regressions.test.js`
- `CHANGELOG.md`, `README.md`, `js/changelog.js`
- This plan

## Open questions

None. The maintainer approved addressing all six findings in the existing PR.
Application version and JSON payload shapes remain unchanged.

## Implementation order

1. Add focused regression cases and apply the minimal fixes.
2. Exercise real Designer imports, DNS edits, topology transitions, report
   palettes, and rasterized output, including inverse paths.
3. Run lint, audit-policy, runner, file-mode, HTTP, and full UI gates.
4. Update release evidence, push Release, and recheck PR feedback. A human
   performs the merge.

## Implementation and validation outcome

All six approved findings are addressed. Application version, payload shapes,
schemas, sizing formulas, and existing defaults remain unchanged.

- File-mode 1729/1729; HTTP 2013/2013; runner 12/12; audit policy 11/11.
- Complete real-control Playwright suite 33/33, including all eight PDF cases.
- Responsive DNS imports/edits: 12/12 combinations across both identity modes,
  three viewports, and both themes, with literal values and keyboard recovery.
- Responsive HCI/disaggregated reports: 12/12 combinations, including Print
  Friendly and its inverse. Scope contrast is 19.26:1 or better.
- Actual rasterized fabric labels: 2954 foreground pixels, 12.92:1 contrast.
- JavaScript, HTML, CSS lint, whitespace, and CI PowerPoint package smoke passed.
- Live dependency audit passed after one configured-feed HTTP 429 retry.
- Rendered What's New includes the updated hardening and palette coverage.

Earlier full runs exposed the light-theme contrast defect and a transient PDF
iframe capture race; both are fixed without relaxing assertions. A separate
Welcome/Skip startup timeout passed in isolation and the final complete run.
Shared-browser viewport emulation was unreliable, so responsive checks used
isolated Playwright with assertions on actual viewport dimensions; integrated
browser checks covered reset, DNS editing, and the rendered release summary.

These are affected-path reruns, not a replacement claim for both complete release
matrices recorded earlier in PR #312. Fresh exact-head CI and any required human
approval remain prerequisites for the maintainer's manual merge.
