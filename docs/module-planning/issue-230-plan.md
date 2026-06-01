# ODIN — Planning Notes for Issue #230 (RVTools Excel import)

> **In-flight planning document.** Lives in `docs/module-planning/` and is
> committed to the repository so contributors and reviewers can see the
> intended design before the work lands. Once the work ships, move this
> file to `docs/module-planning/complete/`.
>
> Captured: 2026-05-22. Split out of the original `issues-230-232-plan.md`
> on 2026-06-01 when #232 was paired with #233 for the **0.21.55** release.
>
> **Target release:** a **separate, later PR** (its own version bump). #230 is
> **not** part of the 0.21.55 (#232 + #233) release — see
> [`issues-232-233-plan.md`](issues-232-233-plan.md).

---

## Issue #230 — RVTools Excel import

### Current state (verified in code)

- Import modal already has 2 tabs (Sizer JSON file, Azure Local machine JSON-paste).
  Adding a third tab is the cleanest UX.
- `workloads.push(...)` is the only entry point for new workloads; objects look like
  `{ type:'vm', name, vcpus, memory, storage, ... }`.
- The existing "X identical clusters" control is `#instance-count` — visual scale-out
  only, not an actual multi-cluster sizing.
- Repo policy: **no new third-party scripts on the live site without approval**. Excel
  reader must be vendored locally (no CDN).

### Multi-cluster handling

Sizer is single-cluster by design. Rather than rebuilding for asymmetric multi-cluster,
the importer will:

1. **Aggregate the RVTools import into one logical workload pool** (sum of all source
   VMs), then
2. **Let the user choose** at import time how to translate that pool into Azure Local
   clusters:
   - **(a) Single combined cluster** — all VMs sized into one Azure Local instance
     (likely large).
   - **(b) Per-source-cluster** — present a table of detected source clusters and let
     the user pick **one** to import this session. Sidebar lists the others with a
     "switch to cluster X" button.
   - **(c) Identical-cluster fan-out** — use the existing `#instance-count` Multi-Instance
     Scale-Out so the user can pick *a single representative source cluster* and project
     N copies of it.
3. Post-import banner explicitly states totals + the currently-selected target, e.g.:
   *"RVTools file contained X source clusters / Y hosts / Z VMs — currently sizing for:
   one selected cluster (H hosts, V VMs). Switch via Import → RVTools."*
4. See open question 4 on whether to ship all three options or trim to (b) + (c).

### RVTools schema (public, stable)

Standard "all" export has ~30 sheets. ODIN's importer reads **only** these columns:

| Sheet | Columns read | Used for |
|---|---|---|
| **`vInfo`** | `VM` (name — *not stored*), `Powerstate`, `Template`, `CPUs`, `Memory` (MiB), `Provisioned MiB`, `In Use MiB`, `Cluster`, `Host`, `Datacenter` | Per-VM workload pool |
| **`vCluster`** | `Name`, `Datacenter`, `# Hosts`, `# Effective CPU cores`, `# Effective Memory (MiB)`, `# VMs`, `# vCPUs`, `# vMemory (MiB)` | Per-source-cluster picker / summary banner |
| **`vHost`** *(optional)* | `Host`, `Cluster`, `# CPU`, `# Cores`, `# Sockets`, `CPU Model`, `Speed`, `# Memory (MiB)` | "Suggested Azure Local CPU generation" hint (best-effort match) |

Everything else (IPs, MACs, OS strings beyond presence, tags, custom attributes,
annotations, folder paths, network labels, datastore names, snapshot info, etc.) is
**ignored even if present**.

### Privacy stance (encoded into the importer)

1. VM names, hostnames, IP/MAC addresses, OS strings, datacenter / cluster names that
   are not strictly needed are **never read or stored**. Cluster names are held only in
   browser memory for the picker and **never persisted** into Sizer config.
2. Only **powered-on, non-template** rows imported by default (checkbox to include
   powered-off).
3. File is read entirely client-side (FileReader → SheetJS). No upload, no telemetry,
   no analytics event carrying column values — only an anonymous counter
   ("RVTools import used: 1").
4. Sensitivity-labelled / password-protected files: SheetJS open throws cleanly; the
   importer shows: *"This file is sensitivity-labelled or password-protected. Please
   save an unprotected copy (Excel → Save As → remove sensitivity label) and re-import."*
5. **Privacy note** at the top of the RVTools import tab:
   > 🔒 **Privacy:** All processing is performed entirely in your browser. Only
   > aggregate VM counts and per-VM CPU / RAM / storage values are read. VM names,
   > hostnames, IP/MAC addresses, OS strings, datacenter / cluster names, datastore
   > names, tags, custom attributes and annotations are **never read or stored**. No
   > data is transmitted to any external service.

### Excel parsing — dependency

Need a JS xlsx reader. Both Apache 2.0:

| Library | Size | Notes |
|---|---|---|
| **SheetJS Community (`xlsx.full.min.js`)** | ~890 KB minified | Industry standard. Vendored to `vendor/xlsx-0.20.x.min.js`. Loaded **only** on the Sizer page when the RVTools tab is opened (lazy `<script>` injection). |
| `exceljs` UMD | ~1.1 MB | Slightly heavier. |

Recommendation: **SheetJS**, vendored. See open question 3.

### UI / flow

1. New tab in the existing import modal: **📊 RVTools (VMware Inventory)**.
2. File picker (`accept=".xlsx"`) → reads file client-side (FileReader → SheetJS).
3. Privacy disclaimer block (see above).
4. **Detection preview**: totals (X source clusters, Y hosts, Z powered-on VMs, total
   vCPU, total RAM, total provisioned storage TB) + per-cluster table.
5. **Target choice** (radio): single combined / pick one source cluster / identical
   fan-out (see open question 4).
6. **VM consolidation strategy** (radio):
   - **One workload per VM** — verbatim, best fidelity, but unwieldy with 1,000+ VMs.
   - **Grouped by "VM template"** — heuristic: cluster VMs into bands by
     (round vCPU, round RAM GB) and create a single VM-group workload per band with a
     `count`. Matches the *Average VM Size* sidebar in RVTools summary views.
   - **One row per source cluster** (sum / avg) — coarsest, fastest.
   - See open question 5 on default.
7. **Storage**: use `Provisioned MiB` by default (worst-case planning), with toggle for
   "Use *In Use* instead" (right-sized planning). Convert MiB → GB.
8. **Memory**: from `Memory` column (MiB → GB).
9. **vCPU**: from `CPUs` column. **No overcommit applied at import** — the user's
   existing `vcpu-ratio` control then governs how many physical cores are needed.
10. After "Load" → close modal → workloads list populated → existing
    `calculateRequirements()` runs → user iterates as normal.

### Files touched

1. **`vendor/`** — new `xlsx-0.20.x.min.js` (vendored SheetJS) + line in
   `vendor/README.md`.
2. **`sizer/index.html`** — third tab (📊 RVTools) in the import modal + its panel
   (file picker + preview + radios). Lazy `<script>` tag injected on first open.
3. **`sizer/sizer.js`** — three new functions: `openRVToolsTab()`,
   `parseRVToolsXLSX(file)`, `applyRVToolsImport(parsed, options)`. They build workload
   objects and call the existing `workloads.push()` path. Banner integrated with the
   existing post-import banner.
4. **`sizer/sizer.css`** — minimal styling for the per-cluster picker table.
5. **`tests/index.html`** + **`tests/fixtures/`** — small synthetic RVTools fixture (a
   tiny SheetJS-shaped object built in-test). Cases: powered-off filter, template
   filter, MiB → GB conversion, vCPU sum, per-cluster grouping, "VM template" banding,
   malformed-file error path.
6. **`CHANGELOG.md` / version-bump fan-out / README "What's New"** — own version bump
   for the #230 PR (separate from the 0.21.55 #232 + #233 release).

### Out of scope for this PR

- True asymmetric multi-cluster sizing (one Sizer view representing N differently-sized
  clusters at once).
- Importing VMware host hardware specs directly into the Azure Local hardware shape
  (we can *suggest* CPU generation from `vHost` model strings but won't auto-apply).
- Mapping VMware datastores / RDMs into S2D layouts (workload-only translation).

---

## File handling notes

- A real RVTools export was inspected locally during planning (path redacted; file
  remained on the contributor's machine and was never committed).
- Detected as **MIP-encrypted** — first 4 bytes `D0 CF 11 E0` (OLE2 wrapper) containing
  `EncryptedPackage` + `DataSpaces` streams.
- **Did not decrypt**, did not read any cell data. Temp folders cleaned up.
- For implementation test fixture: use a fully synthetic / sanitised RVTools sample
  (5–10 fake rows in `vInfo` + a `vCluster` sheet). No real customer data ever enters
  the repo or working tree.
- Real-file paths and customer / source identifiers must **never** be referenced in
  committed code, comments, planning notes, or fixtures.

---

## Open decision questions (need answers before implementation)

1. **SheetJS vendoring** — OK to vendor `xlsx.full.min.js` (~890 KB, Apache 2.0) into
   `vendor/`? Only sensible way to read `.xlsx` in-browser without a CDN call.
2. **Multi-cluster UX** — keep all **three** target-choice radios (combined / pick-one /
   identical fan-out) or trim to just **pick-one + identical fan-out** for simplicity?
3. **Default VM consolidation** — default to **"Grouped by VM template"** (5–10 rows)
   for any import > 50 VMs, with "One per VM" behind an advanced toggle? Or always
   default to one-per-VM?
4. **Version bump / PR** — own patch/minor bump for the standalone #230 PR (decide at
   implementation time, after the 0.21.55 release has shipped).
