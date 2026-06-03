# Sizer — Microsoft 365 Local plan

Status: **proposal / not started** — awaiting maintainer decision on scope before coding.
Originally part of `sizer-foundry-ghel-m365-plan.md`; split out once the
Foundry-refresh and GHEL portions shipped in v0.22.62
(see [`complete/sizer-foundry-refresh-and-ghel-plan.md`](complete/sizer-foundry-refresh-and-ghel-plan.md)).

## Why

Microsoft 365 Local was announced for Azure Local as part of the same Build 2026
sovereign-AI / sovereign-productivity wave. It already exists in ODIN's
**reference-architectures** (Knowledge tab) but is not surfaced in the **Sizer**.
This plan captures the options for adding it.

## Constraints

- M365 Local is a **fixed multi-cluster topology** (Exchange / SharePoint /
  Skype / SQL) rather than a free-sized workload. It does **not** map onto the
  per-workload "add N of these" model as naturally as VMs / AKS / Foundry / GHEL
  do.
- User has indicated they will provide the two product images needed for the
  tile / modal.

## Options

### (A) Full Sizer workload with fixed preset bundles

- Add as a Sizer workload type with **Small / Medium / Large** preset bundles
  that mirror the reference-architecture variants.
- Each preset would size all four roles (Exchange / SharePoint / Skype / SQL)
  as a combined per-instance footprint that participates in the cluster
  roll-up.
- **Higher effort** — needs a real M365-Local sizing source (per-role vCPU /
  RAM / storage figures per preset tier), proper tests for the bundle math,
  and decisions about whether the bundle counts as one workload or one
  workload per role in the export shape.
- Would likely bump `SIZER_VERSION` again (new workload payload shape).

### (B) Button that links out to the M365 Local reference architecture (RECOMMENDED for v1)

- Add a workload-type tile that, instead of opening a sizing modal, **redirects
  to the M365 Local reference architecture** + Learn docs — consistent with how
  the legacy Designer handled the M365 Local redirect.
- No sizing math, no roll-up impact, no `SIZER_VERSION` bump.
- **Low effort** — just the new tile, icon, tooltip, and link target.
- User still gets a visible entry point for M365 Local in the Sizer, with the
  reference architecture as the authoritative sizing source.

## Recommendation

**Start with (B)** unless the maintainer specifically wants full sizing in v1.
(B) ships the discoverability win immediately; (A) can come later if there is
demand and a published per-tier sizing source.

## Decision needed before coding

1. **(A) vs (B)** — full preset workload or link-out tile?
2. Confirm the two M365 Local product images the user is providing (filenames /
   format / which goes on the tile vs the modal).
3. Target link for option (B): the M365 Local reference architecture page in
   this repo, the Microsoft Learn doc, or both?

## Files that would be touched (either option)

- [`sizer/index.html`](../../sizer/index.html) — new workload-type tile, tooltip,
  empty-state legend entry, icon reference.
- [`sizer/sizer.js`](../../sizer/sizer.js) — tile click handler (A: open modal;
  B: open link); `WORKLOAD_DEFAULTS.m365` only if option A.
- [`sizer/sizer.css`](../../sizer/sizer.css) — `.workload-icon.m365` styling.
- `images/` — the two M365 Local icons (user-provided).
- For option A only: preset table constant, `getM365LocalModalContent()`,
  save/restore/summary handling, roll-up inclusion, tests, version bumps in
  README / CHANGELOG / `index.html` / `sizer/index.html` and `SIZER_VERSION`.

## Cross-surface notes

- M365 Local is not AKS-hosted — keep it out of `AKS_HOSTED_WORKLOAD_TYPES` and
  the homogeneous-GPU validator.
- Designer ↔ Sizer: if option (B), no Designer coupling required. If option (A),
  decide whether *Configure in Designer* should carry the bundle across (likely
  yes — same as VM/AKS workloads do today).
- If option (B), confirm the redirect UX with the user (open in same tab vs new
  tab; toast confirmation; or a one-line in-page note in lieu of a modal).
