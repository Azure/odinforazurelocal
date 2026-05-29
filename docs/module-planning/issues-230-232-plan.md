# ODIN — Planning Notes for Issues #230 and #232

> **In-flight planning document.** Lives in `docs/module-planning/` and is
> committed to the repository so contributors and reviewers can see the
> intended design before the work lands. Once the work ships, move this
> file to `docs/module-planning/complete/`.
>
> Captured: 2026-05-22.
> Target release: next ODIN version (TBD — see open question 6).

---

## Issue #232 — Improve host compute reserve / overhead calculations

### Current state (verified in code on `Release` branch)

| Aspect | Today |
|---|---|
| Host **memory** overhead | Flat `hostOverheadMemoryGB = 32` (+ `ALDO_APPLIANCE_OVERHEAD_GB` when `cluster-type === 'aldo-mgmt'`). Hard-coded at ~8 sites in `sizer/sizer.js`: node-count recommendation, auto-scale loop, capacity bars, growth projection, headroom while-loops, per-VM "exceeds node" check, and the sizing note itself. |
| Host **CPU** overhead | **None.** vCPU capacity = `cores × (N−1) × ratio − ARB_VCPU_OVERHEAD`. No parent-partition reserve. |
| S2D cache metadata (4 GB/TB) | Already mentioned in Sizing Notes ("ℹ️ Storage Spaces Direct metadata… Not included in workload memory calculations"). Informational only — not subtracted from capacity. |
| Sizing Notes UI | `<ul id="sizing-notes">` in `sizer/index.html`; populated by `updateSizingNotes()` in `sizer/sizer.js`. Flat list, no collapsed sections. |

### Proposed model

**Memory reservation per node = base infra floor + S2D-cache metadata + management add-ons**

| Component | Default | Driven by |
|---|---|---|
| Parent partition OS + Hyper-V + agents (infra floor) | **16 GB** | always |
| S2D / SBL / ReFS metadata | **4 GB × cache TB per node** | tiered storage only (`hwConfig.diskConfig.isTiered && cache`) |
| ARB appliance VM (already modelled) | `ARB_MEMORY_OVERHEAD_GB` per **cluster** (unchanged) | always |
| AKS hybrid management add-on | **+8 GB / node** | new toggle (default off) |
| SDN / Network Controller add-on | **+12 GB / node** | new toggle (default off) |
| ALDO appliance | unchanged (`ALDO_APPLIANCE_OVERHEAD_GB`) | `aldo-mgmt` cluster type |

