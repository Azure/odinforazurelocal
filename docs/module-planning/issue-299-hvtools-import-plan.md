# HVTools Import Plan (Issue #299)

## Current state

- Sizer imports VMware inventories from RVTools `.xlsx` workbooks through the
  **RVTools** tab of the shared Import Configuration dialog (issue #230).
- Hyper-V customers have no equivalent. [HVTools](https://github.com/michaelmsonne/HVTools)
  (MIT) is the community Hyper-V counterpart of RVTools.
- HVTools produces two relevant exports:
  - **Released (1.0 Alpha 1)** VM Overview export as JSON:
    `{ ExportInfo, VMData: [ { "VM Name", "CPU Count", "Memory Startup (MB)", ... } ], VMGroups }`.
    No cluster name and no provisioned disk size.
  - **Unreleased main branch** "Export all to Excel": `HVTools_export_all_<timestamp>.xlsx`
    with sheets `vInfo`, `vDisks`, `vHosts`, `vClusterNodes`, `vClusterVMs`, `vMetaData`, and others.
- HVTools writes every cell as a locale-formatted string (e.g. `12,50` on a comma-decimal locale).
- An HVTools workbook also has a `vInfo` sheet, but with different columns. The RVTools
  importer would silently find zero powered-on VMs.

## Decisions (resolved)

- **Shared UI**: rename the tab and toolbar button to **RVTools / HVTools**. One file picker
  accepts `.xlsx` and `.json` and auto-detects the source.
- **Memory**: use the larger of `Memory Startup (MB)` and `Memory Assigned (MB)` so dynamic-memory
  VMs are sized for their observed or configured footprint, whichever is higher.
- **Scope (v1)**: HVTools `.xlsx` "export all" workbook and the VM Overview `.json` export.
  CSV, XML, and TXT exports are out of scope.

## Column mapping (normalized into the RVTools row shape)

| RVTools field | HVTools source |
|---|---|
| `VM` | `vInfo`/`VMData` `VM Name` (read only in per-VM mode output) |
| `CPUs` | `CPU Count` |
| `Memory` (MiB) | max(`Memory Startup (MB)`, `Memory Assigned (MB)`) |
| `Powerstate` | `State` starting with `Off` → `poweredOff`; all other states (Running, Saved, Paused, ...) → `poweredOn` |
| `Provisioned MiB` | Sum of `vDisks` `Max Size (GB)` per VM (shared disks counted once); falls back to `Total Disk (GB)` |
| `In Use MiB` | Sum of `vDisks` `File Size (GB)` per VM; falls back to `Total Disk (GB)` |
| `Cluster` | `vHosts` `Cluster Name` for the VM's `Owner Node`, else `vDisks` `Cluster Name`, else `(no cluster)` |
| `Host` | `Owner Node`, else `vDisks` `Current Host` |

Rows with `Is Deleted` = true are skipped. HVTools has no templates.

## Security and privacy

- Detection: `vMetaData` has an `HVTools version` column, or `vInfo`/`VMData` rows carry
  `VM Name` + `CPU Count`.
- JSON files are capped by the existing 5 MB Sizer import limit. Both formats are capped at
  10,000 VM rows.
- Never read `ExportInfo.ExportedBy`, host OS/licensing/product keys, serial numbers, IP addresses,
  disk paths (except as a transient shared-disk dedupe key), notes, or VM groups.
- No fixtures from real environments. Tests use obviously synthetic names.

## Files touched

- `sizer/sizer.js` - HVTools detection, locale-tolerant number parsing, normalization, and file handling.
- `sizer/index.html` - tab, toolbar, panel copy, accepted file types, post-import copy.
- `tests/index.html` - synthetic detection, parsing, mapping, dedupe, fallback, and privacy tests.
- `CHANGELOG.md`, `README.md` - user-visible feature notes.

## Open questions

- HVTools is in alpha. Column names may change; confirm stability with the maintainer.

## Implementation order

1. Pure helpers plus tests.
2. File handling, detection, and preview/post-import copy.
3. Lint, HTML validation, full test suite, and a local UI walkthrough with a synthetic workbook.
