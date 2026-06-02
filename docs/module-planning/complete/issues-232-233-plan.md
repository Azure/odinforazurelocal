# ODIN — Planning Notes for Issues #232 and #233

> **In-flight planning document.** Lives in `docs/module-planning/` and is
> committed to the repository so contributors and reviewers can see the
> intended design before the work lands. Once the work ships, move this
> file to `docs/module-planning/complete/`.
>
> Captured: 2026-05-22. Split on 2026-06-01: #230 (RVTools import) moved to its
> own [`issue-230-plan.md`](../issue-230-plan.md); this file now covers the paired
> **#232** (host compute reserve / overhead) + **#233** (rack-diagram improvements).
> Target release: **0.21.55** — both ship in a single combined PR (Release → main).

---

## Issue #232 — Improve host compute reserve / overhead calculations

> **Scope correction (2026-06-01).** An earlier draft of this plan proposed adding
> per-node host-memory "add-on" toggles for **AKS hybrid (+8 GB/node)** and
> **SDN / Network Controller (+12 GB/node)**. Both have been **removed** from scope
> after a deeper code review:
>
> - **AKS Arc is already fully modelled** as a first-class `aks` workload type. The
>   Sizer already takes per-cluster control-plane node count / vCPU / memory, worker
>   config, and a cluster-count multiplier, and places those VMs into the workload pool
>   (`sizer/sizer.js`, `case 'aks'`, ~L4847–L4862; UI ~L3806–L3823). Defaults are
>   `3 × (4 vCPU / 8 GB)` — matching the `Standard_A4_v2` control-plane SKU in the
>   Microsoft docs — and there is an `AKS_OS_DISK_GB = 200` constant for the 2509 OS
>   disk default. Foundry Local, Edge RAG, and Video Indexer each carry their own AKS
>   Arc control-plane math too. Adding a separate per-host AKS reserve would
>   **double-count** AKS (once as workloads, once as overhead).
> - **AKS Arc and SDN are HA VMs that float across nodes** (spread by the failover
>   cluster), **not** a flat tax on every physical host. A per-node reservation is the
>   wrong shape, and the `+8` / `+12` figures were never sourced to a Microsoft sizing
>   doc. SDN is therefore **deferred** until/unless we have a sourced per-cluster VM
>   model — it is **not** part of this PR.
>
> **What remains in #232** is purely the *host / parent-partition* overhead refinement,
> which is genuinely missing or coarse today. No AKS toggle, no SDN toggle.

### Current state (verified in code on `Release` branch)

| Aspect | Today |
|---|---|
| Host **memory** overhead | Flat `hostOverheadMemoryGB = 32` (+ `ALDO_APPLIANCE_OVERHEAD_GB` when `cluster-type === 'aldo-mgmt'`). Hard-coded at ~8 sites in `sizer/sizer.js`: node-count recommendation, auto-scale loop, capacity bars, growth projection, headroom while-loops, per-VM "exceeds node" check, and the sizing note itself. |
| Host **CPU** overhead | **None.** vCPU capacity = `cores × (N−1) × ratio − ARB_VCPU_OVERHEAD`. No parent-partition reserve. |
| S2D cache metadata (4 GB/TB) | Already mentioned in Sizing Notes ("ℹ️ Storage Spaces Direct metadata… Not included in workload memory calculations"). Informational only — not subtracted from capacity. |
| AKS Arc clusters | **Already fully modelled** as the `aks` workload type (control plane + workers × cluster count). No change needed in #232. |
| Sizing Notes UI | `<ul id="sizing-notes">` in `sizer/index.html`; populated by `updateSizingNotes()` in `sizer/sizer.js`. Flat list, no collapsed sections. |

### Proposed model

