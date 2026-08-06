# Azure Migrate Collector Import Plan (Issue #274)

## Current state

- Sizer imports VMware inventories from RVTools `.xlsx` files through a dedicated
  tab in the shared Import Configuration dialog.
- Azure Migrate collector exports a ZIP containing machine configuration data for
  VMware and physical-mode discovery. Hyper-V guests are collected through the
  physical-server workflow because there is no Hyper-V offline collector mode.
- Sizer needs configuration-based capacity only. Performance-based assessment data
  is out of scope.

## Proposed change

- Add an **Azure Migrate** button and import tab that accepts the collector's original
  `Azure-Migrate-Discovery-YYYY-MM-DD-HH-MM-SS.zip` export.
- Read only `server/machinestatic.json` in the browser with the already-vendored
  JSZip library. Ignore every other ZIP entry.
- Convert discovered processor cores, allocated memory, and disk capacity into
  Sizer VM workloads.
- Default to privacy-preserving grouping by vCPU and memory. Offer an explicit
  per-machine mode that uses machine names only for workload labels.
- Offer provisioned or used disk capacity, defaulting to provisioned.
- Support full exports produced by on-demand or 24-hour continuous assessment.
  The collector's optional incremental export is out of scope because a standalone
  incremental does not contain the complete discovered estate. The payload has no
  verified mode marker, so the UI explicitly instructs users to retain the default
  full-collection option rather than attempting an unreliable heuristic.

## Security and privacy

- Do not commit collector exports, extracted records, customer names, hostnames,
  addresses, identifiers, logs, or derived customer-specific fixtures.
- Parse only the exact normalized `server/machinestatic.json` path and reject duplicate
  target entries, encrypted ZIPs, traversal-like paths, oversized files, oversized
  expanded entries, malformed JSON, excessive machine counts, and invalid capacities.
- Keep raw input in browser memory only and discard it after import or reset.
- Tests use obviously synthetic records and assert grouped mode does not retain names.

## Files touched

- `sizer/index.html` - Azure Migrate toolbar button, import tab, preview, and controls.
- `sizer/sizer.js` - lazy JSZip loading, secure ZIP extraction, pure machine transform,
  preview/apply/reset handlers, and import limits.
- `tests/index.html` - synthetic parser, transform, privacy, limit, and apply tests.
- `vendor/README.md` - note that Sizer also lazy-loads JSZip for collector import.
- `CHANGELOG.md` - user-visible feature entry.

## Confirmed compatibility

- Collector version `v20260727.1` is the verified baseline.
- Full ZIP export from 24-hour continuous assessment is supported.
- Incremental export is optional and disabled by default in the collector; it is not
  supported as a standalone Sizer source.
- No source preference was available for storage or workload grouping. V1 therefore
  defaults to provisioned capacity (conservative sizing) and grouped vCPU/memory bands
  (privacy preserving), while exposing used capacity and per-machine labels as options.

## Open questions

- Validate that VMware collector ZIPs use the same machine payload shape.

## Implementation order

1. Add pure conversion and validation helpers with synthetic tests.
2. Add lazy JSZip loading and strict extraction of the machine payload.
3. Add the Azure Migrate import tab, preview options, and apply/reset workflow.
4. Add changelog and vendored-library usage notes.
5. Run ESLint, HTML validation, the full test suite, and privacy scans.