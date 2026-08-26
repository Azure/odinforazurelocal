# Sizer scaling release validation

## Current state

- Sizer scaling spans workload aggregation, hardware growth, machine-count
  recommendation, topology conversion, disaggregated rack balancing, and a
  later reduction pass.
- Unit and contract tests cover many individual rules, but release validation
  does not currently exercise every deployment and workload type through the
  browser as one integrated workflow.
- Recent end-to-end GPU testing found defects that isolated helper checks did
  not expose.

## Proposed change

- Exercise every deployment type and workload type through the localhost Sizer
  UI, including scale-up, scale-down, boundary, and mixed-workload scenarios.
- Record reproducible failures and add focused regression coverage before
  changing the controlling scaling path.
- Add a repository skill that defines the repeatable browser-driven release
  workflow, assertions, evidence, and required repository validation.

## Files touched

- `.github/skills/sizer-scaling-release-validation/SKILL.md`
- `docs/module-planning/sizer-scaling-release-validation-plan.md`
- `sizer/sizer.js` and `tests/index.html` only if stress testing exposes a
  reproducible product defect.
- Current-release notes if user-visible behavior changes.

## Open questions

- Browser stress testing exposed four multi-pass defects: an Agentic Retrieval
  default GPU below its own VRAM requirement, topology/rack scale recursion,
  stale disabled workload cards after resetting ALDO, and auto-managed GPU
  inventory remaining after the final GPU workload was removed.
- Stable helper boundaries receive browser-harness regression coverage. The
  repository skill retains the full UI matrix for integrated release testing.

## Implementation order

1. Map deployment/workload controls and define invariant assertions.
2. Run browser add, scale-up, and scale-down scenarios across the full matrix.
3. Reproduce and fix any defects with focused regression coverage.
4. Create and validate the repository skill from the proven workflow.
5. Run the complete release validation suite and document results.