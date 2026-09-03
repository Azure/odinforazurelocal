# AI Quality Findings Fast-Follow Plan

## Current state

- GitHub Code Quality reports five AI findings across outbound-connectivity documentation, shared notifications, and the S2D calculator.
- The outbound-connectivity table contains a malformed Arc Private Link icon.
- S2D shared-state field names are duplicated, and its UTF-8 Base64 helpers use deprecated browser globals.
- The S2D onboarding storage key identifies the tour revision rather than the application release, but that intent is not documented.
- Approved dependency PR #292 upgrades three GitHub Actions on `Release`, so the two-branch workflow carries those changes into this release PR.

## Proposed change

- Replace the malformed icon and remove the unused clipboard rejection parameter.
- Define S2D shared-state fields once with their control kind, then use that definition for validation and serialization.
- Replace deprecated UTF-8 Base64 conversion with `TextEncoder` and fatal `TextDecoder` handling.
- Document the independent onboarding-key revision policy without replaying the tour for existing visitors.
- Retain PR #292's immutable SHA pins while upgrading `actions/checkout` to 7.0.1, `actions/setup-node` to 7.0.0, and `actions/upload-artifact` to 7.0.1.
- Publish the fast follow as patch release 0.23.06 with synchronized release notes and focused regression coverage.

## Files touched

- `docs/outbound-connectivity/index.html`
- `.github/workflows/codeql.yml`
- `.github/workflows/test.yml`
- `js/notifications.js`
- `s2d-calc/s2d-calc.js`
- `tests/index.html`
- `js/version.js`
- `js/changelog.js`
- `README.md`
- `CHANGELOG.md`
- `docs/version-history/README.md`
- `docs/module-planning/complete/ai-quality-findings-fast-follow-plan.md`
- `docs/module-planning/complete/security-release-0.23.05-plan.md`

## GitHub Actions compatibility validation

- Every action remains pinned to a full immutable commit SHA.
- Jobs run on `ubuntu-latest` with the Node 24 action runtime enabled; `setup-node` continues to select Node 22 for ODIN scripts and tests.
- Existing action inputs are unchanged. The new `upload-artifact` direct-upload mode remains disabled, preserving the archived `test-results/` artifact behavior.
- PR #292 passed CodeQL, JavaScript, HTML, CSS, browser tests, dependency audit, test-result upload, and PowerPoint export smoke validation before merge.

## Open questions

- None. The onboarding key remains independent of `ODIN_VERSION` and is bumped only when the tour should replay.

## Implementation order

1. Apply the focused code and content fixes.
2. Add S2D state-shape and UTF-8 regression coverage.
3. Merge the approved grouped GitHub Actions update into `Release`.
4. Synchronize 0.23.06 release metadata and history.
5. Archive the shipped 0.23.05 security release plan.
6. Run lint, full tests, release-history validation, workflow checks, and targeted UI checks.
7. Commit, push `Release`, and open the `Release` to `main` pull request.