# README Refresh Plan

## Current state

The root README mixes current product capabilities with low-level controls and
contains several stale claims. Historical release summaries have been moved to
`docs/version-history/README.md`, but no automated check prevents them from
accumulating in the root README again.

## Proposed change

- Rewrite the feature overview around the site's current user-facing tools.
- Correct verified workflow, export, privacy, compatibility, and import claims.
- Keep only the current release's What's New summary in the root README.
- Add a fail-fast test-runner guard that checks the current app version against
  the README and ensures older changelog releases exist in version history.

## Files touched

- `README.md`
- `docs/version-history/README.md`
- `scripts/run-tests.js`
- `docs/module-planning/readme-refresh-plan.md`

## Open questions

None. The current version remains sourced from `js/version.js`; historical
release coverage remains sourced from `CHANGELOG.md`.

## Implementation order

1. Add and exercise the release-history guard.
2. Refresh the README against current product behavior.
3. Validate links, Markdown diagnostics, lint, and the full test suite.