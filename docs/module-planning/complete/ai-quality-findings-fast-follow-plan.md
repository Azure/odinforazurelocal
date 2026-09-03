# AI Quality Findings Fast-Follow Plan

## Current state

- GitHub Code Quality reports five AI findings across outbound-connectivity documentation, shared notifications, and the S2D calculator.
- The outbound-connectivity table contains a malformed Arc Private Link icon.
- S2D shared-state field names are duplicated, and its UTF-8 Base64 helpers use deprecated browser globals.
- The S2D onboarding storage key identifies the tour revision rather than the application release, but that intent is not documented.

## Proposed change

- Replace the malformed icon and remove the unused clipboard rejection parameter.
- Define S2D shared-state fields once with their control kind, then use that definition for validation and serialization.
- Replace deprecated UTF-8 Base64 conversion with `TextEncoder` and fatal `TextDecoder` handling.
- Document the independent onboarding-key revision policy without replaying the tour for existing visitors.
- Publish the fast follow as patch release 0.23.06 with synchronized release notes and focused regression coverage.

## Files touched

- `docs/outbound-connectivity/index.html`
- `js/notifications.js`
- `s2d-calc/s2d-calc.js`
- `tests/index.html`
- `js/version.js`
- `js/changelog.js`
- `README.md`
- `CHANGELOG.md`
- `docs/version-history/README.md`
- `docs/module-planning/complete/ai-quality-findings-fast-follow-plan.md`

## Open questions

- None. The onboarding key remains independent of `ODIN_VERSION` and is bumped only when the tour should replay.

## Implementation order

1. Apply the focused code and content fixes.
2. Add S2D state-shape and UTF-8 regression coverage.
3. Synchronize 0.23.06 release metadata and history.
4. Run lint, full tests, release-history validation, and targeted UI checks.
5. Commit, push `Release`, and open the `Release` to `main` pull request.