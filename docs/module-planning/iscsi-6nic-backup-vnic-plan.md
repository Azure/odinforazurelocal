# iSCSI 6-NIC + backup — customer-managed Backup vNIC on Mgmt+Compute SET

Status: **implemented — validated locally (1404 tests passing)**. Target branch: `Release`.

## Current state (before this change)
When In-Guest Backup was enabled on a 6-NIC iSCSI disaggregated cluster, the host-networking
diagrams built a `ClusterBackupSwitch` SET on NIC3/NIC4 (the cluster NICs) and trunked the
Backup VLAN over it, drawing the Cluster 1/Cluster 2 and Backup vNICs on top of that SET.

## Problem
That topology is incorrect. The agreed design is: on 6-NIC iSCSI, NIC3/NIC4 stay as
**standalone Cluster 1/2** networks (identical to the no-backup 6-NIC layout). When backup is
required, the **customer manually adds a Backup vNIC (VLAN 800) on top of the existing
Management + Compute ATC vSwitch** (OCP-NIC1/NIC2). No extra NICs, no ClusterBackupSwitch.

## Change
- Backup vNIC (VLAN 800, orange) is drawn on the Mgmt + Compute SET as a customer-managed vNIC.
- NIC3/NIC4 render as standalone Cluster 1/2 in all cases (backup on/off).
- iSCSI stays on dedicated NIC5/NIC6 (PCIe2), standalone — unchanged.

## Files touched
- `js/disaggregated.js` — wizard host-networking preview, DA1/DA2 text, intent zones,
  port-count/port-list layouts, QoS notes.
- `report/report.js` — 2-node report host-networking diagram (mirrors the wizard).
- `index.html` — DA8 intent-section help text.
- `tests/index.html` — the DA8 6-NIC+backup suite now asserts NO `ClusterBackupSwitch`,
  presence of the customer-managed Backup vNIC legend line, and standalone Cluster 1/2.
- Release notes: `js/changelog.js`, `CHANGELOG.md`, `README.md` (0.22.70).

## Notes / decisions
- No JSON-schema change — no state-shape change (backup is derived from existing
  `disaggBackupEnabled` + `disaggStorageType`).
- Backup is a note/badge on the SET, not a draggable intent zone.
- `mgmtBackupVnic` condition = `storageType === 'iscsi_6nic' && backupEnabled`.
