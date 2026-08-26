# Designer release validation

## Current state

- Static browser tests cover many Designer helpers and contracts, but do not
  exercise the branching wizard as a user through rendered controls.
- Scenario, architecture, networking, and output transitions mutate a large
  shared state object and can leave visible controls, derived state, and output
  readiness out of sync without failing isolated assertions.
- The Sizer browser stress pass demonstrated that integrated UI validation can
  find default, synchronization, recursion, and reset defects missed by the
  static suite.

## Proposed change

- Add a reusable Designer release-validation skill built around the real
  localhost UI, visible actions, state-transition invariants, output readiness,
  reset behavior, responsive layout, and keyboard access.
- Require the relevant Sizer or Designer skill for pull requests that change
  those workflows, both skills for cross-tool changes, and both full matrices
  during release-candidate validation.
- Keep lint and `node scripts/run-tests.js` as mandatory complementary checks.

## Files touched

- `.github/skills/designer-release-validation/SKILL.md`
- `.github/copilot-instructions.md`
- `docs/module-planning/designer-release-validation-plan.md`
- Current release notes describing the new integrated validation layer.

## Open questions

- None. Skills provide repeatable exploratory release validation; focused
  automated regressions remain required for every defect they expose.

## Implementation order

1. Define the scenario, architecture, transition, and output matrices.
2. Add browser interaction rules and visible consistency invariants.
3. Add proportional PR and complete release-candidate requirements.
4. Validate skill discovery, documentation links, privacy, and repository tests.