# iSCSI external-SAN GA/Preview signalling (DA1 + Sizer)

## Current state
Microsoft has published external storage array (SAN) attach for Azure Local (build
`azloc-2605`, requires Azure Local **version 2604 or later**):

- **Fibre Channel** — Generally Available (GA).
- **iSCSI** — Public Preview.
- Supported SAN matrix (`concepts/san-requirements`): Dell PowerStore, Pure Storage
  FlashArray, Hitachi VSP One / VSP 5x00 / Exx90 / Fxx0 / Gxx0, HPE Alletra MP 10000,
  NetApp AFF/ASA/ONTAP, Lenovo ThinkSystem DS/DM/DG. All listed arrays support both
  FC and iSCSI.

In ODIN today:
- Designer **DA1 (Storage Type)** badges *both* iSCSI cards "Coming Soon" plus a
  "⚠️ Feature not available yet" note — purely cosmetic (no `pointer-events` gate).
  The wizard logic in `js/disaggregated.js` already fully implements iSCSI (4-NIC and
  6-NIC), and the Sizer already exposes the same three storage types ungated.
- No GA/Preview signalling, no version-requirement note, no supported-SAN reference
  anywhere in the UI.

This contradicts the now-published guidance (iSCSI = Preview, not "coming soon").

## Change
Presentation/content only — no JS logic, no schema changes, no new workload types.

- **DA1 cards** (`index.html`): both iSCSI cards → `Preview` badge; remove the
  "Feature not available yet" notes. The Fibre Channel card is left unbadged
  (GA is the default state — no badge by request).
- **DA1 availability note** (`index.html`): static note under the options grid —
  iSCSI flagged as Preview, requires Azure Local 2604+, plus a collapsible
  supported-SAN-arrays list with links to MS Learn.
- **Sizer Storage Connectivity row** (`sizer/index.html`): same one-line GA/Preview +
  2604+ note under the dropdown.
- **CSS** (`css/style.css`): new `.preview-badge` (purple) class +
  `.option-card.selected` right-offset, and a `.da1-san-note` block (with green
  `.preview-tag` inline text). Added after the
  private-path-preview region; colours from existing `--accent-purple` /
  `--success` variables.

## Files touched
- `index.html` — DA1 cards + availability note; version string.
- `css/style.css` — new badge + note classes.
- `sizer/index.html` — storage-connectivity note; version string.
- `js/script.js` — `WIZARD_VERSION` bump.
- `js/changelog.js` — new What's-New block.
- `CHANGELOG.md`, `README.md` — release notes + version bump.

`SIZER_VERSION` is **not** bumped (export shape unchanged). No JSON-schema change
(storage types `fc_san` / `iscsi_4nic` / `iscsi_6nic` already exist).

## Out of scope
Hyperconverged "S2D + SAN attach" hybrid deployment type — excluded by request
(post-deployment pattern on hyperconverged; not a deployment-design decision ODIN
drives today).

## Implementation order
1. CSS badge/note classes.
2. DA1 card + note edits.
3. Sizer note.
4. Version bump across all stamp sites + release notes.
5. Lint + html-validate + full test suite; user validates locally before commit/PR.

## Open questions
None blocking. Vendor list intentionally summarised (not a full per-model table) to
stay mobile-friendly; links point to the authoritative MS Learn pages.