> **Model correction (2026-06-01).** An earlier draft used a **16 GB** infra floor and
> clamped to **24 GB**. A review of Windows Server 2025 / Azure Local host requirements
> found that a 16 GB floor (scoped as "parent OS + Hyper-V + agents") **silently
> excludes the non-cache parts of the S2D stack that exist on every S2D node** —
> Software Storage Bus (SBL), the S2D pool/ReFS runtime, the CSV in-memory read cache,
> and live-migration / repair / patching headroom. For **all-flash S2D** the old model
> gave `16 + 0 → clamp 24`, which is **8 GB below today's 32** and would *under-reserve*.
> The corrected model keeps the **S2D baseline at 32 GB** (no regression for any S2D
> config) and only **reduces** the reserve for **Disaggregated Storage**, where S2D
> genuinely isn't used.

**Memory reservation per node** — split by whether Storage Spaces Direct (S2D) is in use:

```
S2D deployment types (single, standard/Hyperconverged, low-capacity, rack-aware, aldo-mgmt):
    reserved = max( 32 + (isTiered ? 4 × cacheTB_per_node : 0) + aldo,  ceil(0.08 × hostMemGB) )

Disaggregated Storage (external SAN — no SBL, no CSV cache, no S2D cache metadata):
    reserved = max( 24 + aldo,  ceil(0.08 × hostMemGB) )
```

| Component | Default | Driven by |
|---|---|---|
| **S2D baseline** (mgmt OS + Hyper-V root reserve + Failover Clustering/CSV + Arc/AMA/ATC/Defender agents + **SBL + S2D pool/ReFS runtime + CSV read cache** + LM/repair headroom) | **32 GB** | all **S2D** deployment types |
| **Disaggregated baseline** (mgmt OS + Hyper-V + clustering + agents only — **no** S2D stack) | **24 GB** | `disaggregated` only |
| S2D cache-drive metadata | **4 GB × cache TB per node** | tiered S2D only (`diskConfig.isTiered && diskConfig.cache`); **force 0** for `disaggregated` |
| Hyper-V root reserve scaling term | **⌈8 % × host RAM⌉** | always (`max()` term — covers large-memory nodes a flat GB floor misses) |
| ARB appliance VM (already modelled) | `ARB_MEMORY_OVERHEAD_GB` per **cluster** (unchanged) | always |
| ALDO appliance | unchanged (`ALDO_APPLIANCE_OVERHEAD_GB`) | `aldo-mgmt` cluster type |

Effects:
- **All-flash S2D (all NVMe/SSD as capacity, no cache tier) → 32 GB.** No change vs.
  today (fixes the under-reserve concern).
- **Tiered S2D** (NVMe/SSD cache for SSD/HDD capacity) → `32 + 4 × cacheTB` — larger,
  more accurate. e.g. 6 × 1.92 TB cache → 32 + 46 = ~78 GB/node.
- **Disaggregated → 24 GB** base — a *legitimate reduction*, since SBL / CSV read cache
  / S2D cache metadata don't exist on a SAN-backed cluster. Shown explicitly in the new
  section.
- **Large-memory nodes** → the `8 % × hostRAM` term takes over (e.g. 8 % of 2 TB =
  ~164 GB), covering the Hyper-V root reserve that a flat GB floor under-counts.
  **8 % confirmed (2026-06-01)** — see "Documentation review & provenance" below for the
  citable basis (Hyper-V per-VM + hypervisor + host-OS overheads, plus S2D/agent/LM).
- **No AKS or SDN host-memory add-on** — AKS Arc is sized as a workload; SDN is deferred.

**CPU reservation per node = max(percentage, physical-core floor)**

| Cluster profile | Reservation |
|---|---|
| Disaggregated / Low-Capacity, all-flash | `max(10%, 1 core)` |
| Standard / S2D (default) with ARB | `max(10%, 2 cores)` |
| ALDO-mgmt | `max(20%, 2 cores)` |

