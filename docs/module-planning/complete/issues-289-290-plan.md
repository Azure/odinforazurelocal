# Switchless NIC Mapping And CIDR Allocation

## Current state

- Storage subnet autofill increments the third octet regardless of prefix.
- Report and ARM storage addressing discard the fourth octet and can allocate
  duplicate, out-of-subnet, or broadcast addresses for small subnets.
- Three/four-node report diagrams and draw.io exports assume default NIC roles.
- Designer already derives switchless links from confirmed adapter assignments.

## Proposed change

- Reuse full IPv4 subnet arithmetic for autofill and endpoint allocation.
- Keep existing host offsets where they fit; use both usable addresses for /30.
- Share switchless port/link topology across Designer, report, and ARM output.
- Preserve manual subnet values and Auto IP behavior; block invalid, overlapping,
  or undersized custom storage subnets.
- Make report diagrams, address listings, and editable downloads honor NIC names
  and assignments for supported two-, three-, and four-node switchless layouts.

## Files touched

- `js/utils.js`, `js/script.js`
- `report/report.js`
- `report/report.html` loads shared utilities before report rendering
- `tests/index.html`, `tools/scripts/test-switchless-networking.js`
- `CHANGELOG.md`

## Open questions

- None. Keep the existing export schema and /24 addressing where still valid.
- Do not introduce /31 or /32 storage networks, which lack the required two
  ordinary usable host addresses under the current validation model.

## Implementation order

1. Add and test subnet arithmetic and shared switchless topology.
2. Wire Designer autofill/readiness and ARM addressing to those helpers.
3. Correct report diagrams, address rows, and draw.io output.
4. Add regression coverage and release notes; run lint, the full test suite,
   and relevant localhost Designer workflows and export checks.

## Validation notes

- Main browser suite: 1,608 tests passed, including CIDR boundaries, overlap,
  manual-value preservation, and Designer-to-ARM endpoint assignments.
- `node tools/scripts/test-switchless-networking.js` requires localhost:5500
  and validates two-, three-, and four-node dual-link designs through rendered
  imports, subnet controls, preview confirmation, reports, SVG, draw.io,
  Markdown, and ARM. The four-node case also checks PowerPoint address content
  and phone-width layout/keyboard focus, Designer-to-Sizer handoff, and the
  switchless/switched/switchless reset transition.
- Legacy three-node single-link topology remains covered by model tests; the
  current Designer intentionally does not expose that retired UI choice.
- Existing first-run onboarding removes the Designer import modal. The browser
  regression reloads after dismissing onboarding before opening Import; this
  unrelated behavior is not changed by these fixes.

## Approved CI security unblock

- PR #296 exposed GHSA-2883-xcg3-v3hh in the existing development-only
  `js-yaml` 4.3.1 dependency, blocking the required Dependency Audit check.
- Scope extension approved: raise the 4.x floor to 4.3.2 and regenerate the
  lockfile without adding an audit exception or upgrading to version 5.
- Files: `package.json`, `package-lock.json`, `.github/copilot-instructions.md`,
  `CHANGELOG.md`, and this plan.
- Order: update the override and lockfile, verify the audit, rerun lint/tests,
  push the additional fix to Release, and merge only after all PR checks pass.
- Open questions: none; patched 4.3.2 is available from the configured feed.

## PR review: ARM import round trip

- The importer currently reads one adapter IP per storage network and omits /30
  from its mask table, losing link subnets from newly generated ARM output.
- Read all endpoint records, validate contiguous IPv4 masks, and reconstruct
  switchless subnet order by node and adapter identity rather than address order.
- Preserve custom NIC names and manually ordered CIDRs; leave incomplete or
  inconsistent link addressing unconfirmed instead of guessing.
- Files: `js/script.js`, `tests/index.html`, browser regression script, and notes.
- Order: importer correction, generated-ARM round-trip tests, real file-picker
  import check, full validation, then resolve the PR comment before merging.
- Open questions: none.
- Outcome: all supported dual-link UI paths retain every /30 subnet and storage
  adapter after generated-ARM import. Model tests also preserve manually ordered
  CIDRs with shuffled ARM records and reject non-contiguous subnet masks.