- Minimum **16 GB** reservation.
- Optional soft warning if computed reservation < 24 GB on Arc-enabled deployments.
- Default path (all-NVMe, no SDN, no AKS) → 16 GB (less than today's 32 GB) → may shrink recommended nodes by 1 in some memory-bound all-NVMe cases. See open question 1.
- Hybrid w/ 4 × 3.2 TB cache → 16 + 4 × 12.8 = ~67 GB (more accurate, larger than today).

**CPU reservation per node = max(percentage, physical-core floor)**

| Cluster profile | Reservation |
|---|---|
| Small / Low-Capacity, all-flash, no add-ons | `max(10%, 1 core)` |
| Standard (default) with ARB | `max(15%, 2 cores)` |
| All-NVMe + SDN and/or AKS | `max(20%, 2 cores)` |
| ALDO-mgmt | `max(20%, 2 cores)` |
| Heavy / latency-sensitive (optional toggle) | `max(20%, 4 cores)` |

Becomes a new helper `getHostCpuReservedCores(hwConfig, clusterType, addons)` → applied
in `getRecommendedNodeCount`, `autoScaleHardware` (vCPU branch), the capacity-bar block,
headroom loops, and the per-VM "exceeds node" check. vCPU available per node becomes
`(physicalCores − getHostCpuReservedCores(...)) × vcpuRatio`.

### Files touched

1. **`sizer/sizer.js`** — two new helpers near the top:
   ```js
   function getHostMemoryReservedGB(hwConfig, clusterType, addons) { … }
   function getHostCpuReservedCores(hwConfig, clusterType, addons) { … }
   ```
   Replace every literal `32` host-overhead site (see "Current state" table).
2. **`sizer/index.html`** — two optional toggles near cluster-type controls:
   `host-addon-aks` and `host-addon-sdn` (checkboxes). Possibly third toggle for
   "Heavy / latency-sensitive" (see open question 2).
3. **`sizer/sizer.css`** — minimal styling for a `<details>` block in `#sizing-notes`.
4. **New collapsed "Host Overhead — Assumptions & Math" section** inside `#sizing-notes`,
   rendered by `updateSizingNotes()` as a single `<li>` containing
   `<details><summary>…</summary>…</details>`. Collapsed by default. Content:
   - Memory math table — each component with the GB it contributed *for the current
     configuration* (live values, not just formula).
   - CPU math table — chosen percentage / core-floor and resulting reserved cores.
   - Bullet list of assumptions (cache TB × 4 GB; 16 GB infra floor; ARB per cluster;
     add-on toggles; PerfMon counters to validate post-deployment).
   - Link to the S2D hardware requirements doc (only external link — no new scripts).
5. **Existing "ℹ️ Storage Spaces Direct metadata" note** — keep wording but flip
   "Not included in workload memory calculations" → "**Included** in the host-memory
   reservation shown in the breakdown below" so behaviour and disclosure match.
6. **`tests/index.html`** — extend "Feature 12" suite with cases:
   - hybrid cache (16 + 4 × TB)
   - all-flash (16 baseline)
   - SDN / AKS toggles add 12 / 8
   - ALDO-mgmt path
   - CPU reservation floor and percentage paths
   - per-VM-exceeds-node check using the new reservation
7. **`CHANGELOG.md` / `README.md` / `index.html` + `sizer/index.html` version strings /
   "What's New" JS block** — single coordinated version bump.

### Behavioural / backwards-compat note
For an all-NVMe / hyperconverged cluster with no add-ons, the new memory reservation
(16 GB) is **lower** than today's flat 32 GB. That will *reduce* recommended node counts
by 1 in some edge cases (memory-driven sizings on small clusters).

- **Option A** — ship the honest 16 GB infra floor. Note it as "may reduce recommended
  nodes by 1 for memory-bound all-NVMe configs" in CHANGELOG. **Recommended.**
- **Option B** — keep an effective floor of **24 GB** so existing customer sizings never
  decrease, even though the math could justify 16. Hybrid/SDN/AKS configs would still go
  up.

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
6. **`CHANGELOG.md` / version-bump fan-out / README "What's New"** — combined with the
   #232 entry.

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

## Combined version-bump fan-out (both issues, single release)

- `README.md` header + appendix anchor (move 0.21.14 to Appendix A)
- `CHANGELOG.md` new `## [<version>]` section
- `index.html` + `sizer/index.html` + `switch-config/index.html` visible version strings
- "What's New" JS block in `index.html`

---

## Open decision questions (need answers before implementation)

1. **#232 behaviour** — keep a 24 GB minimum floor (Option B — no existing sizing
   decreases) or ship the honest 16 GB infra floor (Option A — sizings may shrink by 1
   node in some all-NVMe cases)? **Recommendation: A.**
2. **#232 add-on toggles** — are **AKS hybrid** (+8 GB/node) and **SDN / Network
   Controller** (+12 GB/node) the right two? Add a third "Heavy / latency-sensitive
   (SQL/RDS/VDI)" toggle that bumps CPU reservation to 4 cores?
3. **#230 SheetJS vendoring** — OK to vendor `xlsx.full.min.js` (~890 KB, Apache 2.0)
   into `vendor/`? Only sensible way to read `.xlsx` in-browser without a CDN call.
4. **#230 multi-cluster UX** — keep all **three** target-choice radios (combined /
   pick-one / identical fan-out) or trim to just **pick-one + identical fan-out** for
   simplicity?
5. **#230 default VM consolidation** — default to **"Grouped by VM template"** (5–10
   rows) for any import > 50 VMs, with "One per VM" behind an advanced toggle? Or
   always default to one-per-VM?
6. **Version bump** — 0.21.15 (patch) or 0.22.0 (minor — new feature)?
   **Recommendation: 0.22.0** (RVTools is a meaningful new capability).
7. **PR strategy** — one combined PR (both issues, single Release-branch → main) or two
   sequential PRs?

---

## Implementation order (once decisions are made)

1. **Phase 1 — #232 (smaller blast radius, foundation):**
   - Add helpers + replace flat-32 sites.
   - Add add-on toggles to UI.
   - Add collapsed "Host Overhead — Assumptions & Math" section in Sizing Notes.
   - Extend Feature 12 tests.
   - Verify ESLint + html-validate + full test suite still pass.
2. **Phase 2 — #230 (built on top):**
   - Vendor SheetJS.
   - Add RVTools tab + parser + apply logic.
   - Add per-cluster picker and consolidation strategy radios.
   - Add synthetic test fixture + parser tests.
   - Verify ESLint + html-validate + full test suite still pass.
3. **Phase 3 — release:**
   - Coordinate version-bump fan-out.
   - Update CHANGELOG + README appendix + "What's New".
   - Open PR (combined or sequential per decision 7).
