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

## Implementation and validation outcome (e9e6c48)

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

## Keyboard-focus follow-up

PR #312 now has a separate accessibility finding: invalid Custom disk inputs
keep the same red border on keyboard focus while their outline is disabled.
Reproduced with blank/zero capacity and blank cache inputs through real controls.

- Add a distinct outline only to invalid disk inputs matching `:focus-visible`.
  Keep the validation border and valid-input styling unchanged.
- Extend the existing disk regression for single-tier capacity, cache, and
  tiered capacity. Check actual keyboard focus, a visible outline, and the
  unchanged error border.
- Touch `sizer/sizer.css`, `scripts/ui-regressions.test.js`, current release
  summaries, and this plan. No version, payload, schema, or formula changes.
- Run focused Sizer UI/keyboard checks in both themes and responsive sizes,
  plus lint, file-mode, HTTP, runner, and whitespace gates before pushing.

### Keyboard-focus validation outcome

- Focused Sizer disk regressions passed 4/4, including blank/zero invalid
  inputs, preset recovery, hardware import, JSON round-trip, and Designer handoff.
- Integrated-browser keyboard checks passed 6/6: all three Custom input kinds
  in both themes at an actual 1280 x 900 viewport.
- Isolated Playwright checks passed 18/18 across 375 x 667, 768 x 1024, and
  1280 x 900, both themes, and all three input kinds. Actual Tab focus showed
  a 2 px blue outline while retaining the red validation border; the outline
  fit the viewport. Corrected values restored S2D guidance and unchanged
  valid-input focus styling. Reset returned to Hyperconverged/two machines
  with no workloads.
- The rendered current What's New summary includes the keyboard-focus fix.
- JavaScript, HTML, and CSS lint passed. File-mode tests passed 1729/1729,
  HTTP tests 2013/2013, runner tests 12/12, and whitespace checks passed.
  Responsive browser diagnostics recorded no page errors, console errors,
  failed same-origin requests, or failed same-origin responses.
- The complete 33-test UI/PDF run remains the earlier `e9e6c48` evidence.
  It was not repeated for this focused CSS-only follow-up.
- Reply with completed evidence and resolve only the addressed focus thread.

No open design questions. The reproduction comment precedes implementation;
validation precedes commit/push, and a human performs any PR merge.