Becomes a new helper `getHostCpuReservedCores(hwConfig, clusterType)` → applied
in `getRecommendedNodeCount`, `autoScaleHardware` (vCPU branch), the capacity-bar block,
headroom loops, and the per-VM "exceeds node" check. vCPU available per node becomes
`(physicalCores − getHostCpuReservedCores(...)) × vcpuRatio`.

### Documentation review & provenance (2026-06-01)

Microsoft docs were reviewed to validate the numbers above. They **corroborate** the
model rather than overturn it — no change to the 32/24 base or the 4 GB/TB cache term —
but they give the previously-arbitrary percentages a citable basis and confirm the
`max(percentage, …)` shape is correct.

**Public-facing citations** (current, Windows-Server-versioned — these are the ones the
new in-app "Assumptions & Math" section will link to):

| Doc | What it gives us | How it maps to our model |
|---|---|---|
| [Hyper-V memory performance](https://learn.microsoft.com/en-us/windows-server/administration/performance-tuning/role/hyper-v-server/memory-performance) *(Applies to WS2016–2025)* | **"Hyper-V … monitors the runtime health of the root partition's management operating system to determine how much memory can safely be allocated to child partitions, while still ensuring high performance and reliability of the root partition."** | **This is the key citation.** The root-partition reserve is **dynamic and health-driven, not a fixed number** — which is exactly why we use a **percentage-of-host-RAM envelope** (`8 % × hostRAM`) with a sensible `max()` floor rather than a flat constant. Directly justifies the scaling term. |
| [Hyper-V processor performance](https://learn.microsoft.com/en-us/windows-server/administration/performance-tuning/role/hyper-v-server/processor-performance) *(Applies to WS2016–2025)* | Idle Windows guests use **< 1 % CPU**; background activity on the root partition consumes host cycles; with SMT, configure VMs with an **even number of vCPUs**. | Supports reserving a **percentage of host CPU** for the root partition / background activity (our 10 / 15 / 20 % tiers), and the even-vCPU note backs the `vcpuRatio` math. |
| [Hyper-V terminology](https://learn.microsoft.com/en-us/windows-server/administration/performance-tuning/role/hyper-v-server/terminology) *(Applies to WS2016–2025)* | Canonical definitions: **root partition** (created first, owns devices + system memory, hosts the virtualization stack and creates/manages child partitions), **child partition** (a VM), **virtual processor** (scheduled onto a **logical processor**), **guest**, **hypervisor**. | **Terminology-alignment source.** The new in-app "Assumptions & Math" section and code comments must use these exact terms — say **"root partition"** (not "parent partition"/"host OS partition"), **"child partition"** / **"VM"**, **"virtual processor (vCPU)"** vs **"logical processor"**. Keeps our overhead narrative consistent with Microsoft's wording. |
| [Hyper-V maximum scale limits (WS2025)](https://learn.microsoft.com/en-us/windows-server/virtualization/hyper-v/maximum-scale-limits?tabs=windows-server-2025) | Per-VM max **2,048 vCPU / 240 TB RAM**; per-host **1,024 running VMs / 2,048 LPs**; **64 nodes / 8,000 VMs** per failover cluster. *Applies to Azure Local 2311.2+.* | **Validation caps only — not overhead.** Azure Local's **16-node** cap (already enforced by the Sizer) sits well inside these. No new guard needed; the new section will state results are "within Hyper-V WS2025 limits". |

**Internal corroboration only — NOT linked publicly (user decision 2026-06-01):** the
old BizTalk "[System resource costs on Hyper-V]" / "[Checklist: optimizing performance on
Hyper-V]" articles give concrete legacy figures — **CPU overhead 9–12 %** per guest, and
**memory overhead = 300 MB hypervisor + 512 MB host OS + 32 MB first GB + 8 MB per
additional GB per VM**, plus a 110–125 % CPU allocation guideline. These are **WS2008
R2-era lab numbers**, so we keep them as private sanity-check corroboration in this plan
but **do not cite them in the app** — the modern perf-tuning docs above carry the same
conclusions with current applicability. (They independently confirm the 8 % / 10–20 %
envelope is the right order of magnitude.)

**Caveats / decisions from the review:**
- The modern perf-tuning docs are **qualitative** (root reserve is health-monitored;
  background activity consumes host cycles) — they validate the *shape* of our model
  (percentage envelope + floor) but don't publish a single magic constant. That's
  expected and fine: an aggregate sizer needs an envelope, not a per-VM formula.
- The legacy BizTalk per-VM formula (`32 MB + 8 MB/GB × VM`) is ~1–2 % of allocated RAM
  in pure Hyper-V management overhead; our **8 %** envelope sits **above** it to also
  cover SBL + CSV read cache + Arc/AMA/ATC/Defender agents + LM / repair headroom — which
  the BizTalk numbers predate and don't include.
- **We will NOT implement the full per-VM memory formula** (`32 MB + 8 MB/GB × VM`). The
  Sizer aggregates workloads into pools and doesn't track per-VM placement per node, so a
  per-VM term would be false precision. The **percentage-of-host-RAM envelope is the
  correct abstraction** for an aggregate sizer — this is a deliberate scope decision.
- **8 % confirmed** as the memory scaling term (user-approved 2026-06-01) — it scales for
  large-memory nodes where a flat GB floor under-reserves, and is defensible against the
  documented root-partition reserve plus the S2D/agent/LM additions.
- The WS2025 scale maxima are **far** beyond anything the Sizer produces (16-node cap,
  realistic VM sizes); **no new validation guards** are added for them — they're cited in
  the assumptions text as context only.
- **Docs reviewed but not needed** (background/no actionable numbers for our model):
  Hyper-V *terminology*, *architecture*, *server configuration*, *storage I/O
  performance*, *network I/O performance*, *detecting bottlenecks*, and *Linux VM
  considerations*. Storage / network / Linux are about per-workload tuning, not host
  compute reserve, so they're out of scope for #232.

### Files touched

1. **`sizer/sizer.js`** — two new helpers near the top:
   ```js
   function getHostMemoryReservedGB(hwConfig, clusterType) { … }   // S2D-aware (32/24 base)
   function getHostCpuReservedCores(hwConfig, clusterType) { … }
   ```
   Replace every literal `32` host-overhead site (see "Current state" table). The memory
   helper must:
   - use **24** base (not 32) when `clusterType === 'disaggregated'`,
   - **force `cacheMetadataGB = 0`** when `disaggregated` (and when not tiered),
   - apply the `max(base + cache + aldo, ceil(0.08 × hostMemGB))` clamp.
   No `addons` parameter — there are no add-on toggles.
2. **`sizer/sizer.css`** — print-rule entry for the new `<details>` (mirror the existing
   `#power-detail-section` / `#growth-projection-section` print block at ~L460–L480 so
   the section expands and recolours for print/PDF).
3. **New collapsed "Physical Host Compute Overhead — Assumptions & Math" section**,
   styled **identically to the existing "Power calculations, verbose information and
   assumptions" `<details>`** (same `summary` inline style: `cursor:pointer;
   color:var(--accent-blue); font-weight:600; font-size:13px; padding:6px 0`, and the
   same `rgba(59,130,246,0.04)` content panel). Collapsed by default. Rendered by
   `updateSizingNotes()`. Placement: a sibling `<details>` directly **below** the
   `<ul id="sizing-notes">` inside `.notes-section` (cleaner than embedding a `<details>`
   in an `<li>`). New static markup in `sizer/index.html`:
   ```html
   <details id="host-overhead-section" style="margin-top: 10px; font-size: 12px; color: var(--text-secondary);">
       <summary style="cursor: pointer; color: var(--accent-blue); font-weight: 600; font-size: 13px; padding: 6px 0;">Physical Host Compute Overhead — Assumptions &amp; Math</summary>
       <div id="host-overhead-content" style="margin-top: 8px; padding: 10px 12px; background: rgba(59, 130, 246, 0.04); border: 1px solid rgba(59, 130, 246, 0.12); border-radius: 6px; line-height: 1.8;"></div>
   </details>
   ```
   Content (`#host-overhead-content`, populated live by `updateSizingNotes()`):
   - **Deployment type + S2D in-use flag**, stated explicitly. For `disaggregated`:
     *"Disaggregated Storage — storage served by external SAN; Storage Spaces Direct is
     **not** used, so no SBL / CSV read-cache / cache-drive metadata is reserved
     (24 GB base instead of 32 GB)."*
   - **Memory math table** — base (32 S2D / 24 disaggregated) + cache metadata
     (`4 GB/TB × cacheTB`, or *"N/A — no cache tier"* / *"N/A — disaggregated"*) + ALDO,
     vs. the `8 % × host RAM` term, with **which term won** highlighted — all live values
     for the current config.
   - **CPU math table** — chosen % / core-floor → resulting reserved cores.
   - **Assumption bullets** + doc links. **Public links only:** the S2D hardware-
     requirements doc, [Hyper-V memory performance], and [Hyper-V processor performance]
     (and optionally the WS2025 scale-limits doc). **Do NOT link the BizTalk articles in
     the app.** Bullets cite: 32/24 base rationale; 4 GB/TB S2D cache metadata; the
     `8 % × host-RAM` envelope (justified by the *health-monitored root-partition reserve*
     from the Hyper-V memory-performance doc, noting it sits above raw Hyper-V overhead to
     cover S2D + Arc/AMA/ATC/Defender agents + LM / repair headroom); CPU 10–20 % vs. the
     documented background-activity / parent-partition overhead; and that results are
     within Hyper-V WS2025 scale limits.
4. **De-duplicate the existing "Azure Local Instance - Sizing Notes" `<ul>`** — text that
   now lives in the collapsed section is **removed from the flat note list** to avoid
   duplication:
   - The **"ℹ️ Storage Spaces Direct metadata … Not included in workload memory
     calculations"** note (`updateSizingNotes()` ~L6131) is **removed from the `<ul>`**;
     its content moves into the new section's memory table and is now **actually
     subtracted** from capacity (wording flips to *"Included in the host-memory
     reservation — see breakdown below"*).
   - The inline **"after 32 GB host overhead"** strings in the memory-pressure and
     per-VM-exceeds-node notes (~L6035, ~L6148) switch to the **computed reservation**
     from `getHostMemoryReservedGB()` and point at the new section instead of restating
     the math.
5. **`tests/index.html`** — extend "Feature 12" suite with cases:
   - all-flash S2D (32 baseline, cache metadata = 0)
   - tiered S2D (32 + 4 × cacheTB)
   - **disaggregated (24 base, cache metadata force-zeroed even if a disk config exists)**
   - ALDO-mgmt path (+ appliance)
   - `8 % × host RAM` term wins on a large-memory node
   - CPU reservation floor and percentage paths
   - per-VM-exceeds-node check using the new reservation
6. **`CHANGELOG.md` / `README.md` / `index.html` + `sizer/index.html` version strings /
   "What's New" JS block** — single coordinated version bump.

> **No `sizer/index.html` UI toggles** are added by #232 — the previously-proposed
> `host-addon-aks` / `host-addon-sdn` checkboxes are dropped.

### Behavioural / backwards-compat note
With the corrected model, **no S2D deployment type's reserve decreases** — all-flash S2D
stays at 32 GB, tiered S2D increases by the cache-metadata term, and large-memory nodes
may increase via the 8 % term. The **only** reserve that decreases is **Disaggregated
Storage (32 → 24 GB)**, which is justified because S2D (SBL, CSV read cache, cache-drive
metadata) is not present on a SAN-backed cluster, and it is disclosed in the new section.

- ~~**Option A** — honest 16 GB infra floor.~~ (Rejected — under-reserves all-flash S2D.)
- **Option B (CHOSEN, 2026-06-01), refined** — S2D base held at **32 GB** so existing
  S2D sizings never decrease; Disaggregated lowered to **24 GB** (no S2D stack); plus an
  `8 % × host RAM` `max()` term for large-memory nodes.
- ARB (`ARB_MEMORY_OVERHEAD_GB`, 8 GB) is **per cluster**, added once — not per node —
  and is separate from this per-node reservation.

---

## Issue #233 — Rack-diagram improvements (Config Report + 3D Sizer)

> Ships in the **same 0.21.55 PR** as #232. Separate code area (rack rendering), so it
> can be implemented and tested independently of the overhead math.

### Scope (from the issue)

1. **Fill racks bottom-up.** Physical servers should be placed from the **bottom** of the
   42U rack upward (datacentre practice — bottom-heavy racks are stable). ODIN currently
   draws nodes from the **top** down, which is the wrong orientation.
2. **Real node names.** The "Rack Layout — Front View" must show the **Designer node
   names** (when changed from the defaults) instead of the generic `Node 1`, `Node 2`, …
3. **Real ToR switch labels.** When the Designer provides ToR switch **make** and
   **switch names**, show those in the diagram instead of just `ToR 1` / `ToR 2`.

### Current state (verified in code on `Release` branch)

| Aspect | Today |
|---|---|
| U→pixel placement | [`report/rack-svg.js`](../../report/rack-svg.js) `drawDevice()` (~L73–L99) maps a 1-based `uStart` (from the bottom) to pixels: higher U = physically higher. The **fill order** is what's wrong, not the coordinate system. |
| Node fill order (HCI SVG) | `generateRackSvg()` (~L157–L285): ToR at `TOTAL_U − t` (U42/U41), BMC below, then nodes computed **top-down** (`topServerU = TOTAL_U − tor − bmcPerRack`; `serverStartU = topServerU − n*2 − 1`). |
| Node fill order (disaggregated SVG) | (~L471–L520): servers `uPos = 38 − n*2` (top-down). |
| Draw.io generators | HCI (~L713–L740) and disaggregated (~L906–L922) mirror the same top-down math. |
| Node labels | Hardcoded `'Node ' + (nodeOffset + n + 1)` / `'Node ' + (nodeStart + n)` in all four generators. |
| ToR labels | Hardcoded `'ToR ' + torNum` (HCI) / `'Leaf '+…`, `'FC Switch '+…` (disaggregated). |
| 3D Sizer | [`sizer/rack3d.js`](../../sizer/rack3d.js): switches placed at "ToR 1 (U42) / ToR 2 (U41)" (~L795–L810); ToR labels/cabling hardcoded `ToR 1/2/3/4` (~L920–L940, ~L1085–L1095). Server boxes stacked top-down to match the SVG. |
| Designer node names | Stored in state under **`physicalNodesSettings`** (and `state.nodeSettings`); each entry has a `.name`. Example read: [`js/disaggregated.js`](../../js/disaggregated.js) ~L2872 `state.nodeSettings[0].name` with `'Node 1'` fallback. Originate from the Step 10/12 "Node N Name" inputs ([`js/script.js`](../../js/script.js) ~L1064–L1251, name→index map ~L9072). |
| Designer ToR switch make/names | **To confirm during implementation** — check whether the Designer/switch-config captures a ToR make + per-switch name in state; if not present, fall back to the existing `ToR N` label (no regression). |

### Proposed change

**Bottom-up fill (both renderers):**
- Keep `drawDevice()`'s U→pixel math as-is (U is already bottom-referenced). **Change only
  the U *assignment*** so nodes fill from the bottom: place the first node at the lowest
  free U (just above any bottom margin) and increment **upward** for each subsequent node,
  with ToR/leaf switches at the **top** of the rack (unchanged — switches stay at U42/U41
  for cabling clarity; only the **server stack** flips to bottom-anchored).
- Apply the same reorientation to all four `rack-svg.js` generators (HCI SVG, disaggregated
  SVG, HCI Draw.io, disaggregated Draw.io) **and** the 3D `rack3d.js` server-box stacking so
  the 2D report and 3D view stay consistent.
- **Decision:** switches remain top-of-rack; only physical servers move bottom-up. (If the
  issue intends switches at the bottom too, revisit — but top ToR + bottom-up servers is
  the common datacentre layout and keeps cabling diagrams readable.)

**Real node names:**
- Add a small helper to resolve a node's display label from state:
  `getRackNodeLabel(globalNodeIndex)` → `physicalNodesSettings[i].name` (or
  `state.nodeSettings[i].name`) when set and non-default, else `'Node ' + (i+1)`.
- Replace the hardcoded `'Node ' + …` strings in all four `rack-svg.js` generators and the
  3D labels with this helper. **Multi-rack** must use the **global** node index (account for
  `nodeOffset` / `nodeStart`) so names don't restart per rack.
- The Config Report **text output** (node list) uses the same resolved names.

**Real ToR switch labels:**
- Add `getRackTorLabel(torIndex)` → `<make> <name>` (or just `<name>`) from Designer/switch
  state when available, else the existing `'ToR ' + torNum`. Same fallback approach for
  `Leaf` / `FC Switch` in the disaggregated generators.
- Wire into the SVG, Draw.io, and 3D label sites.

### Files touched (#233)

1. **`report/rack-svg.js`** — flip server U-assignment to bottom-up in all four generators;
   add `getRackNodeLabel()` / `getRackTorLabel()` helpers; replace hardcoded `Node N` /
   `ToR N` / `Leaf` / `FC Switch` strings.
2. **`sizer/rack3d.js`** — match the bottom-up server stacking; use the same label helpers
   for node boxes and ToR labels/cabling.
3. **`report/report.js`** *(if the text node-list lives there)* — use resolved node names in
   the textual "Rack Layout" output.
4. **`tests/index.html`** — add a rack-layout test group: (a) first server sits at the
   bottom-most server U (bottom-up assertion), (b) custom Designer node names surface in the
   label helper, (c) default fallback when names are unset, (d) global node index across
   multi-rack, (e) ToR make/name surfacing + fallback.
5. Version-bump fan-out is **shared** with #232 (single 0.21.55 release — see below).

### Out of scope (#233)

- Re-laying-out switches to the bottom of the rack (servers only move bottom-up).
- Adding new Designer input fields for ToR make/name if they don't already exist — #233
  only *surfaces* names that the Designer already captures; net-new inputs would be a
  separate issue.
- Changing rack height, U-count, or BMC placement.

---

## Privacy / file-handling note

- No PII in this plan or in #232/#233 code, comments, or fixtures. Real cluster/host/node
  names, customer identifiers, tenant/subscription IDs, and local file paths must **never**
  be referenced. Rack-diagram test fixtures use obviously-synthetic node/switch names
  (e.g. `Demo-Node-01`, `Contoso-ToR-A`).

---

## Combined version-bump fan-out (#232 + #233, single 0.21.55 release)

- `README.md` header + appendix anchor (move 0.21.14 to Appendix A)
- `CHANGELOG.md` new `## [0.21.55]` section
- `index.html` + `sizer/index.html` + `switch-config/index.html` visible version strings
- "What's New" JS block in `index.html`

---

## Open decision questions

1. **#232 behaviour** — ~~keep a 24 GB minimum floor (Option B) or ship the honest
   16 GB infra floor (Option A)?~~ **RESOLVED (2026-06-01), then REFINED:** Option B in
   spirit (no S2D sizing decreases), but the base is **32 GB for S2D types** (16 GB
   under-reserved all-flash S2D — it omits SBL / CSV read cache / LM-repair headroom),
   **24 GB only for Disaggregated** (no S2D stack), plus an `8 % × host RAM` `max()`
   term. **8 % confirmed (2026-06-01)** after reviewing the Hyper-V perf-tuning docs
   (see "Documentation review & provenance").
2. **#232 add-on toggles** — ~~AKS hybrid / SDN per-node toggles~~ **RESOLVED &
   REMOVED (2026-06-01).** AKS Arc is already modelled as the `aks` workload type
   (per-node memory add-on would double-count it), and the SDN/`+12 GB` figure was
   never sourced and is the wrong shape (HA VMs float across nodes). No toggles in
   #232; SDN deferred. The "Heavy / latency-sensitive" CPU toggle is also dropped.
3. **#232 new pCPU reserve is net-new behaviour** — confirmed (2026-06-01) the Sizer
   has **no** per-node host/root-partition CPU reserve today (only a per-cluster
   `ARB_VCPU_OVERHEAD = 4` on the demand side). The new `getHostCpuReservedCores()`
   reduces usable vCPU/node and **can increase recommended node counts** for CPU-bound
   sizings. **Call this out in the CHANGELOG** as a behavioural change.
4. **#233 switch placement** — servers move bottom-up; **switches stay top-of-rack**
   (U42/U41) for cabling clarity. Confirm this matches the issue's intent, or move
   switches to the bottom too. *(Assumption: top ToR + bottom-up servers.)*
5. **#233 ToR make/name source** — confirm during implementation whether the Designer /
   switch-config already captures ToR make + per-switch names in state. If not present,
   fall back to `ToR N` (no net-new input fields in #233).
6. **Version bump** — ~~0.21.15 (patch) or 0.22.0 (minor)?~~ **RESOLVED (2026-06-01):
   0.22.01.** (Combined #232 + #233 release; user-chosen.)
7. **PR strategy** — ~~one combined PR (both issues) or two sequential PRs?~~
   **RESOLVED (2026-06-01): combined PR for #232 + #233** (host-overhead math +
   rack-diagram improvements), single Release-branch → main. **#230 (RVTools) is NOT in
   this PR** — it ships separately in a later PR; see [`issue-230-plan.md`](../issue-230-plan.md).

---

## Implementation order

1. **Phase 1 — #232 (smaller blast radius, foundation):**
   - Add `getHostMemoryReservedGB()` / `getHostCpuReservedCores()` helpers + replace
     flat-32 sites; introduce the per-node CPU reserve.
   - Add collapsed "Physical Host Compute Overhead — Assumptions & Math" section in
     Sizing Notes; de-duplicate the flat `<ul>`.
   - Extend Feature 12 tests.
   - Verify ESLint + html-validate + full test suite still pass.
2. **Phase 2 — #233 (rack-diagram improvements, SAME PR):**
   - Flip server fill to **bottom-up** in all four `report/rack-svg.js` generators and
     in `sizer/rack3d.js`; switches stay top-of-rack.
   - Add `getRackNodeLabel()` / `getRackTorLabel()` helpers; surface real Designer node
     names + ToR make/names (global node index across multi-rack); fallback to `Node N`
     / `ToR N`.
   - Use resolved names in the Config Report text output.
   - Add rack-layout tests.
   - Verify ESLint + html-validate + full test suite still pass.
3. **Phase 3 — combined release (#232 + #233):**
   - Coordinate version-bump fan-out to **0.21.55**.
   - Update CHANGELOG (note the new pCPU reserve as a behavioural change) + README
     appendix + "What's New".
   - Open **one combined PR** (#232 + #233), Release → main.

> **#230 (RVTools import)** is tracked separately in
> [`issue-230-plan.md`](../issue-230-plan.md) and ships in its own later PR with its own
> version bump — not part of 0.21.55.
