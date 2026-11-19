# Issue 309: Disaggregated Node Settings

## Current state

- Playwright reproduces lost node IPs and names in Disaggregated Static IP
  designs with 3 and 16 nodes; the 18-node control retains them.
- `updateUI()` applies hidden HCI node-chip constraints even though
  Disaggregated derives its node count from DA3 and leaves `scale` unset.
- A matching disabled chip clears `nodes` and `nodeSettings`.

## Proposed change

- Skip the HCI node-chip callback for Disaggregated architectures.
- Preserve existing HCI/rack-aware/disconnected constraints without changing
  imports, payload shape, or the independent Sizer payload version.
- Add focused rendered-page regressions for 3, 16, and 18 nodes, including
  sequential addressing and ownership of manually edited names.
- Prepare the explicitly requested `0.23.08` targeted release for issue #309.
  Treat this as the final legacy-numbered exception; defer CalVer to the next release.
- Roll the prior README summary into version history and update all release
  surfaces plus the Designer schema's version description.

## Files touched

- `js/script.js`, `tests/index.html`
- `js/version.js`, `js/changelog.js`, `README.md`, `CHANGELOG.md`
- `docs/version-history/README.md`, `docs/json-schema/odin-design.schema.json`
- `CONTRIBUTING.md`, `.github/copilot-instructions.md`,
  `.github/skills/release-readiness/SKILL.md`
- This plan

## Open questions

- None. The maintainer explicitly requested version `0.23.08`.

## Release validation hardening

- Add a permanent Playwright real-control suite to CI alongside file/HTTP
  coverage. Test actual edits after template loading, boundary/inverse topology
  transitions, first-use Help followed by Import without reload, and keyboard
  focus containment/restoration. Do not seed application state in these tests.
- Limit Designer guide cleanup to its own generated overlay. Preserve static
  Import markup across welcome and Knowledge Help rendering/dismissal.
- Preserve the Sizer guide's content and preferences while adding dialog
  semantics, initial/step focus, bidirectional Tab containment, top-dialog
  Escape handling and trigger-focus restoration.
- Apply the same keyboard ownership to Designer welcome/Knowledge Help.
  Escape must hide, never destroy, the static Import chooser.
- Complete the remaining networking, IP validation, import rejection, handoff,
  ARM/Report help/header/download and responsive release scenarios.
- Trace malformed SVG diagnostics to their source; fix the source rather than
  generated assets. Inspect synthetic HCI and Disaggregated decks in native
  PowerPoint separately from package-generation checks.
- Keep this work in 0.23.08 and the existing draft Release-to-main PR. Update all
  three current release-note surfaces; do not silently waive incomplete checks.

Additional files: `scripts/ui-regressions.test.js`, `package.json`,
`.github/workflows/test.yml`, `sizer/sizer.js`, and `CONTRIBUTING.md`.
Any export-source changes depend on the reproduced SVG diagnosis.
The output matrix also reproduced a Disaggregated PDF canvas-taint failure.
Reuse Report's existing SVG rasterizer in the PDF capture clone; preserve the
live report and surface rasterization failures instead of omitting diagrams.

## PR review follow-up

- Cover Disaggregated PDF export through actual `file://` controls; the earlier
  offline PDF smoke covered only HCI.
- Package the four external Disaggregated SVGs as a generated classic-script
  asset for offline PDF preparation. Keep the SVG files authoritative, check
  bundle/source parity, and continue using the existing sanitizer.
- Preserve the active report palette and background together in PDF capture,
  including light and Print Friendly modes. Check rasterized diagram contrast
  and actual downloads in both themes over HTTP and `file://`.
- Preserve authored backgrounds for standalone SVGs with fixed pale labels and
  links; extend actual rasterized-output checks to the external fabric diagram,
  not only the theme-aware host diagram.
- Update the same release notes and reply to both review threads with evidence.

## Implementation order

1. Add failing regression coverage, then apply the architecture guard.
2. Update release metadata, notes, history, and version-policy exception.
3. Repeat the exact Playwright reproduction, inverse transitions, and outputs.
4. Run both complete release matrices and automated gates; report blocked checks.
5. Publish `Release` to `main` with `Fixes #309`; leave merging to a human.
