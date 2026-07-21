# Remove iSCSI SAN (4-NIC) disaggregated storage option

Status: **implemented — awaiting local validation** before commit to `Release`. Targeting release build 2607 / v0.22.70.

## Current state
The Disaggregated Designer offers three external-SAN storage types on **DA1**:
`fc_san`, `iscsi_4nic`, `iscsi_6nic`. iSCSI is Public Preview (Azure Local 2604+).
Build 2607 ships iSCSI support **6-NIC only** — the 4-NIC shared-fabric layout is
being pulled from the product for now.

## Change (hide-only, not a full code rip-out)
Decision (confirmed with owner): **hide the selectable option**, leave the deeper
`iscsi_4nic` handling code intact so any pre-release design that still carries the
value keeps rendering, and **remap `iscsi_4nic` → `iscsi_6nic` on every import path**.

- **Hide the option**
  - `index.html` — remove the DA1 `iscsi_4nic` option-card.
  - `sizer/index.html` — remove the `iscsi_4nic` `<option>` from the Storage
    Connectivity dropdown.
- **Remap legacy designs on load** (`iscsi_4nic` → `iscsi_6nic`)
  - `js/script.js` — `importConfiguration()` (JSON import), `loadStateFromLocalStorage()`
    (session resume), and the Sizer→Designer payload path.
  - `sizer/sizer.js` — `applyImportedSizerState()` (JSON import + Share-as-URL) and the
    two `d.disaggStorageType` restore paths (resume + Designer transfer).
- **Switch Config Quick Start** (`switch-config/`)
  - Remove the `disagg_iscsi` **Quick Start builder** profile entirely: drop the
    dropdown `<option>` in `switch-config/index.html`, the `case 'disagg_iscsi'` in
    `__buildQuickStartState`, and collapse the iSCSI branch in
    `preselectQuickStartFromDesigner` to fall back to `disagg_fc`.
  - **Keep** the generic `disagg_iscsi` **QoS profile/template** (qos-audit.js
    templates, the QoS-audit standalone dropdown, and the designer→profileKey maps) —
    it serves real 6-NIC iSCSI designs.

## Out of scope / deliberately left intact
- The `iscsi_4nic` branches in `js/disaggregated.js`, `report/*.js`, and the QoS
  profile mapping stay (hide-only). They are now unreachable via the UI but keep
  legacy state rendering correctly until a future full removal.
- **JSON schemas unchanged** — `iscsi_4nic` stays in the `disaggStorageType` enum of
  both `odin-sizer.schema.json` / `odin-design.schema.json`, because old exports still
  validate and the importer accepts-and-remaps the value. New exports never produce it.

## Files touched
- `index.html`, `sizer/index.html` — hide option + version string.
- `js/script.js` — 3 import remaps + `WIZARD_VERSION` bump.
- `sizer/sizer.js` — 3 import remaps.
- `switch-config/index.html`, `switch-config/switch-config.js` — remove QS iSCSI profile.
- `tests/index.html` — drop the two QS `disagg_iscsi` suites, add a remap-on-import test.
- `js/changelog.js`, `CHANGELOG.md`, `README.md` — release notes + version bump.

`SIZER_VERSION` **not** bumped (export shape unchanged).

## Implementation order
1. Hide DA1 card + Sizer dropdown option.
2. Import remaps (Designer + Sizer).
3. Remove Quick Start iSCSI profile + fix preselect.
4. Tests: remove QS iSCSI suites, add remap test.
5. Version bump + release notes.
6. Lint + html-validate + full test suite; owner validates locally before commit/PR.

## Open questions
None blocking.
