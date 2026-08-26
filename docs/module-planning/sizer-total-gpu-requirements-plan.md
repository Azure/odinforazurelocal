# Sizer total GPU requirements and Learn alignment

## Current state

- The VM workload dialog uses the same DDA GPU-count dropdown for Per VM and
  Total VM input modes.
- The dropdown is capped at the selected GPU model's per-machine limit, so
  Total VM mode cannot express an instance-wide requirement above four GPUs.
- Azure Local disaggregated instances support up to 64 machines. The maximum
  total GPU requirement is therefore 64 multiplied by the selected model's
  `maxPerNode` value (256 for four-GPU models; 128 for two-GPU models).
- GPU support and assignment capabilities must follow the current Microsoft
  Learn support matrix for both hyperconverged and disaggregated deployments.

## Proposed change

- Replace the workload DDA count dropdown with a numeric input.
- In VM Total mode, set its maximum to `64 * GPU_MODELS[gpuType].maxPerNode`.
- In VM Per-VM mode and other workload dialogs, retain the selected model's
  per-machine maximum.
- Validate the mode-aware maximum before saving so typed or imported values
  cannot bypass the HTML input constraint.
- Remove H100 from active Sizer model choices and the public schema enum.
- Separate Arc VM DDA and GPU-P capabilities, add A10 for GPU-P, remove A100
  from current choices, and use the same model matrices for both deployment
  topologies.
- Enforce one cluster-wide GPU-P partition size and add contextual Learn links
  for hardware preparation, DDA, GPU-P, and AKS GPU sizing.
- Preserve historical changelog and completed-plan references as release
  history rather than rewriting them.

## Files touched

- `sizer/index.html`
- `sizer/sizer.js`
- `tests/index.html`
- `docs/json-schema/odin-sizer.schema.json`
- `CHANGELOG.md`
- `README.md`
- `js/changelog.js`
- `js/version.js`
- `docs/version-history/README.md`

## Open questions resolved

- The existing `gpuDdaCount` payload field is mode-relative already: Total VM
  mode forces VM count to one, so the value is the aggregate GPU requirement.
  No payload-format version bump or new field is needed.
- Physical GPUs per machine remain model-dependent and are not raised to four
  for models whose supported maximum is two.
- Legacy H100 values are unsupported after this change and must not be offered
  by current UI or accepted by the current public schema.
- A100 remains recognized by the catalog gap checker but is a narrow design
  exception because it is absent from the current Learn support matrix.
- GPU-P partition options are planning estimates; deployments must confirm the
  valid counts reported by the installed Azure Local GPU fabric.

## Implementation order

1. Add focused tests for mode-aware DDA limits and the H100-free model list.
2. Implement the numeric input, dynamic maximum, and save validation.
3. Remove H100 from active Sizer UI/data and update the schema.
4. Align assignment capabilities, topology parity, and contextual Learn links.
5. Add the current-release changelog entry and run the full validation suite.