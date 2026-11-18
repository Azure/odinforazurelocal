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

## Implementation order

1. Add failing regression coverage, then apply the architecture guard.
2. Update release metadata, notes, history, and version-policy exception.
3. Repeat the exact Playwright reproduction, inverse transitions, and outputs.
4. Run both complete release matrices and automated gates; report blocked checks.
5. Publish `Release` to `main` with `Fixes #309`; leave merging to a human.
