# Issue 295 ARM Deployment Workflow Plan

## Current State

ODIN generates a parameters file for Microsoft's Azure Local Quickstart
template. The template intentionally requires two resource-group deployments:
first `deploymentMode=Validate`, then `deploymentMode=Deploy` against the same
resource group and cluster name.

The ARM page does not explain that distinction clearly. Its generated CI/CD
workflows use `az deployment group validate` for the first phase, which checks
ARM syntax but does not create the cluster resource required by the Deploy
phase.

## Proposed Change

- Keep the Microsoft Quickstart template and ODIN's Validate default unchanged.
- Explain the two real deployment phases and distinguish ARM preflight/What-If
  from Azure Local Validate mode.
- Provide separate Validate and Deploy parameter-file downloads.
- Generate PowerShell and Azure CLI scripts with an explicit phase argument.
- Generate manually triggered Azure DevOps and GitHub workflows with distinct
  Validate and Deploy paths and a parent-cluster check before Deploy.
- Add regression coverage for parameter modes and generated command semantics.

## Files Touched

- `arm/arm.html`
- `arm/arm.js`
- `arm/deployment-workflow.js`
- `tests/index.html`
- `CHANGELOG.md`

## Open Questions

- None. The upstream resource condition is intentional and must not be changed.

## Implementation Order

1. Add and test pure deployment-workflow builders.
2. Connect downloads and script generators to the builders.
3. Update portal guidance and controls.
4. Run focused lint/tests, then full repository and real-UI validation.