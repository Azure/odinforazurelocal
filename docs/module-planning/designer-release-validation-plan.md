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

- The wizard's legacy option cards and node chips are pointer-operable generic
  elements rather than native buttons. A future accessibility pass should make
  the shared card/chip interaction keyboard-operable without changing selection
  behavior across the full wizard.

## Validation findings

- Fixed completed disaggregated reports using HCI-only Scale, Storage, Ports,
  and Intent fields. HTML validation, Decisions & Rationale, Markdown, and Word
  content now use the authoritative SAN topology and adapter configuration.
- Fixed the Example Configuration Templates overlay so it is a named modal,
  exposes template choices as buttons, traps focus, closes with Escape, labels
  its close control, and restores focus to the trigger.
- Preserved report parity across formats: Markdown and PowerPoint now include
  workflow provenance, Markdown carries Sizing Notes, PowerPoint paginates all
  bounded notes, and every `Advisory - ...:` heading keeps its visual treatment.
- Persisted the Infrastructure IP Pool auto-ending marker so restored designs
  continue recalculating derived endings while manual overrides remain fixed.
- Confirmed Connected HCI, Connected disaggregated, disconnected management,
  disconnected workload, Connected rack-aware, Multi-Rack stop-flow, and
  Microsoft 365 Local stop-flow behavior through rendered controls.
- Confirmed HCI/disaggregated inverse transitions clear incompatible state,
  rack-aware and disaggregated reports have zero validation warnings, and the
  Sizer handoff applies once without overwriting later Designer edits.
- Confirmed the modified dialog at 375 x 667 and 768 x 1024 in both themes with
  no horizontal overflow.

## Implementation order

1. Define the scenario, architecture, transition, and output matrices.
2. Add browser interaction rules and visible consistency invariants.
3. Add proportional PR and complete release-candidate requirements.
4. Validate skill discovery, documentation links, privacy, and repository tests.