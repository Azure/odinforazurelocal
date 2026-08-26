# Azure Local catalog refresh plan (August 2026)

## Comparison scope

- Compared the committed 2026-05-12 catalog snapshot with the live public
  catalog API on 2026-08-26 using
  `node scripts/catalog-gap-check.js --live --json`.
- Used the repository's anonymous POST client. The committed snapshot was not
  updated during this review.
- Cross-checked catalog-only GPU claims against the current Azure Local GPU
  preparation and AKS Arc GPU support tables. Catalog presence is treated as
  OEM hardware evidence, not automatic software-support evidence.
- Live catalog size increased from 24 platforms / 42 configurations to
  30 platforms / 53 configurations (12 configurations added, one replaced).

## Comparison findings

### GPU

- New catalog tokens: NVIDIA H100 NVL and H200 NVL.
- Both appear on the DataON AZL-8208i Intel Xeon 6 platform in two
  configurations: one hyperconverged and one Fibre Channel SAN/disaggregated.
- Both are listed under `gpuDda` only. Neither is listed under `gpuP`.
- The current Microsoft Learn Azure Local and AKS Arc support matrices do not
  list H100 NVL, H200 NVL, or A100.
- A100 remains in eight catalog configurations but remains intentionally absent
  from current Sizer choices.
- The gap checker currently merges DDA and GPU-P tokens into one catalog GPU
  set. That loses assignment-mode evidence and enabled the earlier A100
  overreach.
- The existing A100 design-exception matcher expects an exact single-GPU gap.
  Once H100 NVL and H200 NVL appear in the same gap string, A100 is no longer
  partitioned into its known exception.

Decision: do not add H100 NVL, H200 NVL, or A100 to the Sizer from catalog
evidence alone. Revisit each model only after the applicable Microsoft Learn
support table documents its workload and assignment mode.

### CPU

- The HPE ProLiant DL145 Gen11 5th Gen AMD EPYC configuration now includes an
  84-core-per-socket option.
- The Sizer's standard 5th Gen EPYC (Turin) list omits 84 cores. Turin Dense
  starts at 96 cores, so 84 belongs only to the standard Turin generation if
  validated.
- No new CPU generation appeared. All other catalog core counts remain covered
  by existing Sizer generation options.

### Memory and processor ceilings

- The catalog maximum remains 8 TB RAM per machine; the Sizer remains capped at
  4 TB.
- The current design-exception rationale says 6 TB / 8 TB would exceed
  documented Azure Local guidance. Current system requirements now document a
  24 TB RAM-per-host maximum for disaggregated deployments, so that rationale
  needs revalidation.
- Current system requirements also cap disaggregated hosts at 512 logical
  processors. The Sizer permits dual-socket 192-core CPUs; the interaction
  between physical cores, SMT, and the 512-logical-processor ceiling must be
  checked before extending CPU choices.
- Current guidance caps GPU memory at 192 GB per machine. Any future H100 NVL or
  H200 NVL proposal must validate model VRAM and per-machine quantity against
  that ceiling.

### Other catalog dimensions

- Storage maxima are unchanged: 40 capacity drives and four cache drives per
  machine. Current Sizer count limits cover these values.
- No new material capacity-drive or cache-drive size appeared outside the
  existing curated-size exceptions.
- NIC speeds remain 25 and 100 Gbps. A new `None` RDMA value comes from SAN-only
  configurations and does not require a Sizer hardware input.
- Form factors remain Rack and Rugged; architectures remain Hyperconverged and
  Disaggregated; capability categories remain DisconnectedOperations,
  AIWorkloads, and M365Local.
- Three Lenovo V4 platform records changed maximum scale from 16 to 64 alongside
  new SAN-only configurations. This is consistent with the existing 64-machine
  disaggregated model and does not establish a 64-machine hyperconverged limit.
- Several existing configurations gained Disconnected Operations or AI
  capability metadata. These changes do not alter Sizer hardware calculations.

## Proposed change

1. Make catalog GPU analysis assignment-mode aware:
   - report DDA and GPU-P coverage separately;
   - retain the originating platform/configuration for new GPU tokens;
   - emit one gap per normalized GPU and assignment mode;
   - match known exceptions by normalized GPU key instead of exact combined
     display text.
2. Add documentation-gated GPU review metadata so catalog-only models remain
   visible to maintainers without becoming selectable Sizer options.
3. Validate the 84-core Turin SKU against public HPE/AMD specifications, then
   add 84 only to `epyc-5th` if confirmed.
4. Reassess hardware ceilings against current Azure Local requirements:
   - decide whether 6 TB and 8 TB memory options should be available only for
     disaggregated designs;
   - enforce or clearly warn on the 512-logical-processor host ceiling;
   - retain the 192 GB GPU-memory-per-machine ceiling in future GPU reviews.
5. Refresh the committed catalog snapshot only after the comparison logic is
   mode-aware, then update focused tests and design-exception rationale.

## Files expected to change

- `scripts/catalog-gap-check.js`
- `tests/fixtures/catalog-snapshot.json`
- `tests/fixtures/CATALOG_API.md`
- `tests/index.html`
- `sizer/sizer.js` (only for validated CPU/memory/ceiling changes)
- `sizer/index.html` (only if memory choices or user-facing limit guidance change)
- `CHANGELOG.md`, `README.md`, and `js/changelog.js` for user-visible changes

No schema change is expected unless the exported Sizer state shape changes.
Adding dropdown values alone does not require a payload-version bump.

## Open questions

- Are H100 NVL and H200 NVL intended for unmanaged VM DDA only, or will Arc VM
  and/or AKS support be documented later?
- Does the DataON configuration impose a one-GPU-per-machine limit needed to
  remain below the documented 192 GB GPU-memory ceiling?
- Is the HPE 84-core entry a selectable 5th Gen EPYC SKU or catalog metadata
  representing enabled cores from a larger processor?
- Should memory choices above 4 TB be restricted to disaggregated deployments,
  even when an OEM hyperconverged catalog record advertises the hardware?
- Should the Sizer model SMT explicitly, or conservatively cap physical cores
  so the documented 512 logical processors per host cannot be exceeded?

## Implementation order

1. Add fixture-based tests for separate DDA/GPU-P extraction, per-GPU gaps, and
   exception partitioning with A100 plus H100 NVL/H200 NVL present together.
2. Refactor the catalog comparison and report while preserving snapshot-mode CI
   behavior.
3. Validate CPU and platform ceilings against public documentation and record
   decisions for each candidate.
4. Apply only confirmed Sizer option/limit changes with focused regression
   coverage.
5. Refresh the catalog snapshot, run the live/offline comparison, privacy scan,
   ESLint, HTML validation, and the complete test suite.