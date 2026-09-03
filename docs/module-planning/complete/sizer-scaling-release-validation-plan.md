# Sizer scaling release validation

## Current state

- Sizer scaling spans workload aggregation, hardware growth, machine-count
  recommendation, topology conversion, disaggregated rack balancing, and a
  later reduction pass.
- Unit and contract tests cover individual rules, while the completed browser
  matrix exercises every deployment and workload type as integrated workflows.
- Browser validation exposed multi-pass defects that isolated helper checks did
  not reveal; each received focused regression coverage.

## Proposed change

- Exercise every deployment type and workload type through the localhost Sizer
  UI, including scale-up, scale-down, boundary, and mixed-workload scenarios.
- Record reproducible failures and add focused regression coverage before
  changing the controlling scaling path.
- Add a repository skill that defines the repeatable browser-driven release
  workflow, assertions, evidence, and required repository validation.

## Files touched

- `.github/skills/sizer-scaling-release-validation/SKILL.md`
- `.github/copilot-instructions.md`
- `docs/module-planning/complete/sizer-scaling-release-validation-plan.md`
- `scripts/run-tests.js`
- `sizer/sizer.css`
- `sizer/sizer.js`
- `tests/index.html`
- Current release notes describing the integrated validation and fixes.

## Open questions

- None. The complete browser matrix and reusable release-validation skill now
  cover every deployment and workload type, scaling transitions, GPU capacity,
  growth, reset behavior, responsive layouts, themes, and accessibility.

## Validation findings

- Fixed an Agentic Retrieval default GPU below its own VRAM requirement.
- Fixed topology and rack scaling recursion across multi-pass recommendations.
- Cleared stale disabled workload cards after resetting ALDO.
- Removed auto-managed GPU inventory after the final GPU workload is deleted.
- Compacted Sizer navigation and power/rack output for phone viewports.
- Confirmed mixed-workload scale up/down, GPU capacity, future growth, reset,
  both themes, keyboard/dialog behavior, and 375 x 667, 768 x 1024, and
  1440 x 900 layouts through rendered controls.

## Implementation order

1. Map deployment/workload controls and define invariant assertions.
2. Run browser add, scale-up, and scale-down scenarios across the full matrix.
3. Reproduce and fix any defects with focused regression coverage.
4. Create and validate the repository skill from the proven workflow.
5. Run the complete release validation suite and document results.