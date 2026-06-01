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
> **not** part of the 0.22.01 (#232 + #233) release — see
> [`complete/issues-232-233-plan.md`](complete/issues-232-233-plan.md).

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

Recommendation: **SheetJS**, vendored. See decision record below.

---

### DECISION (Q1, RESOLVED 2026-06-01): vendor SheetJS Community Edition

**Decision:** Vendor SheetJS Community Edition (`xlsx.full.min.js`, Apache-2.0) into
`vendor/`, lazy-loaded, SHA-256-pinned, with a unit test asserting the pinned hash.
Proceed — risk is low-to-moderate and well-contained.

#### Why SheetJS over alternatives

- It is the de-facto standard browser `.xlsx` reader and reads the RVTools "all" export
  (multi-sheet `.xlsx`) without server help.
- Apache-2.0 — compatible with this repo and with the "no copyleft" posture of the other
  vendored libraries (`three.js` MIT, `jspdf` MIT, `jszip` MIT, `html2canvas` MIT).
- `exceljs` is heavier (~1.1 MB) and oriented at *writing* workbooks; we only need to
  *read*, so its extra surface buys us nothing here.

#### Concerns and mitigations

1. **Size (~890 KB minified) — the largest single asset in the repo.**
   - Today's largest vendored asset is `three-0.128.0.min.js` (~600 KB); SheetJS would
     exceed it.
   - **Mitigation — lazy-load.** Do **not** add a static `<script>` tag to
     `sizer/index.html`. Inject the `<script>` only the first time the user opens the
     **📊 RVTools** import tab (guarded so it is injected at most once per page load).
     Users who never touch RVTools never download it; initial Sizer page weight is
     unchanged.

2. **Distribution channel — `xlsx` is no longer on the public npm registry.**
   - SheetJS **delisted the `xlsx` package from npmjs.com in 2023**; official releases
     are now self-hosted at `cdn.sheetjs.com` (and mirrored on their GitHub).
   - Consequence: we **cannot** `npm install xlsx`, and Dependabot will **not** track it
     (it is not in `package.json`). This is fine — we vendor the prebuilt file directly,
     exactly like the other `vendor/` libraries.
   - **Mitigation — record provenance.** In `vendor/README.md` record: exact version
     (e.g. `0.20.3`), the official source URL it was downloaded from, the download date,
     the licence (Apache-2.0), and the **SHA-256** of the committed file. Do **not** add
     a CDN `<script src>` — the file must be served from the repo itself (offline /
     clone-and-open requirement, and the repo policy of no new external `<script>` tags).

3. **Security surface — a complex binary parser handling untrusted files.**
   - `.xlsx` is a ZIP of XML; the RVTools file may also be an OLE2 / MIP-encrypted blob
     (see *File handling notes* — the inspected sample was MIP-encrypted, magic bytes
     `D0 CF 11 E0`). SheetJS has had historical advisories, e.g.
     **CVE-2023-30533** (prototype pollution via crafted workbook, fixed in 0.19.3) and
     a **ReDoS** in older `xlsx` releases.
   - **Mitigation — pin a current release.** Vendor a current **0.20.x** build that is
     past those advisories. Parsing stays **100% client-side**, we never `eval` cell
     content, and we never write a workbook back, so the blast radius is limited to the
     importing user's own browser tab. Encrypted / sensitivity-labelled files are caught
     by SheetJS throwing on open → we show the "save an unprotected copy" message rather
     than attempting to decrypt.

4. **Supply-chain — trusting a prebuilt minified blob.**
   - We are committing a third-party minified artifact we did not build from source.
   - **Mitigation — SHA-256 pin + integrity test** (see below). The pin makes any
     post-commit modification of the blob (accidental or malicious) fail CI.

#### Tests to add for the vendored library

- **(A) Integrity / hash-pin test (ship this).** A unit test in `tests/index.html` (or a
  small Node check under `scripts/`) reads `vendor/xlsx-0.20.x.min.js`, computes its
  **SHA-256**, and asserts it equals a hard-coded expected hash. This catches accidental
  corruption or a tampered/swapped vendored blob. Mirrors the existing vendor discipline
  (pinned, provenance-tracked files).
- **(B) Version-tracking note — manual, NOT an automated upstream check.** Record the
  pinned version + source URL + SHA-256 in `vendor/README.md` and review on a manual
  cadence. **Deliberately do not** add a test that calls SheetJS / the network to ask
  "is there a newer version?" — that would (i) break the offline / clone-and-open model,
  (ii) make CI non-deterministic and network-dependent, and (iii) Dependabot can't help
  here anyway since the package isn't on npm. Upstream version bumps are a manual,
  reviewed action: download the new official release, update the file, update the version
  + SHA-256 in `vendor/README.md`, and update the expected hash in test (A).
- **(C) Parser smoke test (functional, separate from integrity).** Covered under the main
  test plan (synthetic `vInfo` + `vCluster` fixture): MiB→GB conversion, powered-off /
  template filtering, vCPU sum, per-cluster grouping, "VM template" banding, and the
  malformed / encrypted-file error path. These validate *our* parsing code, not the
  library blob.

#### Net

Low-to-moderate risk, contained by **lazy-load + client-side-only + SHA-256 pin +
integrity test + provenance in `vendor/README.md`**. **Proceed with vendoring SheetJS.**

### DECISION (UI, RESOLVED 2026-06-01): dedicated toolbar button → shared modal (option B)

**Decision:** Add a **dedicated `📊 RVTools` button** to the Sizer *Workload Scenarios*
toolbar, **immediately after `📂 Import`** and before `📤 Export`. The button opens the
**existing** Import Configuration modal pre-selected on a new **RVTools tab** (**option
B**), rather than opening a separate standalone modal (option A). The modal tab strip is
changed from `flex: 1` to content-width + wrap to accommodate the third tab on mobile.

**Why a dedicated button (not only a third tab):**
- RVTools import is a marquee capability, not a sub-option users should have to hunt for
  inside a modal. A top-level button gives it the prominence it deserves.
- The toolbar row (`.section-header-actions`, `sizer/index.html` ~L62) uses `btn btn-sm`
  buttons that size to content — it is **not** `flex: 1`, so adding a fourth button there
  is cheap and does **not** trigger the squish problem. The `flex: 1` crowding only
  affects the **tab strip inside** the modal.

**Why option B (shared modal) over option A (standalone modal):**
- Option B reuses the modal shell, the open/close + overlay + escape-key handlers, the
  lazy-load hook, and the post-import banner — least code, most visual consistency.
- Option A would duplicate the modal shell and a second privacy/error/preview block,
  i.e. more code to keep in sync and more drift risk.
- RVTools *is* conceptually an import, so it belongs in the import modal; the dedicated
  button is just a prominent shortcut straight to its tab.

**Crowding mitigation:** because most users reach RVTools via the dedicated button
(already on that tab), the three-narrow-tabs issue is largely sidestepped. For the
minority who tab across inside the modal, de-flexing the strip (`flex: 0 0 auto` +
`flex-wrap: wrap`) lets the three tabs wrap to a second row on small screens instead of
truncating.

**Naming / placement (user-confirmed):** button label is **`📊 RVTools`** (compact — the
icon + modal title carry the "import" meaning, and it sits next to `📂 Import`); placed
**after `📂 Import`** so the two "data-in" actions stay adjacent.

### UI / flow

1. **Dedicated `📊 RVTools` toolbar button** in the Sizer's *Workload Scenarios*
   header-actions row, placed **immediately after the existing `📂 Import` button**
   (before `📤 Export`). See the *DECISION (UI)* record below for why this is a
   top-level button rather than only a third tab. The button opens the **existing**
   `📂 Import Configuration` modal pre-selected on the RVTools tab
   (`openImportModal('rvtools')`) — **option B**, so we reuse the modal shell, overlay /
   escape-key / close plumbing, and the post-import banner rather than duplicating a
   second modal.
2. Inside that modal, RVTools is the **third tab** (`📊 RVTools`), alongside
   `📤 Sizer Configuration` and `☁️ Azure Local Instance`. Because most users arrive via
   the dedicated toolbar button (already on this tab), the three-tab crowding is largely
   avoided; users who open via `📂 Import` can still reach it. The lazy SheetJS `<script>`
   is injected when the RVTools tab is **first activated** (inside the tab switch), not
   when the modal opens — so users of the other two tabs never download the ~890 KB blob.
3. **Tab-strip responsiveness**: the modal tab strip currently sets `flex: 1` on each of
   the two buttons (`sizer/index.html` ~L1024–L1025). With a third tab that squishes on
   mobile, so change the strip to **content-width tabs that wrap** (`flex: 0 0 auto` +
   `flex-wrap: wrap` on the container) instead of `flex: 1`, so the three tabs wrap to a
   second row on small screens rather than truncating.
4. File picker (`accept=".xlsx"`) → reads file client-side (FileReader → SheetJS).
5. Privacy disclaimer block (see above).
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
2. **`sizer/index.html`** — (a) new **`📊 RVTools` toolbar button** in the
   *Workload Scenarios* `.section-header-actions` row, right after `📂 Import`
   (`onclick="openImportModal('rvtools')"`); (b) the **third tab** (`📊 RVTools`) in the
   import modal tab strip + its panel (file picker + preview + radios); (c) change the
   tab strip from `flex: 1` per-button to content-width + `flex-wrap: wrap`. Lazy
   `<script>` for SheetJS injected when the RVTools tab is first activated.
3. **`sizer/sizer.js`** — `openImportModal()` accepts an optional initial-tab argument
   (defaults to current behaviour) so the toolbar button can open straight onto the
   RVTools tab; plus new functions `switchImportTab('rvtools')` handling (lazy-load +
   panel show), `parseRVToolsXLSX(file)`, and `applyRVToolsImport(parsed, options)`. They
   build workload objects and call the existing `workloads.push()` path. Banner
   integrated with the existing post-import banner.
4. **`sizer/sizer.css`** — minimal styling for the per-cluster picker table and the
   de-flexed / wrapping import tab strip.
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

1. ~~**SheetJS vendoring** — OK to vendor `xlsx.full.min.js` (~890 KB, Apache 2.0) into
   `vendor/`?~~ **RESOLVED (2026-06-01): yes — vendor SheetJS Community Edition,
   lazy-loaded, SHA-256-pinned, with an integrity test.** See the full *DECISION (Q1)*
   record under **Excel parsing — dependency** above (size / lazy-load, npm-delisting /
   provenance, security surface, supply-chain, and the hash-pin vs. no-network-version-
   check test split).
2. **Multi-cluster UX** — keep all **three** target-choice radios (combined / pick-one /
   identical fan-out) or trim to just **pick-one + identical fan-out** for simplicity?
3. **Default VM consolidation** — default to **"Grouped by VM template"** (5–10 rows)
   for any import > 50 VMs, with "One per VM" behind an advanced toggle? Or always
   default to one-per-VM?
4. **Version bump / PR** — own patch/minor bump for the standalone #230 PR (decide at
   implementation time, after the 0.21.55 release has shipped).
