# Changelog

All notable changes to Odin for Azure Local (Optimal Deployment and Infrastructure Navigator) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.21.04] - 2026-05-06

Adds **Foundry Local on Azure Local (Preview)** as a fourth workload type in the Sizer, alongside Azure Local VMs, AKS Arc, and AVD. Foundry Local runs an Arc-enabled Kubernetes (AKS Arc) control plane plus N model deployment replicas, sized via three preset model classes (Small SLM / Medium SLM / Large LLM) or a Custom override.

### Added

- **`sizer/` — new "Foundry Local" workload type.** A fourth `workload-type-btn` next to VMs / AKS Arc / AVD on the Sizer page, with a dedicated modal for sizing AI inference deployments.
  - **Model size classes** with conservative per-replica resource estimates:
    - **Small SLM** (Phi-3.5-mini, Llama-3.2-3B): 4 vCPU / 8 GB / 20 GB per replica. CPU OK with ONNX-GenAI.
    - **Medium SLM** (Phi-4, Mistral-7B, Llama-3.1-8B): 8 vCPU / 16 GB / 40 GB per replica. GPU recommended.
    - **Large LLM** (DeepSeek-R1-Distill-32B, Llama-3.3-70B Q4): 16 vCPU / 64 GB / 100 GB per replica. GPU required.
    - **Custom** for user-specified per-replica vCPU / memory / storage.
  - **Inference engine** picker — **ONNX-GenAI** (CPU or GPU) or **vLLM** (GPU only). Selecting vLLM forces GPU mode (DDA) and disables the *None* option to prevent invalid configurations.
  - **Replicas** input (1–100) — each replica is sized to the model class and reserves a fixed 200 GB AKS Arc OS disk per worker node, matching the AKS workload pattern.
  - **GPU sizing** reuses the standard workload GPU controls (DDA only — Foundry runs on AKS Arc, which doesn't support GPU partitioning). GPU model + count is set per replica.
  - **Total sizing** = 3-node Kubernetes control plane (3 × 4 vCPU / 8 GB / 200 GB OS each) + N replicas × per-replica resources + 200 GB OS disk per replica + 2 vCPU / 4 GB inference operator overhead. The modal displays this composition inline so users see exactly what's being added to the cluster.
  - **Preview pill** in the workload-type button and an inline link to [request preview deployment access](https://aka.ms/FoundryLocalAzure_PreviewRequest) inside the modal.
- **Round-trip support**: Foundry workloads serialize/deserialize through the existing JSON Export, JSON Import, share URL, *Configure in Designer* hand-off, and the Configuration Report (Markdown + HTML + PowerPoint) — same code paths VMs / AKS / AVD use.
- **`tests/index.html`** — 13 new unit tests covering `FOUNDRY_MODEL_CLASSES` integrity (preset values, monotonic memory progression, custom class) and `calculateWorkloadRequirements()` for Foundry workloads (control-plane + worker + operator overhead arithmetic, Custom override path, GPU count calculation).
- **`images/foundry-icon.png`** — new 28 × 28 icon for the Foundry Local workload button (copied from `docs/reference-architectures/icons/paas-foundry-local.png` so the Sizer button matches the icon already used on the Microsoft Sovereign Private Clouds reference architectures page).

### Changed

- **`sizer/sizer.css`** — added `--accent-cyan: #00bcf2` CSS custom property (matches the existing Foundry Local color used by the reference-architectures page) and a `.workload-icon.foundry` variant for the Sizer's workload-type button.
- **`report/report.js` and `report/pptx-export.js`** — added a `'foundry'` branch to the per-workload type-label / detail rendering so Foundry workloads appear correctly in the Configuration Report's Markdown export, HTML preview, and PowerPoint export, with a Preview-aware *Inference Engine* row and per-replica Custom Spec row.

### Notes

- Per-replica resource estimates are conservative rules of thumb (model weights × bytes-per-weight + KV cache + serving overhead). **Foundry Local on Azure Local is in Preview**; sizing depends on the specific model, quantization, batch size, and concurrent request load. Validate with your OEM hardware partner and your actual model.
- No new external network calls. No new third-party CDN dependencies. Foundry workload state lives in `localStorage` and the existing share-URL / JSON-export pipeline, exactly like the other three workload types.

---

## [0.21.03] - 2026-05-06

New **Microsoft Sovereign Private Clouds reference architectures** page (Preview) in the Knowledge tab. Picks a business purpose, renders a live SVG diagram of the resulting architecture, and exports an editable multi-slide PowerPoint generated entirely client-side via JSZip — no upload, no backend.

### Added

- **`docs/reference-architectures/`** — new self-contained page (HTML + JS + CSS + 46 icons) that renders Microsoft Sovereign Private Cloud reference architectures for five business purposes:
  - **Azure Local** — general-purpose VMs / AKS Arc / Arc Data Services on a 2–4 node cluster (or up to 64 nodes).
  - **Microsoft 365 Local** — Exchange / SharePoint / Skype for Business productivity workloads with Small-Scale (1 × 3-node cluster) and Large-Scale (4 single-node Exchange mailbox + 2 single-node Edge Transport + 1 three-node SharePoint/Skype/SQL = 7 clusters total) variants from the SPC L300 deck (slides 66–68).
  - **GitHub Enterprise Local** — on-prem DevSecOps platform with GitHub Enterprise Server, container registry, AKS build agents, observability (Private Preview).
  - **Azure Virtual Desktop on Azure Local** — VDI session hosts, FSLogix profiles, domain controllers.
  - **Foundry Local** — AI platform with model families (DeepSeek / Microsoft / OpenAI / Qwen / Mistral / BYO), Edge RAG, Video Indexer, GPU partitioning.
- **Live SVG preview** with Azure cloud band, Distributed location band, per-purpose workload bands, real cluster icons, and (for disconnected mode) a shared 3-node Control Plane Appliance.
- **Connectivity / tenancy / scale picker**: Connected vs Disconnected (air-gapped); Strict (dedicated hardware) vs Logical (shared, coming soon) tenancy; Single Node / 16 / 64 / 128 (coming soon) scale per purpose.
- **Narrative "About this architecture" section** instead of a flat bullet list — explains the selected footprint, the consequence of the connectivity choice (Azure Arc for connected; on-prem Control Plane Appliance with ARM/Portal/Key Vault/Defender/Monitor/Update Manager equivalents for disconnected), and a per-purpose paragraph for each selected workload.
- **Editable PowerPoint export** generated entirely client-side via [JSZip 3.10.1](https://github.com/Stuk/jszip) (MIT, vendored at `vendor/jszip-3.10.1.min.js`):
  - **Cover slide** with a large centered ODIN logo, title, subtitle, and a footprint summary in the footer.
  - **Diagram slide** rendering the live SVG architecture as a high-resolution PNG.
  - **Control Plane slide** (Connected or Disconnected) with a hero icon and a 3 × 2 grid of service tiles (Azure Arc / ARM / Portal / Defender / Monitor / Policy for connected; on-prem ARM / Portal / Key Vault / Defender / Monitor / Update Manager for disconnected).
  - **Summary slide** with shadows, accent strips, and pill chips per purpose.
  - **One per-purpose slide** per selected purpose — title, summary, design narrative, real cluster icon, and feature pills.
  - Icons rasterized at 1024×1024 so SVG sources stay crisp at any slide scale and small PNG sources don't get visibly upscaled. SVG-only versions of the GitHub mark (Octicons MIT) and the Azure AI Foundry icon are used in the deck so they don't blur on the per-purpose hero card.
- **Knowledge tab navigation entry** in `index.html` ("Microsoft Sovereign Private Clouds reference architectures" — Preview badge) and a contextual onboarding step in `js/script.js` that explains the page when it's opened for the first time.

### Changed

- **`vendor/README.md`** — added JSZip 3.10.1 row to the vendored-libraries table with the upstream CDN URL it was sourced from. Designer, Sizer, Switch Configuration, and Configuration Report do not load JSZip; only the new reference-architectures page does.
- **`_config.yml`** — added `docs/Temp/` to the GitHub Pages exclude list (defence in depth — see Security below).

### Security

- **`docs/Temp/`** added to `.gitignore` and `_config.yml` exclude list. This is the local-only working folder for source PPTX decks, extracted PPTX media, and internal Microsoft reference material used to build the new page. **It must never be committed or published** — it can contain internal-only material. Both gates are now in place: git won't commit it, and Jekyll won't publish it even if a clone has it locally.
- **No new external runtime calls**. JSZip is loaded from `vendor/`; all icons, the cover logo, and the deck assembly happen client-side. The only outbound traffic from the new page is the existing Firebase page-view counter (unchanged).
- **No new third-party CDN dependencies** — JSZip was vendored locally rather than referenced from a CDN, matching the existing policy for `html2canvas`, `jspdf`, and `three.js`.
- **Cross-origin SVG → canvas rasterization** uses same-origin URLs only (icons live under `docs/reference-architectures/icons/`), so the canvas is never tainted and `toDataURL()` is safe.
- **No use of `innerHTML` with user-controlled input**. The narrative builder calls `escapeHtml()` on every variable interpolation; the SVG renderer constructs DOM nodes via `document.createElementNS()`.

---

## [0.21.02] - 2026-05-05

Security- and code-quality-hardening release. Resolves all 12 open CodeQL code-scanning alerts on the repository (1 × `js/xss-through-dom`, 11 × `js/remote-property-injection`) and the 8 open AI-generated Code Quality findings on the *Code quality → AI findings* tab. No user-visible behaviour changes; all 1,130 tests still pass.

### Security (CodeQL alerts cleared)

- **`js/xss-through-dom` — Sizer JSON Import preview (alert #15, `sizer/sizer.js:6797`).** The Sizer's *Parse & Preview* path for an Azure Local machine JSON paste (`parseAndPreviewClusterJSON()`) now explicitly coerces every JSON-derived numeric value (`coreCount`, `coresPerSocket`, `sockets`, `memoryGiB`) to `Number()` immediately before they are interpolated into the preview HTML. This makes the type-narrowing barrier explicit on the data-flow path from `<textarea>.value` → `JSON.parse(...)` → `previewDiv.innerHTML`. String values were already escaped via `escapeHtml()`; this closes the remaining unsanitised-numeric-interpolation path that CodeQL was flagging.
- **`js/remote-property-injection` — eleven sites where the code wrote to a JS object using a key derived from user-supplied data (alerts #16–#26)** have been hardened against prototype-chain pollution. In ten of the eleven cases the receiving dictionary is now created via `Object.create(null)` — a prototype-less object, so a key like `__proto__` / `constructor` / `toString` can no longer reach `Object.prototype`:
  - `report/pptx-export.js` — `bySpeed` (line 1775) and `bySpeed2` (line 1798) NIC-speed dictionaries (alerts #16, #17).
  - `report/report.js` — `groupsByZoneD` / `zoneLeafCountersD` for Disaggregated NIC-zone grouping (lines 2370, 2371, 2374; alerts #19–#21); `buckets` for custom-intent grouping (line 3529; alert #22); `buckets` for hyperconverged adapter grouping (line 3577; alert #23); `groupsByZone` / `zoneLeafCounters` for Hyperconverged NIC-zone grouping (lines 4326, 4327, 4330; alerts #24–#26).
  - `js/disaggregated.js` — `state.disaggAdapterMapping[portId] = targetZone;` at `moveDisaggAdapter()` (line 2076; alert #18) is reached via a drag-and-drop event whose `portId` originates from `e.dataTransfer.getData('text/plain')` and is therefore user-controlled. Because `state.disaggAdapterMapping` is a long-lived shared object that can't be swapped to `Object.create(null)`, `portId` is now validated against the known port list (`getDisaggPortList()`) before being used as a property key — any unknown key is silently rejected.
- **No functional changes.** These are defence-in-depth hardenings against a class of vulnerability that wasn't previously exploitable through the UI (the writes happened on application-controlled state, not arbitrary attacker input), but the data-flow paths CodeQL was flagging (paste-JSON-into-Sizer-import, drag-drop disaggregated adapter pill) had no allow-listing on the property key — so the alerts are now genuinely cleared rather than dismissed.

### Changed (AI Code Quality findings cleared)

- **`js/stats-bar.js`** — the em-dash counter placeholder is now a named `STAT_PLACEHOLDER` constant at the top of the IIFE instead of an inline `'\u2014'` unicode escape inside the template literal, so the intent ("empty / not-yet-loaded counter") is named.
- **`scripts/smoke-test-pptx.js`** — the *PPTX size too small* error message now reads `expected > 50 KB (template + cover + 11 sections + closing slide)`, matching the file-header comment instead of the older *"13 slides"* phrasing.
- **`switch-config/index.html`** — removed the stray space before `>` in the *Arizona (MST, no DST)* `<option>` tag so its formatting matches every other timezone option in the dropdown.
- **`tools/demos/generate-disagg-fc-deck.spec.js`** — the `page.on('dialog')` handler now `console.warn`s with the `[PPTX generation]` prefix when `d.accept()` rejects (instead of silently swallowing), matching the prefix already used elsewhere in the file; the *"Saved ... bytes"* line was also reformatted with the same prefix.
- **`tools/demos/odin-full-walkthrough.spec.js`** — `slowMo` is now configurable via the `ODIN_DEMO_SLOWMO` env var with a default of 120 ms (was hard-coded 80 ms), so the demo records cleanly on slower hardware. The two `button.workload-type-btn` selectors that filtered by visible text (*"AKS Arc Clusters"*, *"Azure Local VMs"*) now use the existing stable `onclick="showAddWorkloadModal('aks')"` / `'vm'` attributes instead, so the demo doesn't break if the button copy changes. (Production HTML was deliberately not modified to add `data-testid` attributes — `tools/` is excluded from publication and the existing `onclick` markup is already a stable selector.)

### Note on AI Code Quality scope

- **No suggestions were dismissed**; the implementations differ from the verbatim AI suggestions in two narrow places where adopting them as-is would have over-engineered single-use tooling code: the `STAT_PLACEHOLDER` constant uses the existing `\u2014` escape for byte-equivalent diff (no risk of a stray copy-paste em-dash in source), and the demo selector switch uses `[onclick*="'aks'"]` rather than adding `data-testid` attributes to `sizer/index.html`. Net effect on the AI Code Quality tab is the same — all 8 findings cleared without modifying production HTML for tooling-only benefit.

---

## [0.21.01] - 2026-05-05

Minor release. Fixes Sizer mobile layout on iPhone / narrow viewports, and corrects Rack-Unit and Network Infrastructure Power calculations to match what's actually rendered in the 3D rack visualization across **every** Sizer cluster type — Single-node, Hyperconverged, Rack-Aware, Disaggregated, and Low Capacity.

### Fixed (#210 — Sizer mobile layout on iOS / narrow viewports)

- **Sizer no longer overflows the viewport horizontally on iPhone and other narrow screens.** Reported on iPhone 16 Pro (390px logical width) and reproduced in Edge DevTools at 390px: the Workload Scenarios / Recommended Instance Configuration / Physical Node(s) form panels rendered ~614px wide on a 390px viewport, forcing horizontal scroll and visually misaligning the disclaimer banner, header title, stats bar, and 3D Hardware Visualization section against the form panels.
- **Root cause** was an interaction between three things: (1) the `.sizer-layout` CSS Grid with `grid-template-columns: 1fr` on mobile — `1fr` resolves to `minmax(auto, 1fr)`, which honours the track's intrinsic min-content; (2) the CPU Generation `<select>` whose longest `<option>` text (e.g. `Intel® 4th Gen Xeon® (Sapphire Rapids)`) forced its intrinsic min-content width to ~353px; and (3) cascading flex containers (`.section-header-row`, `.config-row`, `.export-actions`) with no `flex-wrap` whose intrinsic widths combined with the wide `<select>` to push the panel track to ~614px. Designer doesn't hit this because its mobile layout is a single flex column with no `<select>` inside a CSS Grid track.
- **Fixes applied to `sizer/sizer.css`:**
  - `min-width: 0` on `.config-panel` / `.results-panel` — lets each grid track collapse to the actual `1fr` share instead of being held open by descendant min-content.
  - `max-width: 100%` on `.config-row select` — the dropdown can't push wider than its parent column even if its longest option text would.
  - `flex-wrap: wrap` on `.section-header-row`, `.config-row`, `.export-actions` — section titles, label/select pairs, and the export button row now wrap onto a second line on narrow screens instead of forcing the parent to grow.
  - `flex: 1 1 auto` (was `flex: 1`) on `.export-actions .btn` — buttons keep their natural width when wrapped, instead of stretching to fill a single row that's wider than the viewport.
  - Removed the mobile-only `padding: 0 25px` overrides on `<header>`, `.disclaimer-wrapper`, and `.sizer-footer` introduced in PR #170 (March 2026). Those overrides indented those three elements by an extra 25px on mobile *but did not extend to the form panels or 3D Hardware Visualization section*, which is why the title/disclaimer/footer didn't visually line up with the rest of the page on iPhone. All four now share the `.container`'s 16px mobile padding and align flush against the same edge — same approach Designer already uses (`css/style.css`).
- **Verified** at viewport widths 390 / 768 / 1024 / 1400 px: zero horizontally-overflowing elements, single-column layout below 1025px, two-column layout at 1400px, and `documentElement.scrollWidth === viewport.clientWidth` at every tested width. All 1,130 tests still pass.
- **Lightning-bolt icon next to *Estimated Power, Heat & Rack Space per Instance*** is now rendered filled in the existing `--warning` amber colour (`#f59e0b`), instead of an unfilled outline in the heading's text colour. Same visual language as the rest of the project's warning / power UI cues.

### Fixed (Sizer Rack U / power: BMC switch now counted in non-disaggregated clusters)

- **Rack-Unit estimate and Network Infrastructure Power on the Sizer now correctly include 1 × 1U BMC switch per rack** for Single-node, Standard Hyperconverged, and Rack-Aware Cluster deployments. Previously only the Disaggregated path counted the BMC switch; the other three paths counted only the ToR switches (or, in the single-node case, *no* switches at all), which under-counted rack U by 1U per rack and under-counted infrastructure power by 150W per rack. The 3D rack visualization and 2D rack diagram have always rendered a BMC switch in every rack — including single-node — so the headline numbers now match what's drawn.
- **Per-cluster-type behaviour:**
  - **Single-node:** rack U now `(2U node) + 1U BMC = 3U` (was `2U`); infra power `1 × 150W = 150W` (was `0W`).
  - **Standard Hyperconverged (1 rack):** rack U now `(nodes × 2U) + 2 × ToR + 1 × BMC = +3U of switches` (was `+2U`); infra power `(2 × 250W) + (1 × 150W) = 650W` (was `500W`).
  - **Rack-Aware (2 racks):** rack U now `(nodes × 2U) + 2 × (2 × ToR + 1 × BMC) = +6U of switches` (was `+2U`); infra power `2 × ((2 × 250W) + (1 × 150W)) = 1,300W` (was `500W`). Rack-Aware also now annotates the rack-U value with a small `(across 2 racks, incl. 4 × ToR, 2 × BMC switches)` caption underneath.
  - **Disaggregated:** unchanged — already counted ToR + BMC + FC + Spine per rack.
- **`#rack-units-label` text** now reflects the cluster type: *"Rack Units (est., incl. 1 × BMC switch)"* for single-node, *"… incl. 2 × ToR + 1 × BMC switch"* for Standard, and *"… incl. 4 × ToR + 2 × BMC switches across 2 racks"* for Rack-Aware. The static initial label in `sizer/index.html` was updated to match so the page renders correctly before any user interaction.
- **Power-detail expander breakdown** (`#power-detail-content`) now lists ToR and BMC as separate line items for non-disaggregated clusters (e.g. *"ToR switches: 2 × 250W = 500W"* and *"BMC switches: 1 × 150W = 150W"*), and shows just *"BMC switch: 1 × 150W = 150W"* for single-node, instead of a single misleading *"ToR switches: 2 × 250W"* line.
- **Verified end-to-end via Playwright:** Single-node = 3U / 904W total; Standard 2-node = 7U / 2,158W; Standard 4-node = 11U / 3,666W; Rack-Aware 4-node = 14U / 4,316W; Rack-Aware 8-node = 22U / 7,332W.

### Fixed (Sizer Low Capacity: rack U / power now reflect compact edge hardware)

- **Low Capacity rack-U and infrastructure power now match the 3D tabletop visualization** that has always rendered Low Capacity as compact appliances (not server-class 2U hardware) on a tabletop with at most one small edge switch.
- **Networking model corrected** to match Microsoft's documented [networking requirements for low-capacity systems](https://learn.microsoft.com/en-us/azure/azure-local/concepts/system-requirements-small-23h2?view=azloc-2604#networking-requirements): Low Capacity does **not** require a separate BMC switch (BMC traffic shares the same edge switch via an out-of-band management VLAN), and it uses **at most one** small edge switch shared by management, compute, and storage traffic. (2-node switchless and 3-node switchless variants need no switch at all, but the Sizer doesn't model the switchless sub-variant separately, so the conservative assumption is 1 edge switch for any multi-node Low Capacity deployment.)
- **What changed in the headline numbers:**
  - **Rack-U** is now `1U per appliance` (was `2U per node` — wrong for compact / non-server-class hardware) plus `1U` for the edge switch only when nodeCount > 1. No BMC switch counted.
  - **Infra power** is now `50W` (1 × small managed L2/L3 edge switch, e.g. Cisco CBS350 class) for multi-node, or `0W` for single-node Low Capacity (standalone tabletop). Previously the Sizer was applying the 2 × ToR + 1 × BMC server-class assumption (`650W`) to Low Capacity, which is roughly **13× too high**.
  - Net effect: Single-node Low Capacity = 1U / 0W infra (was 2U / 0W). 2-node = 3U / 50W infra (was 5U / 500W). 3-node = 4U / 50W infra (was 7U / 500W).
- **`#rack-units-label`** now shows *"Hardware Footprint (est.)"* for Low Capacity, with the value reading *"Tabletop — 2 appliances + 1 switch"* / *"Tabletop — standalone appliance"* (no `U` figure) — Low Capacity is not a rack-mounted deployment, so the rack-unit count is no longer meaningful for it. For all rack-mounted cluster types (Single-node, Standard HCI, Rack-Aware, Disaggregated) the label is now simply *"Rack Units (est.)"* with the breakdown (e.g. *"1 rack: 4 × server node (2U each) + 2 × ToR (1U) + 1 × BMC (1U)."*) tucked behind a small expandable chevron next to the value.
- **Power-detail expander breakdown** now shows *"Edge switch: 1 × 50W"* for multi-node Low Capacity instead of the (incorrect) *"ToR switches: 2 × 250W"* fallback line. The Assumptions section gained an explicit *"Low-capacity edge switch: ~50W"* entry alongside the existing ToR / BMC / Spine / FC numbers.
- **Per-node power was already correct** because the Sizer derives node power from the Low-Capacity-constrained CPU/cores/memory/disk profile (single socket, ≤14 cores, 32–128 GB, no cache tier). The bug was only in the rack-U total and the network-infrastructure power add-on.

### Changed (Sizer "Estimated Power, Heat & Rack Space" panel)

- **Rack Units cell now uses an expandable disclosure** instead of stuffing the breakdown into the label / value text. Reported overlap on iPhone and desktop where the long *"(est., incl. 2 × ToR + 1 × BMC switch)"* label and the *"7U (across 2 racks, incl. 4 × ToR, 2 × BMC switches)"* caption HTML in the value were running into each other inside the flex row.
- The cell now renders as: a clean label (*"Rack Units (est.)"*) and a clean value (*"7U"*), with a small blue chevron `▸` next to the value that expands to a single-line breakdown beneath (e.g. *"1 rack: 4 × server node (2U each) + 2 × ToR (1U) + 1 × BMC (1U)."*). The chevron is keyboard-accessible (`<button>` with `aria-expanded` / `aria-controls`), rotates on expand, and is hidden entirely for Low Capacity (where the breakdown isn't meaningful).
- For Low Capacity, the cell label changes to **"Hardware Footprint"** (no "(est.)" suffix — the value text already conveys "tabletop / approximate") and the value reads *"Tabletop — N appliances + 1 switch"* (or *"Tabletop — standalone appliance"* for 1 node). No `U` figure is shown because Low Capacity is not a rack-mounted deployment.
- **Low Capacity Hardware Footprint cell now stacks the label and value vertically** when the value text is too long for a one-row layout (e.g. *"Tabletop — 3 appliances + 1 switch"*). Reported on desktop and iPhone where the label *"Hardware Footprint (est.)"* and the value were colliding inside the flex row. Other cluster types keep the compact single-row layout (label ↔ `7U ▸`).

### Changed (Sizer "Capacity Usage for Workload" — Low Capacity)

- **The Capacity Usage progress bar now matches the Low Capacity deployment's actual maximum.** Selecting Low Capacity now relabels the top bar to **"Azure Local low capacity instance size"** and caps the machine count at **3** (e.g. `2 / 3`) instead of falling through to the Hyperconverged default of `/ 16`. Per Microsoft's [system requirements for low-capacity Azure Local](https://learn.microsoft.com/azure/azure-local/concepts/system-requirements-small-23h2#networking-requirements), Low Capacity supports 1, 2, or 3 nodes only.
- Other cluster types are unchanged: Standard HCI = `/ 16`, Rack-Aware = `/ 8`, Single-node = `/ 1`, Disaggregated = `/ 64`.

### Fixed (Sizer Disaggregated rack-U: external SAN appliance no longer counted)

- **The Disaggregated rack-U total no longer includes the external SAN storage appliance.** SAN form factor varies wildly by vendor (Pure Storage, NetApp, Dell EMC PowerStore, etc.) and is the customer's choice — counting a fixed `5U per rack` was misleading. This now mirrors the existing treatment of SAN power, which has always been excluded from the headline Watts figure with a *"consult your SAN vendor"* note.
- **Effect** (4-node Disaggregated across 2 racks): iSCSI was `24U` → now `14U` (`8U nodes + 4U ToR + 2U BMC`); FC SAN was `28U` → now `18U` (`+ 4U FC`). Server nodes, ToR, BMC, and FC switches are still counted.
- **Expandable breakdown** now ends with: *"External SAN storage appliance(s) are not counted — consult your SAN vendor for actual rack-U."*

### Closes

- [#210 — Sizer: Formatting issue when using a mobile device to view sizer](https://github.com/Azure/odinforazurelocal/issues/210)

---

## [0.20.67] - 2026-04-30

Security and code-quality release. Tightens the build, dependency, and CI surface, plus a focused round of Sizer JSON-import fixes (#207) and ToR Switch page parity work.

### Fixed (#207 — Sizer: JSON Import of Azure Local Machine)

- **CPU socket count from imported JSON is now respected.** The previous heuristic in `parseAndPreviewClusterJSON()` (`var sockets = coreCount > 64 ? 2 : 1;`) unconditionally overrode the value extracted from `hwProfile.numberOfCpuSockets` / `detectedProperties.processorCount`, so a machine reporting 2 sockets always showed up as 1 socket in the Sizer. The heuristic now only fires when the JSON value is missing or invalid.
- **Total core count is now reconciled correctly across the two source paths.** `hardwareProfile.processors[i].numberOfCores` is *per-socket*, while `detectedProperties.coreCount` is *total cores*; the original code mixed these and produced `20 × 1 socket` for ASEPRO2 machines (which expose `processors[0].numberOfCores: 20` per-socket but omit `numberOfCpuSockets`). The parser now prefers `detectedProperties` (unambiguous total + sockets) and only falls back to multiplying per-socket cores by the resolved socket count.
- **1-node imports now correctly set Deployment Type to Single Node**, not Hyperconverged (which is invalid for 1 node).
- **Storage Resiliency now auto-matches the imported node count**: 2 nodes → Two-way Mirror, 3+ nodes → Three-way Mirror. Previously the import always left the default `2way` value even for 4-node clusters.
- **Deployment-type prompt added to the Parse & Preview screen**: users can choose between Hyperconverged and Rack-Aware Cluster before applying the import. Single Node is auto-applied when machines = 1 regardless of the radio selection.
- **Rack-Aware Cluster machine-count validation added to the import preview.** Rack-Aware Cluster only supports 2, 4, 6, or 8 machines; the Load Cluster Configuration button is disabled and an inline error is shown until the count is valid (or the user picks Hyperconverged).
- **"Apply Configuration" renamed to "Load Cluster Configuration"** in the import modal — the button now describes what it actually does (load the parsed Azure Local Machine JSON into the Sizer).
- **Apply order reworked** so `node-count` is set before `cluster-type`, ensuring `updateResiliencyOptions()` sees the correct node count and produces the right `<option>` set before the resiliency value is assigned.
- **Memory dropdown preserves non-standard DIMM totals** via a custom option (mirrors the cpu-cores pattern): an imported lab VM with 80 GB now creates an `80 GB (imported)` option in `node-memory` and selects it, instead of silently rounding to the nearest standard DIMM (64 GB).
- **S2D capacity-disk count and size captured in the import preview.** Azure Local JSON does not expose S2D data disks, so the preview now offers Disk Count (2–24, default 4) and Disk Size (0.96–15.36 TB, default 3.84) selects, and `applyClusterJSONImport()` writes them to BOTH the single-tier (`capacity-disk-*`) and tiered (`tiered-capacity-disk-*`) selectors so the values are correct regardless of which storage architecture the user later picks.
- **5.68 TB SSD added to all capacity-disk dropdowns** (`capacity-disk-size`, `cache-disk-size`, `tiered-capacity-disk-size`) and to `DISK_SIZE_OPTIONS_TB` to match a customer-reported drive size.
- **`onCpuManufacturerChange()` and `onCpuGenerationChange()` calls** in `applyClusterJSONImport()` now wrapped in `try/catch` (matching the existing pattern for `onClusterTypeChange` and `onResiliencyChange`) so a transient CPU-dropdown population error during import no longer aborts the whole apply path before memory and disks are set.
- **Re-parse preserves user-modified preview selections.** If the import preview is already rendered and the user has changed the machine count, deployment-type radio, or S2D disk count / size, `parseAndPreviewClusterJSON()` now captures those values before rebuilding the preview HTML and restores them afterwards. Accidental re-clicks of *Parse & Preview* no longer wipe non-default selections.
- **30 new regression tests** added under `tests/index.html` ("Issue #207") covering all of the above plus boundary conditions (1, 2, 3, 4, 5, 8 nodes; Hyperconverged vs Rack-Aware; valid / invalid `numberOfCpuSockets`; ASEPRO2-shaped JSON; 80 GB lab-VM memory; custom memory option injection; S2D disk-count and disk-size apply path including 5.68 TB).
- **JSON import → Configure in Designer integration test** added (`tests/index.html`, suite *"JSON import → Configure in Designer handoff (#207 integration)"*) — verifies that after `applyClusterJSONImport()` populates the Sizer DOM, the values that `selectRegionAndConfigure()` reads (cluster-type, node-count, `mapSizerToDesignerScale()` output) match the imported JSON for 4-node Hyperconverged, 6-node Rack-Aware, and 1-node single-node cases, plus that imported memory and S2D disk values reach the DOM fields the Designer payload will read.

### Fixed (ToR Switch page parity)

- **Stat tiles on the ToR Switch page now show real counts.** The page rendered the six-tile bar but every value stayed at `—` because `js/utils.js` (which defines `formatNumber()`) was not loaded; `fetchAndDisplayStats()` threw a silent `ReferenceError` before populating any tile. `switch-config/index.html` now loads `../js/utils.js` alongside `../js/analytics.js` and `../js/stats-bar.js`.
- **Header layout aligned with Designer and Sizer.** The ToR Switch page previously had a plain `<h1>` with no logo, version, or What's New link. Restructured to use the shared `header-title-wrapper` / `header-logo-wrapper` / `header-version` markup plus the `whats-new-link` button (powered by `js/changelog.js`, now also loaded on this page). Title text follows the established convention: **ODIN ToR Switch for Azure Local**. The same disclaimer banner that appears on Designer and Sizer is now rendered above the header on this page too.

### Added

- **`vendor/` folder** with locally-hosted copies of all third-party runtime JS:
  - `vendor/html2canvas-1.4.1.min.js` (MIT)
  - `vendor/jspdf-4.2.1.umd.min.js` (MIT)
  - `vendor/three-0.128.0.min.js` (MIT)
  - `vendor/three-OrbitControls-0.128.0.js` (MIT)
  - `vendor/README.md` documenting versions, licenses, and source URLs.
- **`.stylelintrc.json`** — minimal CSS lint config with `custom-property-no-missing-var-function` and `color-no-invalid-hex` enabled to catch the bug class that surfaced in Copilot AI findings (undefined `--nav-bg`, `--disclaimer-bg`, `--disclaimer-border`).
- **`.github/workflows/codeql.yml`** — CodeQL security and quality scanning, runs on PR + weekly.
- **Anonymous usage counters on the ToR Switch Configuration page**:
  - `analytics/formCompletions/switchConfigGenerated` — increments when the **Generate Switch Configurations** button successfully renders output.
  - `analytics/formCompletions/qosAuditAnalyzed` — increments when the **Analyze QoS Configuration** button successfully renders audit results.
  - `analytics/pageViews` is also now tracked when the page loads (matches Designer / Sizer behaviour).
  - All counters are increment-only via Firebase server-side `increment(1)`; no switch-config content, IPs, hostnames, or pasted running-config text is ever transmitted.
- **Two new stat tiles on the page-statistics bar** (Designer, Sizer, and the new bar on the ToR Switch Configuration page): **ToR Switch Configs** and **ToR Switch QoS Audits**, surfacing the two new counters next to the existing Visitors / Designs Generated / Sizes Calculated / ARM Deployments tiles. The bar now uses a 3-column grid on desktop (3+3 layout) and a 2-column grid on mobile (2×3 layout), giving a deterministic two-row stack at all viewport widths.
- **Shared `js/stats-bar.js` component** — the six-tile counter strip is now rendered from a single source by injecting markup into a `<div id="page-statistics" data-stats-bar></div>` placeholder. Replaces three near-identical hand-maintained copies in `index.html`, `sizer/index.html`, and `switch-config/index.html` that had drifted from one another. Single source of truth for tile labels, icons, and order.
- **ToR Switch tab added to the shared top navigation** (`js/nav.js`). The Designer, Sizer, and ToR Switch Configuration pages now show a consistent `Designer | Sizer | ToR Switch | Knowledge` tab bar — the three "doing" tabs sit together first, with the reference / docs tab last. The ToR Switch Configuration page previously had its own one-off `page-header-bar` with just an ODIN logo and a static title; that header is replaced by the shared `<nav class="odin-tab-nav">` block (and the dead `.page-header-bar` family of CSS rules in `switch-config.css` has been removed).
- **First-visit walkthrough + Help button on the ToR Switch page** (`switch-config/switch-config.js`, `js/nav.js`). Mirrors the Sizer onboarding pattern: a 3-step overlay (Welcome / Generator / QoS Validator) appears once on first visit, gated by `localStorage` key `odin_switch_onboarding_v0_20_67`. The shared nav-bar Help (?) button is now also rendered when the ToR Switch tab is active and re-launches the same overlay on demand. Reuses the existing `.onboarding-overlay` / `.onboarding-card` styles in `css/style.css` — no new CSS.
- **New "Workloads" slide in the PowerPoint export** (`report/pptx-export.js`). When the configuration report was started from the Sizer (so the report has `sizerWorkloads` data), the generated PPTX now includes a dedicated Workloads slide — positioned right after Node Configuration — with one bullet per workload (VM / AKS Arc / AVD) showing the headline spec plus a Subtotal sub-bullet (vCPUs · memory · storage). The slide auto-skips when no Sizer workload data is present, so non-Sizer reports are unaffected. Smoke-test slide count and assertions are unchanged.
- **PowerPoint slide "Rack Configuration" renamed to "Node Configuration"** (`report/pptx-export.js`). The slide content is per-node hardware (CPU, sockets, memory, disks, resiliency, cluster type) — the new title describes what it actually shows.
- **Designer “Start Over” now fully resets state.** Previously the hand-maintained property list inside `resetAll()` (`js/script.js`) omitted `sizerHardware`, `sizerWorkloads`, `architecture`, `fqdnConfirmed`, `portConfigConfirmed`, and the entire `disagg*` block, so a Start Over click left Sizer-imported workloads and disaggregated configuration behind. Defaults were extracted into a single source-of-truth factory `getInitialWizardState()` and `resetAll()` now rebuilds state from that factory — user preferences (`theme`, `fontSize`) are explicitly preserved. Three new regression tests in `tests/index.html` lock the behaviour in.
- **Disconnected (ALDO) state now also resets cleanly on Start Over.** Final-review pass found that `clusterRole` and `autonomousCloudFqdn` — both used throughout the disconnected scenario UI, validation, summary, and ARM mapping — were not in the new factory either (they were also missing from the original hand-maintained reset list). Added them to `getInitialWizardState()`, to both `knownFields` inventory tests, and extended the resetAll regression test to assert they clear from `'management'` / `'cloud.contoso.local'` back to `null`. Without this, an ALDO management-cluster handoff (or a manual disconnected-Designer session) would leak the cluster role + Autonomous-Cloud FQDN into the next session after Start Over.
- **ToR Switch page is now usable without first running the Designer, and the deployment-type picker is now always visible at the top of the page.** Previously, opening `switch-config/index.html` with no Designer state in `localStorage` showed only a "No Designer Data Found ← Go to Designer" stub — the entire generator was inaccessible. The first iteration added a one-time **Quick Start** picker that disappeared once defaults were applied, but that left a real UX gap: a user who arrived with stale Designer state (or even a fresh transfer) had no on-page control to change the deployment scenario without going back to Designer. The picker is now a permanent **Deployment Type** card at the top of the page that:
  - Lists the same five canonical scenarios as the QoS Validator, grouped under `<optgroup>` headings (Hyperconverged: *All Traffic Converged*, *Storage Switched*, *Storage Switchless*; Disaggregated: *Fibre Channel SAN*, *iSCSI*) plus a *Single Rack / Rack-Aware* radio toggle.
  - Auto-pre-selects to match whatever state is loaded — Designer transfer, prior synthesized defaults, or factory default (HCI Storage Switched, single rack).
  - Switches its heading badge between "loaded from Designer" / "using picker defaults" / "no Designer data" so the user knows at a glance what's driving the form below.
  - Switches its apply-button label between "▶ Use These Defaults" (no data loaded) and "↻ Apply" (form already populated; clicking will replace the form).
  - When the user changes the picker after the form is loaded, smooth-scrolls the form back into view so they can verify the change took effect without losing the picker at the top.

  Implementation: `buildQuickStartState()` synthesizes a minimal Designer-style state per profile (exposed as `window.__buildQuickStartState` for tests); `applyQuickStart()` overwrites the in-memory `designerState` and re-runs the existing `populateFromDesigner()`; `updateQuickStartHeading()` swaps the card copy + button label based on current mode; `preselectQuickStartFromDesigner()` keeps the dropdown in sync. The previous in-form "Quick Start mode" banner with its *Change Deployment Type* button has been removed (the picker is always visible, so the secondary control is redundant). Removed an internal `trackFormCompletion('switch_config_quick_start', ...)` analytics call that would have silently failed (the event type is not in the whitelist in `js/analytics.js`, and `trackFormCompletion` only accepts a single string argument). Eight new tests in `tests/index.html` lock in the synthesized-state shape per profile (architecture, intent, storage, scale, nodes, `disaggStorageType`, `disaggRackCount`).
- **`loaded from Designer` badge no longer lies about stale data.** Follow-up fix: the picker heading depends on whether `designerState` was populated from `localStorage[odinDesignerToSwitchConfig]`, but that key is written by the Designer's "Generate ToR Switch Configuration" action and persisted indefinitely — so any past transfer (even from a previous browser session) made the badge claim "loaded from Designer" on every subsequent visit, regardless of whether the user actually clicked the Designer button this time. `loadDesignerData()` (`switch-config/switch-config.js`) now treats the localStorage payload as valid only when the page was opened with the `?from=designer` query parameter (the explicit signal that `transferToSwitchConfig()` writes alongside the localStorage entry), and removes the key after consumption so a manual refresh of the same tab — or a fresh visit without the query — starts in the clean *"no Designer data"* mode and shows just the picker. The companion `addComputeVlan()` helper used to re-read the same localStorage key for its rack-aware SVI defaults; it now reads the in-memory state via a new `window.__getSwitchConfigDesignerState` accessor (declared inside the IIFE so the global helper can still see the live state after the consume-once clear).
- **Disaggregated rack count is now selectable from the Deployment Type picker (1–8 racks).** Previously the picker only offered a binary *Single Rack / Rack-Aware* radio toggle, which mapped Fibre Channel SAN and iSCSI to either 1 or 2 racks. The form below the picker has always supported 1–8 disaggregated racks (each rack is one leaf pair feeding the spine), so the picker was artificially constrained. The picker now swaps the binary radio for a numeric input (1–8) when *Fibre Channel SAN* or *iSCSI* is selected, and `applyQuickStart()` threads the value through `buildQuickStartState(profile, scale, disaggRackCount)`. The synthesized state's `nodes` count is now `racks × 2` for disaggregated profiles (a reasonable default of 2 nodes per rack), instead of the legacy 4/8 it used to produce regardless of rack count. Hyperconverged scenarios are unchanged — they still expose the binary single/rack-aware radio. Five new unit tests in `tests/index.html` cover: 4-rack FC SAN, 8-rack iSCSI (max), out-of-range fallback to the binary mapping (rack count 0, 9, NaN), and the updated single-rack disaggregated `nodes=2` default.
- **Storage Switchless no longer offers a Rack-Aware option.** Storage Switchless wires the storage NICs directly between nodes within a single rack, so a rack-aware (multi-rack) cluster is not a supported topology. The Deployment Type picker now hides the *Rack-Aware (2 racks, 4 ToR switches)* radio when *Storage Switchless* is selected, and forces any previously checked rack-aware selection back to *Single Rack*. As a defence-in-depth measure, `buildQuickStartState('hci_switchless', 'rack_aware')` itself also overrides `scale` to `'single'` and `nodes` to `4` so even a programmatic call cannot synthesize a switchless rack-aware state. New regression test in `tests/index.html`.
- **Removed the redundant in-form "Storage Switchless · 8 nodes · …" deployment-info banner from the ToR Switch page.** The same information is now shown by the always-visible Deployment Type picker at the top of the page (heading badge: "loaded from Designer" / "using picker defaults" / "no Designer data") and by the form fields below; keeping a second text banner caused user-visible drift after Quick Start defaults were applied (e.g. the picker said *"using picker defaults"* while the in-form banner still claimed *"Storage Switchless · 8 nodes · Rack-Aware Cluster (2 racks)"*, an invalid combination). Removed `#sc-deployment-banner` and its surrounding logic in `populateFromDesigner()`; the disaggregated leaf-scope warning banner directly below it is unchanged (it carries a critical scope warning, not deployment metadata). The `resolveDeploymentPattern()` helper is retained because it's still used to decide how the storage-VLAN section is labelled and populated.
- **Storage VLAN section, section title, and per-VLAN labels now reset cleanly between Quick Start picker scenarios.** Latent bug surfaced by the always-visible picker: `populateFromDesigner()` had three mutually-exclusive branches (disaggregated → set title to *"Cluster Networks"* + Designer-supplied VLAN labels; switchless → hide the section; otherwise → populate VLANs) but never **restored** the section to defaults at the start of a re-run. As a result, switching the picker from `hci_switchless` to any other profile left the section invisible, and switching from a disaggregated transfer to an HCI profile left the section title stuck at *"Cluster Networks"* with stale Designer-supplied per-VLAN labels. `populateFromDesigner()` now resets `#sc-storage-section` display, `#sc-storage-section-title` text (back to the static *"Storage Networks"*), and both per-VLAN labels back to the static *"Storage VLAN 1/2 (ToR1/2)"* defaults at the top of the function, before the disagg / switchless / default branches specialize.
- **Compute VLAN 2 / 3 blocks now hide on subsequent picker applies.** Same class of latent bug: the disaggregated-with-multiple-tenant-networks path in `populateFromDesigner()` un-hides the optional `#sc-compute-vlan-2` / `#sc-compute-vlan-3` blocks when populating extra tenant VLANs, but never re-hid them when the Quick Start picker switched to a profile with no tenant networks (e.g. `hci_switched` or any single-tenant disagg profile). The function now hides both blocks up-front; the tenant loop re-shows the ones it actually populates.
- **Rack diagrams in `report.html` no longer overlap the title with the "Azure Local" brand badge on narrow layouts.** The standard and disaggregated SVG generators in `report/rack-svg.js` sized themselves purely from `totalRackWidth + padding`, so a single-rack diagram produced an SVG ~280 px wide — narrow enough that the centred *"Rack Layout — Front View"* title slid under the *"Azure Local"* logo and text in the top-right corner (visible in #208 conversation). Both generators now clamp `svgW` to a minimum of 380 px (computed as title width ~180 + brand badge ~92 + padding × 2) and centre the rack content inside the (possibly widened) SVG via a new `rackBlockOffsetX` / `disaggOffsetX`, so all rack frames, core/spine/leaf connectors, SAN/iSCSI boxes and their connector lines stay aligned with the rack columns. Wider multi-rack diagrams are unaffected.
- **Sizer "Estimated Power, Heat & Rack Space per Instance" panel is now always visible** (`sizer/sizer.js`, `sizer/index.html`). Previously the panel was hidden until the first workload was added, which made it hard to compare the data-centre footprint of different hardware configurations during early planning. Power, BTU/hr, and rack-unit estimates are derived purely from the hardware config + node count (CPU TDP scaling, DIMM count, disk type/count, GPU count, network switches), so they are valid even with zero workloads. The 3D rack visualization at the bottom now also renders with the real hardware values immediately, instead of falling back to a hardcoded preview config.
- **Sizer Power & Heat estimates now flow into the Designer report and PowerPoint export.** Previously the data-centre footprint figures (per-node Watts, total Watts, BTU/hr, rack U, network infrastructure power, per-node component breakdown) lived only on the Sizer page and were lost the moment the user clicked **Configure in Designer**. The Sizer→Designer handoff now captures the computed numbers in `sizerHardware.power`, threads them through `state.sizerHardware`, renders a new **"Power, Heat & Rack Space (from Sizer)"** section in `report.html`, and adds a dedicated **Power, Heat & Rack Space** slide to the generated PowerPoint (auto-skipped when the report wasn't started from the Sizer). Implementation: new module-scoped `_lastPowerEstimate` in `sizer/sizer.js` populated by `updatePowerRackEstimates()`, attached to the handoff payload in `selectRegionAndConfigure()`, rendered in `report/report.js` via a new `sizerPowerRows` block, and surfaced as a new SECTION_PLAN entry with `extractSizerPower` in `report/pptx-export.js`.
- **Single-rack hyperconverged rack diagram in `report.html` no longer renders gigantic.** The static SVG produced by `report/rack-svg.js` had `style="max-width: 100%; height: auto"` with no upper bound — for tall+narrow aspect ratios (one rack with 8–16 nodes), browsers stretched the SVG to fill the parent card width via the default `width: 100%`, making the title, core switch, and node tiles many times their natural size (see screenshot in #208 conversation). Both the standard and disaggregated SVG generators now emit `style="width: 100%; max-width: <intrinsic-width>px; height: auto; margin: 0 auto"`, capping upward scaling at the natural intrinsic width while still allowing downward scaling on narrow viewports.
- **`scripts/smoke-test-pptx.js`** — Puppeteer-driven smoke test that loads `report/report.html` with a seeded payload, intercepts the generated Blob, and asserts ZIP magic + size. Wired into CI as the `pptx-smoke` job.
- **`docs/ESLINT_CONFIG_NOTES.md`** — documents the `allowEmptyCatch: true` convention (every empty catch must include an inline comment explaining why) and the rationale for the legacy-files override block.
- **`npm audit --audit-level=high`** step in `.github/workflows/test.yml` — high-severity advisories now block CI.
- **`stylelint`** step in `.github/workflows/test.yml`.

### Changed

- **3 HTML pages migrated off `cdn.jsdelivr.net`**:
  - `index.html` — html2canvas, jsPDF.
  - `sizer/index.html` — three.js, OrbitControls, html2canvas, jsPDF.
  - `report/report.html` — html2canvas, jsPDF.
- **`basic-ftp` override bumped** from `>=5.2.2` to `>=5.3.1` to clear advisory `GHSA-rp42-5vxx-qpwr`. `npm audit` is currently clean.
- **Deprecated CSS keywords replaced** with modern equivalents:
  - `word-break: break-word` → `overflow-wrap: anywhere` in `css/style.css` (`.summary-value`) and `switch-config/switch-config.css` (`.qa-mono`).
  - `page-break-inside: avoid` → `break-inside: avoid` in `sizer/sizer.css` (×2).
- **Silent `catch (e) {}` blocks** in `switch-config/switch-config.js` and `report/report.js` replaced with either `console.warn(...)` or an inline comment documenting why the error is safe to swallow.
- **`js/theme.js`** — converted two legacy `var logoBase` declarations to `const`.
- **CodeQL switched from GitHub's Default setup to the advanced workflow** at `.github/workflows/codeql.yml` (Default setup blocked the workflow's SARIF upload). The workflow's job is named `CodeQL` so the existing `CodeQL` branch-protection check matches without rule edits.

### Removed

- **`docs/outbound-connectivity/styles_backup.css`** — unreferenced anywhere; deleted.

### Security

- All Copilot AI findings from the previous review have been addressed (vendoring, CSS variable definitions, demo-spec selectors).
- CodeQL `security-and-quality` queries now run automatically.

---

## [0.20.09] - 2026-04-30

### Added

#### Configuration Report — PowerPoint Export
- **New 📊 Download PowerPoint button** on the Configuration Report page generates a fully styled `.pptx` deck of the current design. Implementation lives in `report/pptx-export.js`; visual styling comes from `report/template/OdinPPTTemplate.potx`. The exporter loads the `.potx` with JSZip (vendored via `report/vendor/pptxgen.bundle.js`), strips the example slides, and injects custom OOXML for each section in `SECTION_PLAN`.
- **Slide coverage**: Hero cover, Deployment Scenario & Scale, Physical Network Configuration (with rack diagram), Rack Configuration, Leaf & Spine Architecture, AKS Logical Network Reachability & Routing Hops, Host Networking & Intents, Outbound Connectivity, Proxy Configuration, Security Configuration, Private Endpoints, Infrastructure Network, and a closing slide with links.
- **Microsoft Learn reference hyperlinks** per network pattern via `getNetworkPatternUrl(state)`: FC no-backup, FC with backup, single-node, 2-node switchless, 3-node switchless (dual-link), 4+ switchless, 2-node switched, 3+ switched. Dedicated links for Private Endpoints (`/deploy/about-private-endpoints`) and Arc Gateway (`/deploy/deployment-azure-arc-gateway-overview`, only when Arc mode is `arc_gateway`).
- **Visual extras**: ✓/✗ colored runs on the Security slide, red rounded-rect callout banner on the Private Endpoints slide warning that Arc Private Link is not supported on Azure Local, footer subnet-utilisation raster on the Infrastructure Network slide, nested bullets (`lvl: 2`) for `↳` follow-ups and security checks under Configuration mode.
- **Client-side only**: The deck is generated entirely in the browser. No telemetry, no backend, no upload — same offline-first guarantee as the rest of the report exports.
- **Vendored dependency**: PptxGenJS 3.12.0 (MIT) is added under `report/vendor/` purely to expose JSZip to the page; the builder does not call PptxGenJS itself.
- **Skill documentation**: New `.github/skills/pptx-export.skill.md` describing the architecture, slide plan, hyperlink mapping, anti-patterns, and validation workflow.


### Changed

#### Disaggregated Host-Networking Diagrams — 4-NIC iSCSI physical paths
- **iSCSI 4-NIC now renders NIC3/NIC4 as standalone physical shared paths** in the wizard preview and configuration report: NIC3 carries Cluster A + iSCSI Path A, and NIC4 carries Cluster B + iSCSI Path B. There is no `ClusterISCSISwitch`, no host vNIC layer, and no SET wrapper for this layout.
- **6-NIC + Backup still uses `ClusterBackupSwitch` only for Cluster/Backup** on NIC3/NIC4. Dedicated iSCSI remains on NIC5/NIC6 and no longer gets misclassified as sharing cluster ports.
- **vNIC card layout — 3-line rendering** (primary identifier / literal `vNIC` / VLAN) remains for layouts that genuinely have host vNICs, such as Management + Compute and 6-NIC + Backup Cluster vNICs.

#### Disaggregated Overrides — shared vs dedicated iSCSI
- **4-NIC iSCSI derives from the Cluster A/B VLAN/subnet inputs** instead of showing separate iSCSI A/B override cards. The wizard now explains that target portal `/32` routes must be pinned to physical NIC3/NIC4.
- **Dedicated iSCSI A/B VLAN + Subnet inputs are shown for iSCSI 6-NIC**, including the 6-NIC + Backup layout where NIC5/NIC6 stay standalone. Defaults are now VLAN `300` / `400` and subnets `10.30.30.0/24` / `10.40.40.0/24`.

---

### Fixed

#### Disaggregated Storage-Type Preview Labels
- **iSCSI 4-NIC preview status restored** - Added back the "Coming Soon" badge and "Feature not available yet" note on the DA1 iSCSI SAN (4-NIC) storage option.

#### Knowledge Tab — Context-Aware Help Button
- **Knowledge Help button now matches the active sub-page** (`js/script.js`, `js/nav.js`). The nav-bar Help button, when the Knowledge tab is active, now calls a new `showKnowledgeOnboarding()` that branches on which sidebar item is active: the **Architecture Guide** (same-origin `docs/outbound-connectivity/`) gets a 3-step overlay covering what the written reference covers, how to scroll through architectures, and how to find endpoint tables; **AzLoFlows** (cross-origin interactive diagram builder) gets a 3-step overlay covering what AzLoFlows is, how the embedded controls (Architecture bar, Resources bar, Traffic Types) work, and where to find the written reference.
- **Root cause**: the two original same-origin flow-diagram pages (`azure-local-public-path-dark-flows.html`, `azure-local-private-path-dark-flows.html`) each defined a `showFlowOnboarding()` that `nav.js` probed via `iframe.contentWindow`. After the AzLoFlows integration replaced those pages with an external iframe, the `contentWindow` probe threw a `SecurityError` (cross-origin), the Architecture Guide had no such hook, and `showNavHelp()` silently fell through to the **Designer** onboarding walkthrough — unrelated to the Knowledge content on screen.
- **Removed `contentWindow.showFlowOnboarding` probe** from `js/nav.js` — replaced with a direct call to `window.showKnowledgeOnboarding()`. The old try/catch for `SecurityError` is no longer needed.
- **Removed orphan pages**: `docs/outbound-connectivity/azure-local-public-path-dark-flows.html` and `docs/outbound-connectivity/azure-local-private-path-dark-flows.html` were no longer linked from anywhere in the site after the AzLoFlows integration.

---

## [0.20.06] - 2026-04-08

### Changed

#### Code Quality & Security Hardening (April 23, 2026)
- **Firebase analytics config validation** (`js/analytics.js`): `initializeAnalytics()` now validates every required Firebase config key (`apiKey`, `authDomain`, `databaseURL`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`) for presence, type, and non-placeholder (`REPLACE_WITH_`) values before initialising Firebase, instead of checking only `apiKey`. Addresses an AI scan finding about inconsistent validation logic.
- **CIDR prefix validation** (`js/disconnected.js`): `calculateSubnetMask(prefix)` now rejects non-number, non-integer, or out-of-range (`<0` or `>32`) inputs with an `Invalid CIDR prefix` error instead of producing undefined bitwise results. The sole caller (`validateApplianceIps`) was hardened to guard the prefix before calling, so malformed mid-typing `infraCidr` values gracefully skip the cross-CIDR check rather than throw. Addresses an AI scan finding.
- **SVG export hardening** (`scripts/svg-export-common.js`): Switched from string-interpolated `execSync` to `execFileSync` with an argv array and `shell: false`, removing the command-injection surface around user-supplied `.drawio` filenames returned by `fs.readdirSync`. Addresses an AI scan finding.
- **QoS Validator diagnostics** (`switch-config/qos-audit.js`): `resolveAutoProfile()` now logs a `console.warn` when the Designer handoff in `localStorage` fails to parse, instead of silently swallowing the error. Addresses an AI scan finding.
- **Walkthrough demo spec** (`tools/demos/odin-full-walkthrough.spec.js`): Fixed mojibake (`â†'` → `→`) in the file header comment and corrected the documented viewport to match `playwright.config.js` (1600×900, previously incorrectly documented as 2200×1238). Addresses two AI scan findings.
- **CodeQL unused-declaration cleanup**: Removed 8 unused variables / functions flagged by CodeQL:
  - `arm/arm.js` — dropped unused `payload` locals in `generateDevOpsPipeline()` and `generateGitHubWorkflow()`.
  - `js/disaggregated.js` — removed unused `portsPerLeaf` from `getMaxNodesPerRack()` (comment updated to explain the hardcoded 16-port return), and removed unused `totalNodes` and `hasDedicatedIscsi` locals from the DA8 overrides renderer.
  - `sizer/sizer.js` — removed unused `clusterTypeGpu` local in the GPU capacity notes block.
  - `sizer/rack3d.js` — removed the unused `makeCable()` helper (dead code — the actual cable routing uses explicit `LineCurve3` segments inline).
  - `report/report.js` — removed unused `startX` local in `renderCustomAdaptersHorizontal()` (a separate `groupedStartX` is used for the actual layout).
- **FQDN validator — RFC length limits** (`js/disconnected.js`): `isValidFqdn()` now enforces the RFC 1035/1123 practical DNS limits (total FQDN ≤ 253 characters, each label ≤ 63 characters) in addition to the regex check, and trims whitespace before validating.
- **Subnet mask inline comment** (`js/disconnected.js`): Added an inline explanatory comment next to the `(~0 << (32 - prefix)) >>> 0` bitwise expression so the mask construction is self-documenting.
- **SVG export retry logging** (`scripts/svg-export-common.js`): The first-attempt failure is now logged with the error message before the retry, aiding diagnosis of intermittent draw.io CLI crashes.
- **Loop-variable style consistency** (`sizer/rack3d.js`): Normalised a lone `let u` loop declaration to `var u` to match the surrounding `var`-based style in the file.
- **QoS Validator structured error logging** (`switch-config/qos-audit.js`): `resolveAutoProfile()` now logs the caught error as a `{ message, stack }` object instead of the raw `Error` object for better browser-devtools readability.
- **Walkthrough demo — dynamic template index** (`tools/demos/odin-full-walkthrough.spec.js`): The "8-Node Rack Aware" template is now located by text and its `loadTemplate(N)` index extracted from the card's `onclick`, rather than relying on a hardcoded index of 3. The demo fails fast with a clear error if the template is not present.

### Fixed

#### Accessibility, UX & Theming Cleanups
- **Private Endpoints checkbox labels**: Added `aria-label` to every Private Endpoints service checkbox (Key Vault, Storage, ACR, ASR, Recovery Services, SQL MI, Defender, Arc) so screen readers announce the service each checkbox toggles. Previously the checkboxes had no accessible name because the emoji+text label sits in a sibling `<div>` outside the checkbox (the wrapping card carries the click handler).
- **ARM Tools — cleaner browser console**: Debug `console.log` / `console.error` calls in `arm/arm.js` are now gated behind an opt-in `odinDebug` flag (set `localStorage.setItem('odinDebug','1')` or load the page with `#debug=1`). End-user console is clean by default; internal parsing diagnostics are still available when needed.
- **ARM Tools — non-blocking error toast**: The "No ARM template reference found" error on Deploy-to-Azure now surfaces via the shared `showNotification()` toast instead of a blocking `alert()` dialog, matching the notification UX used elsewhere in the Designer. Falls back to `alert()` if the notifications script isn't loaded.
- **Disaggregated — theme-safe colours**: Replaced 5 hardcoded `#a78bfa` purples in `js/disaggregated.js` info-box HTML (DA1 Storage-Type descriptions, DA2 iSCSI Shared-Mode warning, DA2 Backup Network note) with `var(--accent-purple)`, so the accent tint follows the light/dark theme like the rest of the UI.

### Added

#### Disaggregated ARM Parameters (create-cluster-san)
- **ARM generator (Disaggregated branch)**: Generate ARM now emits an Azure-Local-SAN–shaped `deploymentParameters.json` when the Designer is in the Disaggregated architecture — based on the upstream [`microsoft.azurestackhci/create-cluster-san`](https://github.com/Azure/azure-quickstart-templates/blob/master/quickstarts/microsoft.azurestackhci/create-cluster-san) quickstart template. Emits `configurationMode: "InfraOnly"`, `infraVolLunId`, `infraPerfLunId`, `sanNetworkList` (cluster A/B adapter properties, IP config, VLAN mode), and a single `MgmtCompute` intent.
- **DA8 — Step 16 (Storage Pool + LUN IDs)**: New wizard step auto-locked to `InfraOnly` for Disaggregated, with required inputs for the two SAN LUN IDs the template needs (Infrastructure Volume + Cluster Performance History).
- **DA4 — Cluster VLAN mode toggle (access / trunk)**: New per-row mode toggle on the VLAN grid for cluster1 / cluster2. Access mode (default) emits `vlanId: 0` in ARM — host sends untagged, matching the reference template. Trunk mode passes the numeric VLAN through. cluster1 and cluster2 are paired (toggling one toggles the other).
- **Readiness gate**: Generate ARM is blocked with a clear message when Disaggregated is selected but LUN IDs are blank or Storage Pool Configuration is not InfraOnly.
- **Reference template metadata**: ARM payload now carries `architecture` and a matching `referenceTemplate` link (`create-cluster-san` for Disaggregated, `create-cluster`/`create-cluster-rackaware`/adless/US-Gov otherwise).

#### Disaggregated SAN Prerequisites Banner (ARM Tools)
- **Pre-deployment checklist**: The ARM Tools page now shows a purple "Disaggregated storage (SAN) — pre-deployment checklist" banner when the payload is disaggregated, listing what must be done on the array and fabric before Validate (zoning, host registrations, LUN mapping, leaf VLAN config, cluster-network reachability).

#### Disaggregated Leaf-Scope Banner (Switch Config Generator)
- **Leaf-only scope note**: Switch Config page now shows a banner when the Designer is in Disaggregated mode, calling out that it emits leaf-only configuration and that spine/EVPN fabric, SAN fibre-channel zoning, and array host registrations are out of scope.
- **Per-rack leaf switches (SC1b)**: New "Per-Rack Leaf Switches" panel for disaggregated deployments covering **every rack (Rack 1 through Rack N, 1–8 racks)**. Each rack gets its own collapsible card with editable ToR-A / ToR-B / BMC hostnames, Site/Location, leaf BGP ASN (auto-increments from 64789), loopback pair, Mgmt SVI IPs, per-rack P2P underlay links to Border1 / Border2 (/30), and per-rack iBGP peering IPs — grouped under Identity, Loopbacks & BGP, Management SVI IPs, P2P Links to Spine, and iBGP Peering. For disaggregated deployments the legacy single-rack Rack 1 hostname/site fields in SC1 and the Rack 1 Loopback/P2P/iBGP fields in SC3 are hidden — everything rack-specific lives in SC1b, with only the shared Border Router BGP ASN remaining in SC3. The generator emits up to **16 ToR configs + 8 BMC configs** (2 ToRs + 1 BMC per rack) in a single run, labelled `Rack N — ToR-A (hostname)`. Output tabs scroll horizontally when they exceed the container width.
- **Editable Cluster Network names (DA4)**: Disaggregated "Cluster (CSV/LM) A" and "Cluster (CSV/LM) B" rows on DA4 now have a "Network Name" text input (default `Cluster Network 1` / `Cluster Network 2`). The name flows to the DA8 Adapter Mapping intent-zone titles, the DA8 Overrides card headings, and to ARM `sanNetworkList.clusterNetworkConfig.adapterIPConfig[*].name` (sanitized: spaces → hyphens, alphanumeric + hyphen only).

#### Report: Responsive Rack Layout
- **Scaling fit for wide racks**: The Rack Layout SVG (both HCI and Disaggregated) now uses `viewBox` + `max-width: 100%` + `height: auto` so 6-, 8-, and 16-rack disaggregated layouts scale to fit the report column instead of overflowing horizontally. Download-as-SVG still preserves the original pixel fidelity via the viewBox.

#### Disaggregated Architecture Wizard
- **New disaggregated wizard**: End-to-end wizard for disaggregated deployments with external SAN storage (Fibre Channel, iSCSI 4-NIC, iSCSI 6-NIC) and Clos leaf-spine fabric — up to 64 nodes across multiple racks
- **DA1 — Storage Type**: Choose external SAN connectivity — Fibre Channel SAN, iSCSI (4-NIC), or iSCSI (6-NIC)
- **DA2 — Backup Network**: Optional dedicated backup NIC toggle
- **DA3 — Cluster Scale**: Configure rack count (1–4), nodes per rack (up to 16), with automatic port-budget calculation
- **DA4 — Spine Switches**: Select spine switch count (2 or 4) for the Clos fabric
- **DA5 — VLANs, VNI & VRF**: Full VLAN/VNI/VRF configuration for management, cluster, iSCSI, and backup networks; management VLAN access/trunk mode; tenant network management with add/remove VLAN support
- **DA6 — QoS Policy**: QoS policy configuration and summary
- **DA7 — Leaf & Spine IP Routing**: IP planning with subnet configuration, Clos topology diagram, and per-network IP allocation
- **DA8 — Summary & Rack Layout**: Full summary with interactive SVG rack topology diagram (downloadable)
- **DA10 — Network Adapter Ports**: Drag-and-drop NIC-to-intent zone mapping, per-port speed/name configuration, adapter mapping with 3-intent model (Compute+Mgmt, Cluster, Storage/Backup)
- **Breadcrumb navigation**: Step progress breadcrumb for the disaggregated wizard flow
- **Host networking preview**: Interactive SVG diagrams for hyperconverged, switchless, FC SAN, and iSCSI topologies with light/dark SVG export

#### ToR Switch Config Generator
- **New Switch Config page**: Full-featured ToR switch configuration generator for Cisco NX-OS and Dell OS10 platforms — accessible from the Designer summary page via "Generate / Validate ToR Switch Configuration" button (opens in new tab), or directly via the switch-config page
- **Multi-vendor support**: Switch model selector with Cisco (93108TC-FX3P 10GBASE-T, 93180YC-FX, 93180YC-FX3) and Dell (S5248F-ON) ToR models, plus BMC switch models (Cisco 93108TC-FX3P, 9348GC-FXP/FX3, Dell N3248TE-ON)
- **QoS Configuration Validator**: Paste a `show running-config` (Cisco NX-OS) or `show running-configuration` (Dell OS10) to validate PFC (IEEE 802.1Qbb) on CoS 3, ETS (IEEE 802.1Qaz) bandwidth reservations (Storage ≥50%, Cluster 1–2%), ECN on storage queue, MTU 9216, system QoS policy application, interface-level PFC, QoS service-policy, and VLAN trunking — all processing is client-side with no data transmitted
- **QoS Validator — Deployment Type profiles**: A **Deployment Type** dropdown (`Auto-detect from Designer`, `Hyperconverged — Switched`, `Hyperconverged — Switchless`, `Disaggregated — Fibre Channel SAN`, `Disaggregated — iSCSI (evolving guidance)`) scores the pasted config against the right rule set. Each profile maps every check to one of `required` / `recommended` / `skip`. HCI Switchless reports PFC, class-maps, ETS storage & cluster, ECN, system-qos, interface PFC, and interface qos-policy as **N/A** with explanatory notes (storage + cluster NICs are back-to-back, not on the ToR). Disaggregated FC SAN reports the Ethernet-side storage checks as N/A (storage runs on the FC fabric) while Cluster CSV/LM QoS (class-map CoS 7, ETS cluster, system-qos, interface qos-policy) still applies. Disaggregated iSCSI demotes storage-side checks from `fail` to `warn` as a placeholder — authoritative guidance is tracked for a future release. Results include a grey `ℹ️ N not applicable` count alongside pass/warn/fail.
- **Cisco Nexus 93108TC-FX3P as ToR**: Added 10GBASE-T copper switch model as a ToR option (in addition to existing BMC role), with fully converged, switched, and switchless storage interface templates
- **Per-Rack Site / Location**: Rack-aware deployments now support separate Site / Location fields for Rack 1 and Rack 2, applied to SNMP location on each rack's ToR and BMC switches
- **JSON data model**: Intermediate JSON data model (`SwitchConfigBuilder`) generates vendor-neutral structured config, rendered to platform-specific CLI by `CiscoNxosRenderer` and `DellOs10Renderer`
- **Rack-aware 4-ToR support**: Rack-aware deployments generate TOR1–TOR4 configurations with correct iBGP peering, loopback IPs, storage VLAN assignment (TOR1/TOR3 get S1, TOR2/TOR4 get S2), and per-rack HSRP/VRRP priorities
- **BMC switch configs**: Generates BMC switch configuration with access VLANs, trunks to ToRs, and static default route
- **Infrastructure tokens**: Timezone (with DST/summer-time), NTP server, syslog server, TACACS+ servers/key, SNMP RO/RW communities, management VLAN source-interface, and management gateway IP — all replaceable placeholders in rendered configs
- **JSON export**: Export the structured JSON data model for each switch section (TOR1, TOR2, TOR3, TOR4, BMC)
- **Designer integration**: "Generate / Validate ToR Switch Configuration" button on the Designer summary page transfers deployment state (scenario, nodes, intent, storage mode, scale, infra VLAN) to the switch config page (opens in new tab)

#### Report: 2D SVG Rack Diagram
- **SVG rack layout**: Static 2D front-view SVG rack diagram in the Report page showing 42U rack frames with server nodes (2U), ToR switches (1U), BMC switches (1U), and U-position markers
- **Core switch visualization**: Core Switch / Router / Firewall box rendered above racks with connecting vertical lines
- **Rack-aware layout**: Multi-rack diagrams with Rack 1 on left, contiguous node numbering across racks (Node 1–4 in Rack 1, Node 5–8 in Rack 2)
- **Azure Local branding**: Azure Local instance icon and "Azure Local" text in top-right of SVG
- **Legend and U count**: Color-coded legend (Server, ToR, BMC, Core Switch) and total U count summary per rack
- **Download**: "Download Rack Diagram SVG" button exports the diagram as a standalone SVG file

### Changed

#### 3D Rack Visualization Improvements
- **Azure Local branding**: Replaced Microsoft Azure logo with Azure Local instance icon and "Azure Local" purple text; replaced Azure "A" logo on server fronts with azurelocal-machine.svg
- **BMC switch**: Added 1U BMC switch (white/light grey) below ToR switches in every rack, including single-node deployments
- **ToR switch color**: Changed from green to dark grey (#444444) for better visual contrast
- **Single-node topology**: Single-node deployments now show 1 ToR switch and 1 BMC switch with ToR-to-router cabling
- **Label cleanup**: Removed "(Front)" suffix from all device labels; renamed "TOR" to "ToR" throughout; contiguous node numbering across racks
- **Legend updated**: Added BMC Switch swatch; updated ToR swatch color to dark grey

#### Designer: Management VLAN Guidance
- **Improved VLAN descriptions**: Default VLAN card clarified to "Untagged — management traffic uses the native VLAN (ID 0 on the host)"; Custom VLAN card updated to "Tag management traffic with a specific VLAN ID on the host NICs"
- **Expanded info box**: Added explanation that even with untagged host traffic (ID 0), the ToR switch assigns it to a VLAN internally (e.g., VLAN 7), and the switch-side VLAN ID is configured separately in the Switch Config Generator

#### Sizer: Low Capacity Cluster Type
- **Low Capacity deployment type**: New "Low Capacity" option in the Sizer cluster type selector — enforces Azure Local low capacity hardware limits: 1–3 nodes, single socket only, max 14 physical cores per node, 32–128 GB memory per node, max 192 GB GPU VRAM per node. All-flash storage only (no cache tier). Core dropdown, socket count, and memory slider are auto-constrained to deployment limits. 3D rack visualization renders correctly for 1–3 node low capacity configurations.

#### Sizer: Disaggregated Storage
- **Disaggregated Storage deployment type**: New deployment type in the Sizer with rack count (1–8 racks), spine switch count (2 or 4), and storage connectivity (Fibre Channel SAN / iSCSI SAN) selectors — total cluster capped at 64 nodes, with per-rack node maximum automatically reduced (16/12/10/9/8 for 4/5/6/7/8 racks) to match Designer logic. Storage fields disabled with external SAN tooltip.
- **3D Visualization: Two-row layout for 5+ racks**: Disaggregated deployments with more than 4 racks render in two rows with a hot aisle between them — back row gets `ceil(N/2)` racks, front row gets the rest. Spine switches sit centered above the aisle; per-rack uplink cables extend to each row.
- **3D Visualization: FC Switches**: When Fibre Channel SAN is selected, 2 purple FC switches are rendered per rack below the BMC switch
- **3D Visualization: Per-rack uplinks**: Blue uplink cables connect every rack’s ToR to spine switches; SMB pink cables and LAG cables only shown for rack-aware (not disaggregated)
- **3D Visualization: Spine switches**: Configurable 2 or 4 spine switches rendered above the racks
- **Designer → Sizer Transfer**: Disaggregated architecture transfers from Designer to Sizer with rack count, spine count, and storage type; all buttons open in new tabs
- **Import/Export**: Disaggregated rack count, spine count, and storage type persisted in save, resume, and JSON import/export

#### QoS Validator Improvements
- **Smart PFC Detection**: Interface PFC validation uses QoS service-policy to identify storage-facing interfaces, correctly distinguishing from uplink/BMC trunks
- **Dynamic CoS Detection**: Detects actual CoS values from class-maps (supports custom CoS, not hardcoded to 3/7)
- **Actionable Warnings**: PFC warnings list both enabled and missing interfaces; ETS bandwidth warnings explain deviations

#### Sizer: Enterprise Features
- **Import from Azure Portal JSON**: Import hardware specs from an existing Azure Local machine by pasting the machine JSON View from the Azure Portal — auto-detects CPU model name, core count, socket count, and memory; injects exact processor name and non-standard core counts as custom dropdown options; locks all imported fields as MANUAL
- **Share Config as URL**: New "Share Sizer Config as URL" button encodes the full Sizer configuration (including workloads) as a base64 URL parameter — prompts for an optional configuration name; recipients see a confirmation banner with the name and workload count; supports Unicode names; 100-character limit
- **CSV Export**: New "Export CSV" button generates a hardware BOM spreadsheet with cluster topology, CPU, memory, storage, GPU, power estimates, rack units, and per-workload details
- **Save as PDF**: New "Save as PDF" export in both the Designer and the Sizer — renders the current summary / sizing view as a multi-page PDF for sharing and archiving (uses browser-native print-to-PDF; no server round-trip)
- **Auto-Scale Beyond 16 Nodes**: Sizer auto-scaler can now grow cluster node count beyond 16 when workload demand requires it (e.g., large disaggregated configurations up to 64 nodes), with a clear indicator when scaling has pushed the recommendation past the single-site 16-node limit
- **Capacity Runway Projection**: Collapsible year-over-year growth projection table showing vCPU, memory, and storage demand over 5 years at the configured annual growth rate — flags the year when capacity exceeds 90% and shows a capacity runway summary
- **Power Calculation Breakdown**: Collapsible "Power calculations, verbose information and assumptions" section with per-component DC power (CPU TDP, memory DIMMs, disks, GPU, base overhead), PSU efficiency (80 Plus Titanium 96%), network infrastructure itemization (ToR/BMC/FC/Spine switches), SAN caveat for disaggregated, and full assumptions list
- **VM Capacity Validation**: Individual VM workloads where vCPU or memory exceeds per-machine capacity trigger 🚫 sizing notes, block Configure in Designer, and show a toast error notification
- **Azure Local Pricing Link**: Pricing calculator link in multi-instance section with note that it covers Azure service costs only, excluding hardware

#### Report: Connectivity Restructure
- **Outbound, Arc, Proxy & Private Endpoints section repositioned**: Moved into Configuration Summary immediately after Infrastructure Network for a more logical read-order in the generated report
- **Interactive Diagram Builder link**: Added direct link from the report's connectivity section to the Interactive Outbound Connectivity Diagram Builder
- **Duplicate section removed**: Removed the now-redundant higher-level Connectivity section; only the detailed Outbound/Arc/Proxy/Private Endpoints section remains

#### Switch Config: Cleaner URL
- **`/switch-config/` URL**: Renamed `switch-config.html` to `switch-config/index.html` so the page now serves at `https://azure.github.io/odinforazurelocal/switch-config/` instead of `.../switch-config.html`

### Changed

- **Disaggregated rack diagram hierarchy**: Service Leaf switches now render above Spine switches in the rack topology diagram, matching standard leaf-spine convention
- **Leaf & Spine fabric diagrams**: Stacked full-width in the report for better readability on wide screens

### Fixed

- **Designer: SDN Feature Toggle**: Fixed generate buttons (Report/ARM) not updating when SDN features (LNET/NSG) are checked — `toggleSdnFeature()` now calls `updateUI()` so buttons re-evaluate immediately without requiring a second click on "Enable SDN"
- **Designer: Disaggregated Session Resume**: Added `restoreDisaggregatedUI()` to re-populate DA step card selections (storage type, backup, rack count, spine count), slider values, and explanation text after session resume — previously DA steps appeared blank after F5 refresh
- **Designer: "Leaf & Spine Fabric Requirements" heading**: Fixed a double-escaped ampersand that rendered as `&amp;amp;` in the step heading
- **Report: Rack Layout step badge**: Fixed a malformed step-number badge on the Rack Layout section of the cluster report
- **Sizer: ODIN Logo Light/Dark**: Fixed ODIN logo not switching between dark and light variants when toggling theme in the Sizer — the local `applyTheme()` was looking for `.odin-tab-logo img` which doesn't exist; now uses `#odin-logo`
- **Sizer: Share Button Disabled State**: Share URL buttons now start disabled with tooltip "Add workload(s) before you can share" and enable when workloads are added; added `.btn-secondary:disabled` CSS for visual disabled state (40% opacity, not-allowed cursor)
- **Sizer: PSU Efficiency**: Separated PSU efficiency from base overhead — component power (DC) is now divided by 96% efficiency (80 Plus Titanium at 50% load) to calculate wall power (AC), matching current-gen 2U server PSU ratings
- **Sizer ↔ Designer: Disaggregated spine count round-trip**: `disaggSpineCount` is now preserved in both directions so a 4-spine selection from the Designer no longer reverts to 2 spines after a Sizer round-trip
- **3D Visualization: Disaggregated uplink cable routing**: Multiple refinements so blue uplink cables exit the ToR rear cleanly, route above and beside the spine stack (never through it), and land on the rear face of the spine switches for both single-row and two-row (5+ rack) layouts
- **3D Visualization: SAN appliance clarification note**: Added a caption clarifying that the external SAN appliance is not rendered in the 3D view for Disaggregated Storage deployments
- **Onboarding walkthrough: Touch-device hover**: Restricted the onboarding card hover-transform to hover-capable devices so touch users no longer see sticky hover states
- **Tests: Expanded coverage**: Test suite grew to **969 tests** (up from 920) — new coverage for disaggregated rack count 1–8, two-row 3D layout math, `disaggSpineCount` round-trip, and PDF export entry points

---

## [0.18.04] - 2026-03-30

### Added

#### Sizer: 3D Rack Visualization
- **Interactive 3D rack preview**: Renders 42U open-frame server cabinets using Three.js (MIT) with detailed 2U server nodes (disk bays with pull handles, status LEDs, Azure logo, dual PSUs, network ports, BMC port, ventilation grille) and 1U ToR switches (48-port ethernet in two rows, QSFP uplinks, fan vents)
- **Rack-aware support**: Rack-aware deployments render two side-by-side cabinets with balanced node distribution and blue core switch/router, in actual deployments the cabinets would be in separate rooms or datacenters
- **Network topology**: Management/compute uplink cables (blue) from each ToR to the core router, SMB storage trunk cables (pink) between cross-rack ToR pairs, and LAG inter-switch links (orange) between paired ToRs in each rack
- **Dynamic updates**: Visualization re-renders in real-time as sizer inputs change (node count, cluster type, disk configuration)
- **Interactive controls**: Left-click and hold to rotate, scroll to zoom, right-click and hold to move up and down; touch-device friendly
- **Azure branding**: Microsoft Azure logo overlay in top-right corner, Azure "A" logo on each server node front panel
- **Collapsible section**: Toggle visibility via header click; hidden during print/PDF export

---

## [0.18.03] - 2026-03-30

### Fixed

#### ARM Parameters: Fix Custom Location Name (fixes #189)
- **Fix `customLocation` parameter key**: Fixed a bug where the "Custom Location Name" input field on the ARM Parameters page was not updating the `customLocation` value in the generated parameter JSON — the update code referenced a mismatched key (`customLocationName` instead of `customLocation`)
- **Pre-population fix**: The custom location input field also now correctly pre-populates from the parameter JSON when loading a template

---

## [0.18.02] - 2026-03-26

### Fixed

#### Designer: Fix NIC overrideAdapterProperty (fixes #187)
- **Fix `overrideAdapterProperty` flag**: Fixed a bug where disabling RDMA on NICs assigned to the Management+Compute intent (e.g., in a switchless 4+ NIC configuration) would generate `"overrideAdapterProperty": false` in the ARM parameter JSON instead of `true` — the adapterPropertyOverrides (networkDirect: Disabled) were present but not enforced
- **NIC-Level RDMA Detection**: `buildAdapterPropertyOverrides()` now accepts the group's NIC list and checks `portConfig[i].rdmaManual` — if any NIC in the group had its RDMA manually changed at Step 07, the override flag is set
- **Auto-Disable Flag**: When `renderIntentOverrides()` auto-disables RDMA for an intent group because no NICs are RDMA-capable, `__touchedAdapterProperty` is now set so the generated JSON correctly includes `overrideAdapterProperty: true`

---

## [0.18.01] - 2026-03-20

### Added

#### Sizer: GPU Capacity Planning (closes #180)
- **GPU Workload Requirements**: All three workload types (Azure Local VMs, AKS Arc, AVD) now support GPU mode selection — DDA (Discrete Device Assignment) and GPU-P (GPU Partitioning)
- **GPU Model Selectors**: DDA and GPU-P modes include GPU model dropdowns that auto-set hardware GPU type and enforce homogeneous configuration across all workloads and nodes
- **Homogeneous GPU Locking**: Once a workload selects a GPU model, the hardware GPU Type is locked (disabled with WORKLOAD badge) and all subsequent workload GPU selectors are locked to the same model
- **Per-Model GPU-P Partitions**: GPU-P partition sizes dynamically filter based on the selected GPU model, showing VRAM per partition (e.g., A2 supports up to 1:8, L40S supports up to 1:16)
- **DDA GPU Count Dropdown**: Free-text input replaced with dropdown capped at the model's maxPerNode (1–4 depending on model)
- **GPU Capacity Bar**: New GPU capacity bar chart below storage showing consumed vs available GPUs with N−1 node awareness for maintenance/drain reserve
- **GPU Auto-Scaling**: GPU demand drives node count recommendations and GPUs-per-node auto-scaling (with AUTO badge) up to each model's physical maximum
- **GPU Models Expanded**: Added NVIDIA T4 (16 GB, 70W, max 2/node), RTX Pro 6000 (48 GB, 600W, max 2/node), H100 (80 GB, 700W, max 2/node) — each model includes maxPerNode, DDA/GPU-P support, and AKS compatibility flags
- **AKS GPU VM Sizes**: AKS workloads show all supported GPU-enabled VM SKUs with fixed vCPU/memory — auto-sets hardware GPU type and disables manual vCPU/memory fields
- **GPU Badge**: Workload cards show a yellow "GPU" badge when GPU-enabled
- **GPU Threshold Warnings**: GPU ≥90% triggers over-threshold (red bar), sizing notes, and blocks Designer export
- **GPU Hardware Auto-Enable**: Adding a GPU workload automatically enables GPUs in hardware config if not already set
- **Knowledge Links**: GPU Requirements sections include links to Microsoft documentation for supported GPU models and GPU-P management guide
- **GPU in Reports**: GPU utilization and hardware config flow through Sizer Word export, Designer, and Report Generator

#### Sizer: Total VM Requirements (closes #181)
- **Total VM Input Mode**: New "Total VM Requirements" option in the Azure Local VMs modal — enter aggregate vCPU, memory, storage, and GPU totals directly
- **Input Mode First**: Input Mode selector moved to the top of the VM modal for immediate visibility
- **Dynamic Labels**: Field labels and GPU label change to "Total vCPUs", "Total Memory", "Total GPUs Required" etc. in Total mode

#### Sizer: 3:1 vCPU Overcommit Ratio
- **3:1 Option Added**: Added the missing 3:1 vCPU overcommit ratio to the Advanced Settings dropdown

---

## [0.17.61] - 2026-03-09

### Fixed

#### Sizer: Fix Resume Session Banner
- **Fix Resume Banner**: Fixed the "Previous Sizer Session Found" banner appearing unconditionally on every page load, even when no workloads were added — the banner now only appears when there are actual workloads to resume (fixes #178)
- **Fix Start Fresh Re-Save**: Fixed `startSizerFresh()` immediately re-saving default state via `calculateRequirements()` → `saveSizerState()`, causing the banner to reappear on the next page load

---

## [0.17.60] - 2026-03-03

### Changed

#### Sizer: Intel® 6th Gen Xeon® (Granite Rapids / Sierra Forest)
- **Intel® 6th Gen Xeon® Expanded**: Expanded the Intel® 6th Gen Xeon® CPU generation in the Sizer to cover the full 8–172 core range from the Azure Local hardware catalog — includes both Granite Rapids (P-cores) and Sierra Forest (E-cores) codenames (ref: [Intel Xeon Processors](https://www.intel.com/content/www/us/en/products/details/processors/xeon.html))
- **Updated Intel Default**: Intel CPU default changed from 5th Gen Xeon® (Emerald Rapids) to Intel® 6th Gen Xeon® (Granite Rapids / Sierra Forest)

---

## [0.17.58] - 2026-03-02

### Fixed

#### Mobile Layout Fixes (iOS) & Consistency
- **Sizer Mobile Alignment**: Fixed header, disclaimer banner, stats bar, and Privacy footer not visually aligned with form panels on iOS mobile devices — added 25px horizontal padding to match config-panel card inset
- **Sizer Footer Fix**: Moved Privacy footer inside the `<main class="container">` element so it respects max-width and mobile padding rules
- **Designer Step-Header Overflow**: Fixed "Unsure? Start with Sizer" button overlapping Step 04 (Cluster Configuration) header on narrow mobile screens — `.step-header` now uses `flex-wrap: wrap` and the sizer-link drops to its own full-width line
- **Sizer Mobile Header Consistency**: Aligned logo size (80px), version text size (11px), and logo ordering (`order: -1`, logo above title) with the Designer's mobile layout
- **CSS Nesting Fix**: Corrected CSS for hover and active states of `.stat-value` elements so styles apply consistently across browsers

### Changed
- **Designer Title**: Renamed from "Odin for Azure Local" to "ODIN Designer for Azure Local" for naming consistency with the Sizer

---

## [0.17.57] - 2026-02-27

### Added

#### Sizer: Individual MANUAL Override Dismiss
- **Per-Field Dismiss**: Each MANUAL badge now includes a small × button to remove that individual override without clearing all overrides at once
- **Shared Flag Handling**: CPU-related fields (cores, sockets, manufacturer, generation) share a single lock — dismissing any one clears all four CPU badges together
- **Remove All Button Rename**: Renamed "Remove MANUAL overrides" button to "Remove all MANUAL overrides" for clarity
- **Auto-Scale on Dismiss**: Dismissing a MANUAL override immediately triggers auto-scaling — the field reverts to an optimal value and receives the purple AUTO badge

---

## [0.17.56] - 2026-02-27

### Added

#### Designer-to-Sizer Transfer
- **Add Workloads Button**: New "⚖️ Sizer: Add Workloads to this Cluster" button at the bottom of the Designer, below the ARM deployment files button
- **Smart Mapping**: Automatically maps Designer scenario (hyperconverged, disconnected) and scale (standard, rack-aware, single node) to the correct Sizer deployment type
- **Transfer Payload**: Stores deployment type and node count in `localStorage` as `odinDesignerToSizer` and navigates to `sizer/index.html?from=designer`
- **Button Gating**: Button is disabled until both Deployment Type and Node count are selected in the Designer

#### Sizer: Designer Import
- **Pre-Population**: Sizer detects `?from=designer` URL parameter and reads the `odinDesignerToSizer` localStorage payload to set cluster type and node count dropdowns
- **MANUAL Node Count Lock**: Node count transferred from the Designer is marked as MANUAL — prevents Sizer auto-scaling from overriding the Designer's node count
- **Workload Persistence**: Workloads from a prior Sizer session are silently restored when returning from the Designer; banner shows the count of restored workloads
- **Confirmation Banner**: Shows a purple banner with the imported deployment type, node count, and restored workload count; auto-dismissed after 8 seconds
- **Session Skip**: When importing from Designer, the saved session resume prompt is skipped to avoid conflicting with the imported configuration

---

## [0.17.55] - 2026-02-27

### Added

#### Navigation: Tab-Based Routing & Consistency
- **URL Parameter Routing**: All top navigation links (Designer, Knowledge, Sizer) now use `?tab=` URL parameters for consistent tab switching
- **Parameter Cleanup**: URL parameters cleaned after processing via `history.replaceState` to keep the address bar tidy
- **Designer Link Fix**: Fixed intermittent bug where clicking Designer from the Sizer navigated to the Knowledge tab — stale `sessionStorage.odinActiveTab` combined with missing `?tab=designer` parameter caused incorrect tab activation
- **Knowledge Session Popup Fix**: Fixed "Previous Session Found" popup appearing incorrectly on the Knowledge tab — `checkForSavedState()` now skips when active tab is Knowledge

#### Knowledge: Flow Diagram Visual Improvements
- **Flat Dark Backgrounds**: Replaced animated stars/space WebGL effects with flat dark backgrounds (`#111111`) on Public Path and Private Path flow diagrams to match the sidebar and overall theme
- **Public Path Layout Fix**: Shifted all Public Path Flow diagram elements down to prevent overlap with the Architecture navigation bar

#### Sizer: ALDO Workload Cluster
- **New Deployment Type**: Added "ALDO Workload Cluster" deployment type to the Sizer — integrates disconnected scenario with workload cluster role in the Designer
- **FQDN Prompt**: ALDO Workload Cluster prompts for Autonomous Cloud FQDN before transferring to Designer
- **Region Skip**: ALDO Workload Cluster skips the region picker when transferring to Designer, proceeding directly after FQDN entry

#### Sizer: Header Redesign & UI Consistency
- **Header Layout**: Restructured Sizer header to match the Designer layout — centered title, absolutely-positioned logo, and Firebase analytics stats bar with four counters
- **Disclaimer Banner**: Added disclaimer banner to the Sizer page matching the Designer's warning banner
- **Preview Badge Removed**: Removed the purple "Preview" badge from the Sizer navigation link
- **Title Update**: Changed Sizer page title to "ODIN Sizer for Azure Local" with updated description text
- **Deployment Type Rename**: Renamed "Cluster Type" to "Deployment Type" throughout the Sizer UI

### Fixed

#### Sizer: Analytics & Dependencies
- **Missing utils.js**: Fixed page view statistics not loading on the Sizer page — added missing `utils.js` script dependency that provides `formatNumber()`
- **Fallback Stats Fetch**: Added explicit `fetchAndDisplayStats()` call with 1-second delay as a fallback when the initial analytics load fails

#### Sizer: Configure in Designer Navigation
- **Tab Parameter**: Fixed "Configure in Designer" navigating to the Knowledge tab instead of Designer — added `?tab=designer` to the Sizer navigation URL
- **Import Param Preservation**: Fixed Sizer hardware/workload auto-import not applying in Designer — the `?from=sizer` URL param was being stripped by the tab routing cleanup; tab cleanup now only removes the `tab` param, preserving other query parameters

### Changed

- **Analytics Label**: Renamed "Page Views" to "Visitors" in the stats bar on both Designer and Sizer pages
- **Feedback Link**: Feedback button now opens GitHub Issues in a full new browser tab instead of a popup window

#### Sizer: Export/Import JSON
- **Export JSON**: Export complete Sizer configuration (hardware settings, workloads, MANUAL overrides) as a shareable JSON file with descriptive metadata
- **Import JSON**: Import previously exported Sizer JSON files to restore full configuration — validates file structure before applying
- **Header & Export Buttons**: Export/Import buttons added to both the Sizer header and the export actions area

#### Sizer: MANUAL Node Count Override
- **Persistent Lock**: Number of Physical Nodes dropdown now supports persistent MANUAL override — selecting a node count sets a green MANUAL badge and prevents auto-node-recommendation from overriding the selection
- **Clear on Reset**: MANUAL node count lock is cleared when using "Remove MANUAL overrides" or resetting the scenario

#### Sizer: Configurable S2D Repair Disk Reservation
- **New Dropdown**: Added "Capacity Disks Reserved for Repair" dropdown (0–4) in the Disk Configuration section for both single-tier and two-tier storage layouts
- **AUTO Default**: Defaults to AUTO mode — reserves 1 capacity disk per node, up to a maximum of 4, matching the previous hardcoded behaviour
- **MANUAL Override**: User can manually set the repair disk count with a green MANUAL badge; value persists across workload changes
- **Warning Note**: Sizing notes display a ⚠️ warning when the manually selected repair disk count is below the recommended value based on cluster size
- **State Persistence**: Repair disk count and MANUAL flag included in export/import JSON and localStorage auto-save

---

## [0.17.11] - 2026-02-26

### Added

#### Knowledge Tab: Embedded Content & Interactive Diagrams
- **Embedded Knowledge Tab**: Knowledge tab now loads inline within the main page instead of navigating to a separate page — outbound connectivity architecture guide displayed in an embedded iframe
- **Interactive Outbound Connectivity Diagrams**: Added interactive WebGL flow diagrams for Public Path and Private Path outbound connectivity architectures
- **Sidebar Navigation**: Left sidebar in the Knowledge tab with links to switch between the Architecture Guide, Public Path Flow diagram, and Private Path Flow diagram
- **In-Page Tab Switching**: Knowledge tab uses the same `switchOdinTab` mechanism as Designer for seamless in-page navigation
- **Iframe Nav Hiding**: ODIN top navigation bar automatically hidden when the outbound connectivity page is loaded inside an iframe to avoid duplicate navigation
- **SVG Icons**: Added Azure service SVG icons (Arc Gateway, Azure Firewall, ExpressRoute, Private Endpoints, VNET, etc.) for the interactive diagrams
- **Responsive Layout**: Knowledge sidebar collapses to a horizontal nav strip on mobile viewports

---

## [0.17.10] - 2026-02-25

### Added

#### Sizer: ALDO Management Cluster Type
- **New Cluster Type**: Added "ALDO Management Cluster" option to the Sizer cluster type dropdown — a fixed 3-node, all-flash configuration with three-way mirror resiliency
- **Fixed Node Count**: ALDO Management Cluster is locked to exactly 3 nodes with the node count dropdown disabled
- **All-Flash Storage**: Storage type is automatically set to all-flash when ALDO Management Cluster is selected
- **Three-Way Mirror Only**: Resiliency is locked to three-way mirror for ALDO Management Cluster (two-way mirror option removed)
- **Minimum Hardware Enforcement**: Automatically enforces documented ALDO minimums — 96 GB memory, 24 physical cores, and 2 TB SSD/NVMe storage per node when ALDO cluster type is selected
- **Appliance VM Overhead**: Reserves 64 GB memory per node (192 GB total) for the disconnected operations appliance VM — deducted from available workload memory in capacity bars and auto-scaling calculations
- **Boot Disk Recommendation**: Sizing notes recommend 960 GB SSD/NVMe boot disk per node to reduce deployment complexity
- **Custom Sizing Notes**: Expanded sizing notes with minimum hardware specs, appliance reservation breakdown, and boot disk guidance
- **Knowledge Link**: ALDO sizing notes include a link to the disconnected operations overview documentation
- **IRVM1 Auto-Workload**: When ALDO Management Cluster is selected, a fixed infrastructure workload (IRVM1 — 1 × VM with 24 vCPUs, 78 GB memory, 2 TB storage) is automatically added; Add Workload buttons are disabled and the workload cannot be edited, cloned, or deleted
- **ALDO Cores Auto-Scale Floor**: Auto-scaling now enforces the ALDO minimum of 24 physical cores per node — previously the auto-scaler could set cores below the documented minimum when workload demand was low

#### Sizer: MANUAL Override Badges & Persistence
- **MANUAL Badge**: Light green "MANUAL" badge appears on any hardware dropdown (vCPU ratio, memory, CPU cores, sockets, manufacturer, generation, disk size, disk count) when a user manually edits the value — visually distinguishes user choices from auto-scaled values
- **Override Persistence**: MANUAL overrides now persist across workload add, edit, delete, and clone — only the explicit "Remove MANUAL overrides" button or a full scenario reset clears them
- **Remove MANUAL Overrides Button**: New button at the bottom of the hardware config section appears when any MANUAL override is active — clears all user locks and re-runs auto-scaling
- **Capacity Warning**: Amber warning banner appears when any capacity bar reaches ≥90% utilization while MANUAL overrides are active — identifies which specific overrides are preventing auto-scaling (e.g. "Memory capacity cannot be auto-scaled because of MANUAL override on: Memory")
- **Independent Disk Locks**: Disk size and disk count are independently lockable — manually setting disk size still allows disk count to auto-scale, and vice versa

#### Sizer: Azure Resource Bridge (ARB) Overhead
- **Cluster-Level Deduction**: Azure Resource Bridge appliance VM overhead (8 GB memory, 4 vCPUs) is now deducted from available cluster capacity in sizing calculations and capacity bars
- **Consolidated Sizing Note**: Infrastructure overhead note combines Infrastructure_1 (256 GB usable storage) and ARB (8 GB memory, 4 vCPUs) in a single bullet

#### Sizer: Region Picker for Designer Transfer
- **Region Selection Modal**: When clicking "Configure in Designer", users now select their Azure region in a modal before navigating — prevents the cascade reset that previously wiped imported cluster configuration and size when changing region in the Designer
- **Cloud Toggle**: Radio toggle between Azure Commercial (8 regions) and Azure Government (1 region) with a clean grid layout
- **Region in Banner**: Import confirmation banner now shows the selected region (e.g. "📍 Azure region: West Europe") instead of defaulting to East US

#### Report: Sizer Hardware & Workloads Pass-Through
- **Hardware Configuration Section**: The HTML report now renders the full "Hardware Configuration (from Sizer)" section — CPU, memory, GPU, disks, resiliency, growth factor, cluster type, and workload summary totals (was previously only in the Markdown export)
- **Individual Workloads Section**: New "Workloads (from Sizer)" section in the report showing per-workload details — VM count/specs, AKS cluster/control-plane/worker configuration, AVD users/profile/session type — with subtotals per workload
- **Transparent Workload Pass-Through**: Individual workload details (not just summary totals) are now passed from Sizer → Designer → Report automatically without being visible in the Designer UI
- **Disconnected Network Link**: Connectivity section now shows "Plan your network for disconnected operations" with a link to MS Learn documentation when Disconnected deployment type is selected (previously blank)

#### Report: AKS Arc Network Requirements
- **Network Port Table**: When AKS workloads are configured, the report shows an "AKS Arc Network Requirements" section with the port/VLAN requirements table (ports 22, 6443, 55000, 65000) and cross-VLAN notes
- **Documentation Link**: Links to the AKS Arc network system requirements documentation on MS Learn

#### Report: Firewall Allow List
- **Endpoint Requirements**: Added Firewall Allow List Endpoint Requirements row to the report Connectivity section

### Changed

#### Sizer: Three-Way Mirror for 3+ Node Standard Clusters
- **Resiliency Lock**: Standard clusters with 3 or more nodes are now locked to three-way mirror only — the two-way mirror option is removed for 3+ node configurations

#### Sizer: Sizing Notes Text Improvements
- **RAM → Memory**: Replaced all references to "RAM" with "memory" in sizing notes for consistency
- **Boot Drive Text**: Updated boot drive note to "minimum 400 GB OS disks recommended for systems with >768 GB memory"
- **Storage Layout Spacing**: Added spacing around the multiplication sign in storage layout notes (e.g. "6 × SSD" instead of "6× SSD")

### Fixed

#### Designer: Edge 2-Node Switchless Default Gateway
- **Gateway Field Fix**: Fixed the Default Gateway field being empty and disabled on the Edge 2-Node Switchless template — the template was using `ip: 'dhcp'` which caused `updateInfraNetwork()` to disable and clear the gateway field; changed to `ip: 'static'` with `infraGateway: '192.168.100.1'`

#### Sizer: Tiered Storage Detection
- **Disk Size Badge Fix**: Fixed MANUAL badge not appearing on Capacity per Disk for all-flash storage configurations — the tiered storage detection was incorrectly matching all-flash values like `nvme-capacity` as tiered; replaced with proper `_isTieredStorage()` helper that checks the `isTiered` property from storage tiering options

#### Sizer: ALDO Configure in Designer Fix
- **Disconnected Scenario**: "Configure in Designer" for ALDO Management Cluster now correctly selects the Disconnected scenario with Management Cluster role — previously defaulted to Hyperconverged
- **FQDN Prompt**: ALDO users are prompted for their Autonomous Cloud FQDN before navigating to the Designer, ensuring the FQDN and cluster role are pre-populated

#### Sizer: ALDO Analytics Tracking
- **Usage Tracking**: Selecting ALDO Management Cluster now increments the Sizer analytics counter, matching the tracking behavior of workload additions

#### CI: ESLint Fixes
- **Global Declaration**: Added `selectDisconnectedOption` to ESLint globals to resolve `no-undef` error in CI
- **Indentation Fix**: Re-indented `loadTemplate()` try-block from 4-space to 8-space to match surrounding code style
- **Variable Declarations**: Changed `var` to `const` in `loadTemplate()` for ESLint `no-var` compliance

#### Sizer: ALDO Cluster Type Switch-Back Fix
- **Workload Buttons**: Fixed bug where Add Workload buttons (VMs, AKS Arc, AVD) remained disabled after switching away from ALDO Management Cluster back to Standard or Rack-Aware
- **Node Dropdown**: Fixed Number of Physical Nodes dropdown staying greyed out after switching away from ALDO Management Cluster
- **Root Cause**: `renderWorkloads()` innerHTML replacement destroyed the `#empty-state` DOM element when rendering ALDO workloads — switching back to an empty workload list caused a TypeError (`appendChild(null)`) that halted `onClusterTypeChange()` before `updateAldoWorkloadButtons()` and `updateNodeOptionsForClusterType()` could re-enable controls; fixed by caching the element reference at module scope

---

## [0.17.04] - 2026-02-23

### Fixed

#### Example Template Loading (#140)
- **Template Completeness**: Fixed issue where loading an Example Configuration Template resulted in incomplete wizard progress (67–76%) instead of 100% — all five templates now load fully complete
- **Template Loading Race Condition**: Suppressed `updateUI()` during template loading to prevent cascading auto-defaults (`intent`, `storageAutoIp`) and disabled card recalculation between sequential `selectOption()` calls. Each `selectOption()` triggered a full `updateUI()` pass which auto-defaulted transient state and recalculated disabled cards, breaking subsequent selections in the cascade
- **Missing Template Data**: Added `privateEndpoints: 'pe_disabled'` to all five template configurations — the missing field caused IP Assignment cards to be disabled, blocking all downstream selections
- **Rack Aware Template**: Fixed intent from `compute_storage` to `mgmt_compute` (the only allowed intent for rack-aware scale); added `nodeCount: 8` to `rackAwareZones` to prevent `ensureRackAwareZonesInitialized()` from resetting zone confirmation; fixed `rackAwareTorsPerRoom` and `rackAwareTorArchitecture` to use valid card `data-value` attributes (`'2'`/`'option_a'` instead of `'single'`/`'separate'`)
- **Disconnected Template**: Fixed `activeDirectory` from `local_identity` to `azure_ad` (disconnected scenarios enforce `azure_ad` via constraints); added `clusterRole`, `autonomousCloudFqdn`, `fqdnConfirmed`, `adOuPath`, `adfsServerName` fields; fixed `loadTemplate()` to call `selectDisconnectedOption()` and restore FQDN state
- **AD Domain/DNS/OU Path Restoration**: Fixed `selectOption('activeDirectory')` resetting `adDomain`, `adOuPath`, `adfsServerName`, `dnsServers`, and `localDnsZone` — `loadTemplate()` now re-applies these values and restores DOM inputs after the reset
- **SDN Features DOM Restoration**: Fixed SDN feature checkboxes and management card not being visually selected after template loading — `loadTemplate()` now checks DOM checkboxes, calls `updateSdnManagementOptions()`, and selects the correct management card
- **Arc Gateway Values**: Fixed all non-disconnected templates from `arc: 'yes'` to `arc: 'arc_gateway'` — cards use `data-value="arc_gateway"` not `"yes"`
- **Edge 2-Node Switchless Template**: Fixed ports from `'2'` to `'4'` (mandatory for low_capacity + switchless + 2-node), intent from `'all_traffic'` to `'mgmt_compute'`, removed invalid `switchlessLinkMode: 'full_mesh'` (only valid for 3-node), expanded `portConfig` to 4 entries — the `updateUI()` HARD BLOCK was clearing all downstream state because `portConfigConfirmed` was reset when port count changed
- **Template Loading Order**: Moved `storageAutoIp` selection after `outbound`/`arc`/`proxy`/`privateEndpoints`/`ip` in `loadTemplate()` — the `outbound` handler resets `storageAutoIp` to `null`, so it must be set afterwards
- **Port Config Confirmation**: Set `portConfigConfirmed = true` when restoring `portConfig` from template data, so the "Confirm Port Selection" step shows as complete
- **Auto-Scroll During Loading**: Added `!window.__loadingTemplate` guards to `selectDisconnectedOption()` scroll calls to prevent the page from scrolling to the FQDN step during template loading
- **AD OU Path Consistency**: Added `adOuPath` to all five templates for consistent Active Directory configuration
- **Autonomous Cloud FQDN**: Updated disconnected template FQDN from `azurelocal.private` to `azurelocal.airgap.contoso.com`

### Added

#### Template Regression Tests
- **Template Data Completeness Tests**: 3 tests verifying all templates include required fields (`privateEndpoints`, `securityConfiguration`, `portConfig`)
- **Template Progress Tests**: 5 tests (one per template) verifying `computeWizardProgress()` returns 100% after `loadTemplate()`
- **Template Check Count Tests**: 5 tests validating the exact number of progress checks per template (accounting for conditional checks like static IP gateway and AD domain)
- **Rack Aware Zone Tests**: 3 tests verifying zone names, node assignments, and `nodeCount` match the template's node count
- **Disconnected Constraint Tests**: 5 tests verifying disconnected templates use `azure_ad` identity, `air_gapped` outbound, FQDN, and node settings
- **updateUI() Constraint Validation Tests**: 25 tests validating all template configs against the same constraints enforced by `updateUI()` — port counts for switchless topologies, intent rules for low_capacity/rack_aware, RDMA port requirements, valid card `data-value` attributes for arc/outbound, `switchlessLinkMode` validity, and disconnected arc constraints

---

## [0.17.00] - 2026-02-23

### Added

#### Disconnected Operations Wizard
- **Cluster Role Selection (D1 Step)**: New wizard step for selecting Management Cluster (fixed 3 nodes, hosts disconnected operations appliance VM providing local Azure Portal and CLI control plane) or Workload Cluster (1–16 nodes, connects to management cluster via Autonomous Cloud FQDN)
- **Autonomous Cloud FQDN Endpoint (D2 Step)**: FQDN input with real-time validation and confirm/edit gate — all subsequent wizard steps are hidden until FQDN is confirmed
- **Disconnected Context Banner**: "Why Azure Cloud & Region are still required" info banner displayed for management clusters as soon as the FQDN step is visible
- **Disconnected Operations Module**: New `js/disconnected.js` module encapsulating all disconnected wizard logic, UI management, FQDN validation, and cluster role constraints

#### Disconnected Network Diagrams
- **26 Draw.io Diagrams**: Complete set of network topology diagrams covering all intent configurations × 2 outbound modes (Limited Connectivity + Air-Gapped):
  - Fully converged (1 intent), Disaggregated (3 intents), Mgmt+Compute (2 intents)
  - Compute+Storage, 4-intent, 4-storage port configurations
  - Switchless 2/3/4-node variants
  - Single-node workload cluster with fully converged, mgmt+compute/storage, and disaggregated intent variants
  - 1-workload-cluster management cluster variants
- **Intelligent Diagram Routing**: Automatic diagram selection in reports based on cluster role, node count, intent type, storage topology (switched/switchless), port count, and custom NIC assignments

### Changed
- **Disconnected Scenario Description**: Updated to "No Internet connection required. Arc Gateway and private endpoint features are unavailable. Management clusters are fixed at 3 nodes; workload clusters support 1–16 nodes. Selection between Air-Gapped or limited connectivity options for Azure Local disconnected operations will be requested during the wizard."
- **Management Cluster Description**: Updated to "This cluster hosts the disconnected operations appliance VM that provides the local Azure Portal and CLI control plane. The management cluster is fixed at 3 nodes."
- **Disconnected Outbound Comparison**: Removed cons section from Air-Gapped and Limited Connectivity comparison cards; removed "Supports essential cloud management and updates" from Limited Connectivity pros
- **DNS Validation**: DNS servers are now validated against node IPs and default gateway to prevent IP conflicts
- **Scenario Formatting**: `formatScenario()` now distinguishes between Air-Gapped and Limited Connectivity for disconnected scenarios

---

## [0.16.04] - 2026-02-20

### Changed

#### Sizer UI Layout Improvements

- **ODIN Logo & What's New in Sizer Header**: Added the ODIN logo and version/What's New link to the Sizer page header, matching the Designer page branding
- **Reset Button Repositioned**: Moved the Reset button from the Sizer header into the Workload Scenarios section header with a confirmation prompt when workloads exist
- **Export Buttons Below Sizing Notes**: Moved Save as PDF and Download Word buttons from the Sizer header to below the Sizing Notes section for better workflow placement
- **Shared Changelog Module**: Extracted the `showChangelog()` function into a shared `js/changelog.js` file, reused by both the Designer and Sizer pages
- **S2D Resiliency Repair Storage Reservation**: The sizer now reserves 1 × capacity disk per node of raw pool space for Storage Spaces Direct repair jobs, up to a maximum of 4 × capacity disks. This deduction is applied before volume creation and reduces reported usable storage accordingly, with a sizing note explaining the reservation
- **Sizer Workload Analytics Tracking**: Added Firebase analytics tracking for sizer workload additions. Each new workload added (VM, AKS, or AVD) increments a `sizerCalculation` counter, displayed as "Sizes Calculated" on the main page stats bar alongside Page Views, Designs Generated, and ARM Deployments

#### Mobile & UI Polish

- **Designer: Mobile stats bar 2×2 layout**: The page analytics bar on the Designer home page now displays as a 2×2 grid on mobile devices instead of a single row of 4 items
- **Sizer: "Estimated Power, Heat & Rack Space"**: Updated the results box heading to include "Heat" since the section displays BTU/hr values
- **Sizer: Power units expanded to "Watts"**: Power values now display as "Watts" instead of "W" for improved readability
- **Sizer: BTU Wikipedia link**: "BTU" in the Total BTU/hr label is now a hyperlink to the Wikipedia article for readers unfamiliar with the unit
- **Sizer: Mobile layout consistency**: On mobile devices, the Sizer header now matches the Designer page — ODIN logo and What's New link appear centered at the top with the title and subtitle text immediately below, instead of side-by-side

#### Sizer Defaults

- **Sizer: Default cluster changed to Standard 2 Node**: The default cluster configuration is now a Standard 2 Node cluster (previously 3 Nodes), reducing the default starting hardware cost for sizing scenarios
- **Sizer: Default resiliency changed to Two-Way Mirror**: The default storage resiliency is now Two-Way Mirror (previously Three-Way Mirror), consistent with the 2-node minimum. Three-Way Mirror remains available and is automatically selected when 3+ nodes are configured

#### Security Meta Tag Cleanup

- **Removed invalid `X-Frame-Options` meta tag**: This HTTP-header-only directive was incorrectly set as a `<meta>` tag, causing a browser console warning. Removed from Designer, Sizer, Report, and ARM pages
- **Removed deprecated `X-XSS-Protection` meta tag**: This deprecated header (ignored by all modern browsers) was also set as a meta tag. Removed from all pages

### Fixed

#### Sizer Bug Fixes

- **vCPU Ratio AUTO Badge Persistence**: Fixed AUTO badge not persisting on the vCPU Overcommit Ratio field when auto-scaling adjusts the ratio
- **vCPU Ratio Label Correction**: Corrected "pCPU to vCPU overcommit ratio" to "vCPU to pCPU overcommit ratio" in sizing notes output
- **Node Recommendation Memory Cap Fix**: Fixed `buildMaxHardwareConfig` capping memory at 1 TB when calculating node recommendations, even when the user or auto-scale had set memory higher. The recommendation now uses the greater of 1 TB or the current per-node memory, preventing the sizer from recommending more nodes than needed when running large workloads with high-memory configurations
- **Stale Node Recommendation Message Fix**: Fixed the node recommendation message persisting from a previous calculation cycle when the user manually changed the node count. The message now always recalculates with current hardware specs to show accurate guidance
- **Manual Hardware Override Fix**: Fixed memory, CPU cores, and CPU sockets dropdowns being overridden by auto-scaling when the user manually changed them. Manual changes are now respected (matching the existing behaviour for vCPU ratio and disk config), with locks reset when workloads are added, removed, or cloned
- **Node Count Manual Increase Fix**: Fixed a bug where manually increasing the node count (e.g. 5 → 6) would immediately reset back to the auto-recommended value. The post-auto-scale node recommendation now uses info-only updates when the user has manually set the node count
- **1.5 TB Memory Threshold for Small Clusters**: For clusters with fewer than 10 nodes, per-node memory is capped at 1.5 TB in both the node recommendation engine and the memory headroom auto-scaling loop, preferring to add an additional node over jumping to expensive 2 TB+ DIMM configurations. If memory utilisation exceeds the headroom threshold at 1.5 TB, the auto-increment node loop adds a node and re-scales instead. Clusters with 10+ nodes continue to use the full memory range
- **Memory Headroom Threshold**: Raised the memory headroom threshold from 80% to 85% to avoid expensive DIMM tier jumps (e.g. 1 TB → 1.5 TB) when utilisation is comfortably below 85%. CPU and storage headroom remain at 80%
- **Bidirectional Memory & CPU Auto-Scaling**: Memory and CPU core auto-scaling now reduce per-node values when more nodes are available (e.g. after a node count increase or manual memory reduction), instead of only ever increasing. This keeps per-node memory at the smallest sufficient DIMM option and CPU cores at the smallest sufficient core count for the workload
- **Sizing Notes Reorder & Updates**: Cluster size and N+1 capacity note is now the first sizing note (e.g. "5 x Node Cluster - N+1 capacity: hardware requirements calculated assuming 4 nodes available during servicing / maintenance"). Hardware note updated to "Per node hardware configuration" format
- **iOS Safari Mobile Centering**: Fixed centering of logo, What's New link, and title/subtitle text on iOS Safari mobile devices by using explicit width and text-align properties instead of flex shorthand
- **Mobile Logo & Text Size**: Increased logo max-height from 80 px to 100 px and version/What's New font-size from 11 px to 13 px on mobile for improved readability
- **Node Preference over Ratio/Memory Escalation**: The sizer now prefers adding additional nodes before escalating the vCPU-to-pCPU ratio above 4:1 or bumping per-node memory above 2 TB. Auto-scaling operates in a conservative mode that caps memory at 2 TB and holds ratio at 4:1; an aggressive pass runs only when conservative scaling cannot fit workloads at the current node count
- **Auto-Down-Scaling after Aggressive Pass**: After the aggressive pass bumps memory or ratio above conservative limits, a node-reduction loop steps the node count back down while keeping utilization under 90 %, re-running conservative auto-scale at each step and reverting if any dimension exceeds the threshold
- **Resiliency Sync after Node Recommendation**: Fixed sizing notes and capacity calculations showing "Two-way mirror" while the dropdown displayed "Three-Way" for large clusters. `updateNodeRecommendation()` internally calls `updateResiliencyOptions()` which changes the dropdown, but the local resiliency variables were not re-read afterwards — all downstream calculations (auto-scale, capacity bars, sizing notes) used stale 2-way values
- **Deterministic Node Estimation**: Fixed adding future growth (e.g. 10%) paradoxically reducing the recommended node count. `buildMaxHardwareConfig()` was reading the stale node count from the DOM to determine the memory cap — with 12 nodes displayed it used a 2 TB cap, making each node appear more capable and recommending fewer nodes despite higher requirements. Now always uses a fixed 1.5 TB cap for deterministic results
- **AMD Auto-Switch before 6:1 Ratio**: Before escalating the vCPU-to-pCPU ratio from 5:1 to 6:1, the sizer now checks if switching to an AMD CPU generation with more physical cores (e.g. AMD Turin with up to 192 cores/socket = 384 dual-socket) would resolve compute pressure at the current 5:1 ratio. This keeps the overcommit ratio lower by adding real physical cores instead of increasing virtualisation density

### Added

#### Tests: Large Cluster & Scaling Test Suites

- **NODE_WEIGHT constant tests**: Validates `NODE_WEIGHT_PREFERRED_MEMORY_GB` (1536), `NODE_WEIGHT_PREFERRED_MEMORY_LARGE_CLUSTER_GB` (2048), and `NODE_WEIGHT_LARGE_CLUSTER_THRESHOLD` (10)
- **buildMaxHardwareConfig deterministic memory cap tests**: Verifies the fixed 1.5 TB cap applies regardless of current node count, ensuring deterministic results
- **autoScaleHardware conservative mode tests**: Confirms memory is capped at 2 TB and vCPU ratio stays at 4:1 in the default conservative path
- **autoScaleHardware aggressive mode tests**: Confirms memory can exceed 2 TB and vCPU ratio can escalate when aggressive options are enabled
- **AMD auto-switch tests**: Unit tests for `_tryAmdCoreUpgrade()` helper (switches to AMD, picks smallest sufficient core count, returns null when AMD can't help) and integration test verifying aggressive auto-scale switches to AMD at 5:1 instead of escalating to 6:1
- **Large cluster node recommendation tests**: Validates node counts for compute-driven, memory-heavy, storage-heavy, and future-growth scenarios
- **Node preference verification test**: Asserts that a 2 TB memory cap recommends more nodes than a 4 TB cap, confirming the preference for nodes over expensive hardware

---

## [0.16.03] - 2026-02-19

### Fixed

#### Custom Intent 8-Port Zone Restrictions ([#130](https://github.com/Azure/odinforazurelocal/issues/130) follow-up)

- **Restricted Zone Visibility for 8-Port Custom Intent**: When using custom intent with 8 ports, the wizard now only shows the 4 valid zones: Management + Compute, Compute 1, Compute 2, and Storage. Previously, all 7 zones (including Management, Compute + Storage, and Group All Traffic) were displayed, which are not valid for 8-port configurations.
- **Mandatory Zones Enforced**: Management + Compute and Storage are now marked as required (Min 2 Adapters) instead of optional. Only Compute 1 and Compute 2 remain optional.
- **Smart Default Mapping**: The default adapter mapping for 8-port custom now pre-assigns the first 2 non-RDMA ports to Management + Compute and the last 2 RDMA ports to Storage, with remaining ports in the unassigned pool.
- **Affected Files**: `js/script.js` (zone definitions in `getIntentZonesForIntent()`, default mapping in `getDefaultAdapterMapping()`).

---

## [0.16.02] - 2026-02-19

### Fixed

#### Custom Intent 8-Port Compute Intent Fix ([#130](https://github.com/Azure/odinforazurelocal/issues/130))

- **Separate Compute Zones for 8-Port Custom Intent**: When using custom intent with 8 ports, the wizard now offers two distinct compute zones (`Compute 1` and `Compute 2`) instead of a single `Compute` zone. Previously, all ports assigned to compute merged into one intent group, making it impossible to create two separate compute intents as required for 8-port configurations.
- **Expected 8-Port Layout**: 1 Management + Compute intent (mandatory), 2 independent Compute intents (optional), and 1 Storage intent (mandatory).
- **ARM Template Alignment**: The ARM template output now generates separate intent entries for each compute zone (`Compute` and `Compute_2`) with `trafficType: ['Compute']`, matching Azure Local Network ATC requirements.
- **Report Diagram Alignment**: The Configuration Report SVG diagram and Draw.io export correctly render separate compute intent groups with distinct labels and green color coding.
- **Affected Files**: `js/script.js` (zone definitions, grouping logic, traffic type mapping, NIC mapping display, ARM intent naming), `report/report.js` (custom intent groups, adapter mapping groups, diagram coloring, draw.io export).

---

## [0.16.01] - 2026-02-17

### Added

#### Sizer: Standardised Disk Size Dropdown
- **Standard NVMe/SSD Capacities Only**: All three disk size inputs (capacity, cache, tiered capacity) replaced with dropdown selects using standard NVMe/SSD sizes (0.96, 1.92, 3.84, 7.68, 15.36 TB). Eliminates invalid free-text entries and ensures consistent sizing calculations.

#### Sizer: Delete Confirmation Dialog
- **Accidental Deletion Prevention**: The `deleteWorkload()` function now shows a browser `confirm()` dialog with the workload name before removing it.

#### Sizer: Clone Workload
- **Duplicate Workload Button**: A new clone button (copy icon) on each workload card deep-clones the workload with all its settings and appends " (copy)" to the name.

#### Sizer: Estimated Power & Rack Space
- **Per-Node & Cluster Power Estimates**: New results section showing per-node power (W), total cluster power (W), BTU/hr, and rack units. Calculations include CPU TDP per socket, memory (~4W per DIMM), data disks (8W NVMe/SSD, 12W HDD), 2× OS boot disks (8W each), GPU TDP, and ~150W baseline overhead (fans, PSU efficiency loss, NICs, BMC). Rack units include 2U per node plus 2× 1U ToR switches for multi-node clusters. Section hidden when no workloads are defined.
- **OEM Caveat**: Clearly states that estimates are based on component TDP ratings and users should consult their preferred OEM hardware partner for accurate power and rack planning.

#### Sizer: AVD Custom Profile Validation
- **Range Warnings**: Custom AVD profile configurations now warn (via `confirm()`) if RAM per vCPU is below 1 GB or above 32 GB, or if vCPUs per user exceeds 16.

#### Sizer: Print Stylesheet Improvements
- **Better PDF Output**: The `@media print` stylesheet now hides the config panel, workload action buttons, onboarding overlay, and warning banners. Results panel goes full-width. `page-break-inside: avoid` applied to sections. Power & rack estimate section included in print output.

#### Sizer: Keyboard Accessibility
- **Escape Key**: Closes the active workload modal (priority) then the onboarding overlay.
- **Focus Trap**: Tab/Shift+Tab wraps focus within open modals to prevent tabbing behind the overlay.
- **Auto-Focus**: First input in the workload modal is automatically focused when the modal opens.

#### Sizer: vCPU Ratio Manual Override
- **User-Lockable vCPU Ratio**: When the user manually changes the vCPU Overcommit Ratio dropdown, the selection is now locked against auto-escalation. Auto-scaling will no longer override the user's manual choice. The lock resets automatically when workloads are added or removed, allowing auto-escalation to re-evaluate with the new workload profile.

#### Sizer: AMD CPU Suggestion Tip
- **AMD Alternative Recommendation**: When Intel cores and sockets are both at maximum and compute utilization is ≥80% at the baseline 4:1 ratio, a 💡 tip suggests AMD EPYC Turin as an alternative with higher core counts. The check uses the 4:1 baseline so the tip persists even when the ratio has been auto-scaled to 5:1 or 6:1.

#### Sizer: Auto-Scaled Field Visual Indicators
- **Purple Glow + AUTO Badge**: Hardware configuration fields that are auto-scaled now display a purple border glow animation and an "AUTO" badge on their labels, giving users clear visual feedback on which settings were automatically adjusted. Highlights clear and refresh on each calculation cycle.

#### Sizer: Capacity Label Renames
- **Clarity Improvements**: "Capacity Breakdown" renamed to "Capacity Usage for Workload". Compute, Memory, and Storage sub-labels now include a "- Consumed" suffix for clarity.

#### Sizer: Infrastructure_1 Volume Deduction
- **256 GB Reserved Storage**: The Infrastructure_1 volume (256 GB usable) reserved by Storage Spaces Direct is now deducted from overall usable storage in all capacity calculations — node recommendation, auto-scaling, capacity bars, and node increment loop. A sizing note explains the deduction. Raw cost scales with resiliency multiplier (e.g., 1024 GB raw for 4-way mirror).

#### Sizer: Disk Bay Consolidation
- **Fewer Larger Disks**: When auto-scaling would fill ≥50% of available disk bays (12 of 24 for all-flash, 8 of 16 for hybrid/mixed-flash), the sizer now evaluates all larger standard disk sizes and selects the smallest one that brings disk count below the 50% threshold. If none can, it picks the size that saves the most bays. A sizing note explains the optimisation and informs users they can manually revert to more smaller disks if preferred. Cache-to-capacity disk symmetry (1:2 ratio) is preserved for hybrid and mixed-flash configurations.

#### Sizer: Storage Limit Enforcement
- **Hard Block on Invalid Configurations**: Configurations exceeding 400 TB raw storage per machine or 4 PB (4,000 TB) per storage pool are now flagged with 🚫 error notes (upgraded from ⚠️ warnings), a red warning banner appears, and both "Configure in Designer" and "Download Word" export are blocked until the configuration is corrected.

#### Sizer: OEM Disclaimer
- **Subtitle Updated**: Sizer subtitle now includes a disclaimer that the tool provides example hardware configurations only and users should consult their preferred hardware OEM partner for detailed guidance.

### Changed

#### Sizer: AMD EPYC Turin Core Options
- **Expanded Core Options**: Updated AMD 5th Gen EPYC Turin to include 144, 160, and 192 cores per socket (maxCores: 192), reflecting the full Turin product line. Previously capped at 128.

#### Sizer: Cluster Type & Number of Physical Nodes Label Styling
- **Bolder Labels**: The "Cluster Type" and "Number of Physical Nodes" labels now use a bolder weight (600), slightly larger font (15px), and the primary text colour, making them stand out from other configuration options.

### Fixed

#### Sizer: Sizing Notes Consistency
- **Consistent Edit vs Add Behaviour**: Fixed three bugs causing sizing notes (e.g., vCPU overcommit ratio warnings) to differ when editing a workload vs adding a new one: (1) `_vcpuRatioAutoEscalated` flag reset moved from per-`autoScaleHardware()` call to once per `calculateRequirements()` cycle; (2) `initialVcpuRatio` comparison added after all auto-scale passes; (3) 32 GB host overhead added to memory calculation in node-increment loop.

#### Sizer: AMD Tip Text Fix
- **Duplicate "Intel" Removed**: Fixed the AMD suggestion tip which displayed "Intel Intel® 5th Gen Xeon®..." — removed the redundant prefix. Also added "per node" clarification to physical core count and removed trailing period.

#### Sizer: Power Estimate Core Scaling
- **CPU TDP Scales with Core Count**: The per-node power estimate now scales CPU TDP based on the selected core count relative to the generation's maximum. Uses a 40% base (uncore/IO) + 60% proportional model, so reducing cores visibly reduces the estimated power draw.

#### Sizer: Single Node Default Resiliency
- **Two-Way Mirror Default**: When "Single Node" cluster type is selected, the resiliency now defaults to Two-Way Mirror instead of Simple (No Fault Tolerance), providing single fault tolerance out of the box.

#### Sizer: Disk Bay Consolidation Count
- **Bidirectional Disk Count Update**: Fixed disk bay consolidation only increasing disk count, never decreasing it. When consolidation selects fewer, larger disks, both the disk count and disk size are now written together. Also fixed stale disk counts persisting after page refresh/resume by making auto-scale unconditionally write the target count (bidirectional) and resetting consolidation info at the start of each calculation cycle.

#### Sizer: Consolidation Note After Storage Headroom
- **Accurate Sizing Note**: Fixed the disk bay consolidation sizing note displaying the pre-headroom disk count when the 80% storage headroom pass added extra disks after consolidation. The consolidation info (disk count and bays freed) is now updated after the headroom loop completes.

#### Sizer: HTML Validation Fix
- **Encoded Ampersand**: Fixed a raw `&` character in the "Estimated Power & Rack Space" heading in `sizer/index.html` to `&amp;`, resolving an HTML validation error.

#### Sizer: AUTO Badge Persistence
- **Re-apply AUTO Badges Across Cycles**: Fixed AUTO badges (purple glow + "AUTO" label) disappearing from the CPU Cores per Socket and Memory per Node fields when adding workloads that increase the node count without changing per-node hardware values. The `autoScaleHardware()` function only marked fields when increasing their value; if the value was already adequate from a prior auto-scale cycle, the badge was cleared but never re-applied. The fix saves previously auto-scaled field IDs before clearing highlights, and re-applies badges to fields whose values remain at their auto-scaled level.

### Removed

#### Sizer: Dead Code Cleanup
- **Dual Parity Option**: Removed the unused `<option value="parity">Dual Parity (min 4 nodes)</option>` from the resiliency select dropdown.
- **`updateNodeOptions()` Function**: Removed the dead ~35-line function that was no longer called.
- **`RESILIENCY_MULTIPLIERS` Constant**: Consolidated into `RESILIENCY_CONFIG[resiliency].multiplier`, eliminating the duplicate constant.

---

## [0.15.98] - 2026-02-16

### Fixed

#### Default Gateway Field Unclickable on Safari ([#98](https://github.com/Azure/odinforazurelocal/issues/98))

- **Gateway Field Disable/Enable Consistency**: The Default Gateway input in Step 15 (Infrastructure Network) is now disabled with `opacity: 0.5` when no IP type is selected, matching the behaviour of the CIDR, Starting IP, and Ending IP fields. Previously the gateway was excluded from the `!state.ip` disable block, causing its parent `<div>` to have a different compositing state than its siblings. On Safari (macOS), this compositing mismatch could cause the browser to miscalculate hit-test regions, making the gateway field unclickable or untabbable. The DHCP/Static enable/disable logic later in `updateUI()` continues to manage the `disabled` property as before.

---

## [0.15.97] - 2026-02-16

### Fixed

#### Dynamic Storage Networks for Switched Storage ([#113](https://github.com/Azure/odinforazurelocal/issues/113))

- **Dynamic Storage Network Count**: Switched storage configurations now dynamically determine the number of storage networks based on how many NICs carry storage traffic, instead of hardcoding to 2. Supports up to 8 storage networks per Network ATC specification.
- **VLAN Override UI**: The Step 08 Intent Overrides panel now renders the correct number of VLAN ID input fields (one per storage network) with defaults of 711, 712, 713, ... 718.
- **ARM Template Generation**: The `storageNetworkList` array in generated ARM parameters now includes all N storage network entries with correct adapter names, VLANs, and optional subnet/IP info.
- **Fully Converged (All Traffic)**: When using `all_traffic` intent with 4+ ports, all ports are now correctly recognised as carrying storage traffic (previously only 2 were used).
- **ARM Import**: Importing an ARM template with more than 2 storage networks now correctly restores all VLAN overrides.
- **Summary Display**: The configuration summary now shows VLAN IDs for all N storage networks.
- **Storage Subnet Count**: Custom storage subnet allocation for switched deployments now scales to match the dynamic network count.

> **Note**: Switchless configurations (2-node, 3-node, 4-node) are not affected by this change — they continue to use their dedicated subnet/IP assignment logic.

---

## [0.15.96] - 2026-02-16

### Fixed

#### DCB QoS System/Cluster Priority Default Correction ([#117](https://github.com/Azure/odinforazurelocal/issues/117))

- **Corrected Default Cluster Priority**: Fixed the System/Cluster Priority dropdown in DCB QoS Overrides to show "Default (7)" instead of the incorrect "Default (5)". Per [Microsoft Network ATC documentation](https://learn.microsoft.com/en-us/windows-server/networking/network-atc/network-atc#default-data-center-bridging-dcb-configuration), the default Cluster Heartbeat priority is 7, not 5.
- **Updated Historical CHANGELOG Entry**: Corrected the original DCB QoS feature entry (Issue #44) to reflect the correct default priority value.

---

## [0.15.95] - 2026-02-15

### Changed

#### Sizer: Free-Input Configuration, Hardware Validation & Catalog Alignment ([#119](https://github.com/Azure/odinforazurelocal/issues/119))

- **DIMM-Symmetric Memory Configuration**: Memory per Node converted from fixed dropdown to DIMM-symmetric values (64, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048, 3072, 4096 GB) matching realistic server DIMM populations across 24 DIMM slots
- **Expanded Disk Count Options**: Capacity Disks per Node and Cache Disks per Node dropdowns now include every value from 2–24 (capacity, all-flash) / 2–16 (capacity, hybrid) and 2–8 (cache), instead of a limited subset (1,2,3,4,5,6,8,10,12,16,20,24)
- **Disk Size Auto-Scaling**: When disk count reaches the maximum (24) and storage is still insufficient, auto-scale now steps up disk size through standard capacities (0.96, 1.92, 3.84, 7.68, 15.36 TB)
- **Storage Headroom Scaling**: Storage capacity now participates in the 80% headroom pass — bumps disk count first, then disk size, to keep storage utilization below 80%
- **Smarter Node Recommendation**: Node count recommendation now considers max disk size (15.36 TB) in addition to max disk count (24), favouring per-node scale-up before adding nodes
- **CPU Sockets Capped at 2**: Removed 4-socket option — Azure Local OEM certified hardware supports 1 or 2 sockets only (per Azure Local Solutions Catalog)
- **Configurable vCPU Overcommit Ratio**: New Advanced Settings section with selectable vCPU-to-pCPU ratio (1:1, 2:1, 4:1 default, 5:1, 6:1). Replaces the hardcoded 4:1 assumption across `getRecommendedNodeCount()`, `autoScaleHardware()`, `calculateRequirements()`, and `updateSizingNotes()`, allowing users to match their hypervisor density policy
- **GPU Model Granularity**: GPU type dropdown now lists individual NVIDIA models — A2 (16 GB VRAM, 60W), A16 (64 GB, 250W), L4 (24 GB, 72W), L40 (48 GB, 300W), L40S (48 GB, 350W) — with VRAM and TDP shown in results summary, Word export, and Designer payload via new `GPU_MODELS` constant and `getGpuLabel()` helper. Select 0, 1, or 2 GPUs per node
- **Intel Xeon D 27xx (Edge)**: Added Intel Xeon D-2700 (Ice Lake-D) CPU generation to `CPU_GENERATIONS` for edge/rugged deployments (4–20 cores, DDR4-3200, PCIe 4.0, FCBGA 3820 package)
- **Minimum 2 Capacity Disks**: Capacity disk count minimum raised from 1 to 2 in HTML dropdown (both all-flash and tiered), matching Azure Local system requirements
- **Minimum 2 Cache Disks**: Cache disk count minimum raised from 1 to 2 for hybrid configurations
- **Hybrid Disk Chassis Limit**: Cache disks capped at 8 per node, hybrid capacity disks capped at 16 per node (8 cache + 16 capacity = 24 total drive bays in a 2U chassis). Each cache SSD is bound to 2 capacity HDDs
- **Mixed All-Flash Disk Chassis Limit**: Same 2U chassis constraint applied to mixed all-flash (NVMe cache + SSD capacity) — cache capped at 8, capacity at 16, total 24 drive bays. Sizing note recommends single-type all-flash for increased capacity
- **Single-Node All-Flash Only**: `updateStorageForClusterType()` now blocks hybrid storage for single-node clusters (was only blocked for rack-aware)
- **Cache Metadata Memory Overhead Note**: Sizing notes area displays "4 GB RAM per TB of cache" advisory when cache capacity is detected
- **400 TB Per-Machine Storage Warning**: Sizing note warns when raw storage per machine exceeds 400 TB
- **4 PB Cluster Storage Cap Warning**: Sizing note warns when total cluster raw storage exceeds 4,000 TB (4 PB)
- **Network Bandwidth Note**: Sizing note recommends RDMA-capable NICs with 25 GbE+ for storage traffic
- **Boot/OS Drive Note**: Sizing note recommends minimum 200 GB boot drive, or 400 GB+ for systems with >768 GB RAM
- **Updated Minimum Requirements Note**: Changed from "32 GB RAM, 4 cores" to "32 GB RAM, 2 data drives, at least 500 GB per drive"
- **Updated Auto-Scale Logic**: Hardware auto-scaling now steps through DIMM-symmetric memory options and disk counts instead of arbitrary increments
- **Updated Headroom Scaling**: Memory headroom steps through DIMM options instead of percentage-based jumps, with correct host overhead subtraction
- **Cluster Size Capacity Bar**: New "Azure Local hyperconverged instance size" visual bar in Capacity Breakdown section showing physical node count out of 16 maximum, with N+1 servicing and redundancy note
- **Rack-Aware Cluster Size Bar**: Cluster size bar dynamically adjusts maximum from 16 to 8 nodes when Rack-Aware cluster type is selected, matching the Azure Local rack-aware node limit
- **vCPU Ratio Auto-Escalation**: When compute utilization ≥90% and CPU cores/sockets are maxed out, the vCPU overcommit ratio auto-escalates from 4:1 → 5:1 → 6:1 to accommodate the workload. A red warning (🔴) appears in sizing notes when auto-escalation is triggered, recommending additional nodes or reduced vCPU requirements
- **Sizer-to-Report Data Flow**: vCPU ratio, GPU model, future growth percentage, and cluster type now included in the Sizer → Designer payload and rendered in the Configuration Report's Hardware Configuration section
- **Sizer Word Export vCPU Ratio**: vCPU ratio (pCPU:vCPU) row added to the Hardware Configuration table in Word/DOCX export
- **Updated Cache-to-Capacity Ratio**: Hybrid storage ratio enforcement works with DIMM-symmetric dropdown values
- **vCPU Ratio State Persistence**: New `vcpuRatio` field saved/restored in sizer state and reset to 4:1 on scenario reset

---

## [0.15.01] - 2026-02-12

### Added

#### ODIN Sizer (Preview) & Designer Integration

- **ODIN Sizer (Preview)**: New hardware sizing tool that calculates cluster requirements based on workload scenarios (VMs, AKS, AVD), storage resiliency, and capacity needs. Includes a hardware configuration panel for CPU manufacturer/generation/cores/sockets, memory, and tiered storage options.
- **Auto-Sizing Engine**: Intelligent node count recommendation based on compute, memory, and storage requirements. Favours scaling up CPU cores, memory (up to 1 TB), and disks per node before adding additional nodes. N+1 applied to compute/memory only (storage remains accessible during node drain).
- **Capacity Utilization Guard**: Blocks configurations when Compute, Memory, or Storage utilization ≥ 90% — visual warning banner, red capacity bars, sizing notes, and disabled "Configure in Designer" button to prevent overcommitted deployments.
- **Hybrid Cache-to-Capacity Ratio**: Hybrid storage automatically enforces a 1:2 cache-to-capacity disk ratio (e.g., 6× SSD cache + 12× HDD capacity). Ratio maintained during auto-scaling and manual capacity disk changes.
- **Sizer-to-Designer Integration**: "Configure in Designer" button transfers the full sizer configuration (CPU, memory, storage, workload summary) into the Designer wizard via localStorage. Auto-populates steps 01–05: Hyperconverged, Azure Commercial, East US (with update notice), cluster type, and node count.
- **"Unsure? Start with Sizer" Links**: Steps 04 (Cluster Configuration) and 05 (Cluster Size) in the Designer now include a styled navigation link to launch the Sizer.
- **Hardware in Configuration Report**: When imported from Sizer, the Markdown/PDF report includes a conditional "Hardware Configuration (from Sizer)" section with CPU, memory, storage, resiliency, and workload summary details.
- **Sizer Session Persistence**: Sizer state auto-saves to localStorage after every calculation. On return, a Resume / Start Fresh prompt appears — matching the Designer's existing pattern.
- **Sizer Description**: Updated subtitle to describe the tool's purpose for calculating hardware requirements.
- **Export Options**: Save as PDF (print-optimised layout) and Word (.doc) export for sizer results, including cluster config, hardware specs, requirements summary, and workload details.
- **Edit Workloads**: Edit existing workloads via cog icon on workload cards — opens the modal pre-populated with current values and changes the button to "Update Workload".
- **Official Azure Icons**: Replaced generic SVG icons with official Azure service icons (PNG) for VM, AKS Arc, and AVD workload types in the workload selector and workload cards.
- **Capacity Disks per Node**: Renamed "Number of Disks per Node" to "Capacity Disks per Node" for clarity.
- **Usable Storage Label**: Capacity Breakdown bar now labelled "Usable Storage" instead of "Storage" for clarity.
- **ODIN Favicon**: Added ODIN logo as browser favicon across all five HTML pages (Designer, Sizer, Report, ARM, Outbound Connectivity).
- **Clean Navigation URLs**: All internal links now use folder paths instead of explicit `index.html` references for cleaner URLs.

#### AVD Workload Enhancements

- **AVD Session Type**: Multi-session (shared VMs) / single-session (dedicated VM per user) dropdown with session-type-aware specs aligned to Microsoft session host sizing guidelines.
- **AVD Heavy Profile**: New workload tier for engineers and content creators (per MS session host sizing guide).
- **AVD Max Concurrency %**: Default 90% — reduces compute/memory sizing for realistic peak loads. Auto-hidden for single-session (always 100%).
- **AVD FSLogix Profile Storage**: Optional checkbox + per-user GB (default 30 GB) for user profile container storage.
- **AVD Knowledge Links**: Links to AVD for Azure Local architecture guide and session host sizing guidelines.
- **AVD Simulation Tools Note**: Recommendation to use LoginVSI for stress testing.
- **AVD Max Density Indicator**: Shows users/vCPU for multi-session or "Dedicated VM per user" for single-session.

#### Resiliency Guidance

- **2-Way Mirror Warning**: Recommendation banner when 2-way mirror is selected on a standard 3+ node cluster.
- **80% Headroom Auto-Scale**: Automatically bumps CPU cores/sockets and memory when capacity bars exceed 80%.

### Changed

- **2-Way Mirror Note**: Updated to "Two-way mirror (50% efficiency for two copies of data), performant and resilient to one fault domain (node) failure".
- **3-Way Mirror Note**: Updated to "Three-way mirror (33% efficiency for three copies of data), most performant and resilient to two fault domain (nodes) failures".
- **4-Way Mirror Note**: Updated to "Four-way mirror (25% efficiency), implemented as a rack-level nested mirror".
- **vCPU Ratio Note**: Updated to "vCPU calculations assume 4:1 pCPU to vCPU ratio".
- **High-Memory Note**: Updated to "Large memory system: Requires 400 GB+ or larger OS disks for supportability".

### Removed

- **N+1 Storage Tip**: Removed misleading storage maintenance sentence from sizing notes.

### Fixed

- **Sizer Save-on-Init Bug**: Initial `calculateRequirements()` during page load no longer overwrites saved localStorage state. The resume banner now correctly appears when returning to a previous session.

---

## [0.14.61] - 2026-02-12

### Fixed

#### 2-Node Switchless Diagram Port Labels (#93)

- **Missing `ports` variable in `renderSwitchlessStorageDiagram()`**: The adapter mapping resolution loop used `ports` which was undefined in the `renderSwitchlessStorageDiagram` function scope (it existed in a different parent function). The loop condition `ami <= undefined` was always false, so the port arrays kept their hardcoded defaults `[1,2]` / `[3,4]` regardless of the user's custom mapping. Added `var ports = parseInt(state.ports, 10) || 0;` at the top of the function.

---

## [0.14.60] - 2026-02-12

### Fixed

#### 2-Node Switchless Storage VLANs & Report Diagram (#93)

- **Missing Second VLAN ID Field**: `getStorageVlanOverrideNetworkCount()` unconditionally returned `1` for all switchless scenarios. For 2-node switchless, which requires two storage networks (VLANs 711 and 712), the function now returns `2`. This fixes the overrides UI (only 1 VLAN field shown), ARM template output (only 1 StorageNetwork entry), and configuration summary (only 1 VLAN displayed).
- **Report Diagram Port Labels**: The 2-node switchless Configuration Report diagram hardcoded port indices (Port 1,2 → Mgmt+Compute, Port 3,4 → Storage) instead of reading the user's custom adapter mapping from `state.adapterMapping`. Now resolves actual port assignments so the diagram matches the wizard configuration.

---

## [0.14.59] - 2026-02-12

### Fixed

#### Summary Blade NIC Mapping (#88)

- **Custom Adapter Mapping in Summary**: The right-side summary blade now correctly displays the user's custom NIC-to-intent mapping after clicking "Confirm Adapter Mapping". Previously, `getNicMapping()` used hardcoded default logic (Port 1,2 → Mgmt+Compute, Port 3+ → Storage) regardless of the user's drag-and-drop rearrangement. Added a check at the top of `getNicMapping()` to read from `state.adapterMapping` when `state.adapterMappingConfirmed` is true, consistent with how `getIntentNicGroups()` already handles this for the OVERRIDES section.

---

## [0.14.58] - 2026-02-12

### Fixed

#### Character Encoding in Configuration Report (#103)

- **UTF-8 Double-Encoding Fix**: Fixed 106 corrupted character sequences in `report/report.js` where UTF-8 multi-byte characters (em dashes, en dashes, arrows, emojis) were double-encoded through CP1252, causing garbled text in diagram titles, legends, and UI labels. Recovered all 21 unique character patterns to their correct Unicode representations.

---

## [0.14.57] - 2026-02-12

### Fixed

#### Storage Subnet CIDRs (#99)

- **Network ATC Default Subnets**: SVG diagram legends now show the correct Network ATC default subnets (`10.71.x.0/24`) when Storage Auto IP is enabled. Previously displayed incorrect `10.0.x.0/24` addresses. The fix updates `getStorageSubnetCidr()` to return `10.71.{subnetIndex}.0/24` when Auto IP is active, consistent with the report HTML tables which already referenced the `10.71.0.0/16` range.

---

## [0.14.56] - 2026-02-11

### Fixed

#### draw.io Diagram Enhancements (#94)

- **Orthogonal Routing**: Switchless storage subnet connectors now use L-shaped orthogonal routing (down → horizontal lane → up) with dedicated lanes per subnet, instead of straight overlapping lines. Matches the ODIN SVG diagram visual style.
- **Canonical Switchless Port Layout**: Switchless topologies now force canonical port allocation (2 management+compute ports + (n-1)×2 storage ports) regardless of user-configured port count, ensuring correct mesh edge connectivity for all node counts.
- **Report-Only Export**: Removed draw.io export button and generation code from the main wizard page (`script.js`). The draw.io download is now available exclusively on the Configuration Report page (`report.js`).

---

## [0.14.55] - 2026-02-11

### Fixed

#### Diagram Export Replaced with draw.io (#94)

- **Mermaid Removed, draw.io Added**: Replaced Mermaid export (which had rendering limitations with block-beta layout and no colored connectors) with draw.io format. Diagrams can now be downloaded as `.drawio` files and edited in draw.io / diagrams.net.
- **Both Main Tool & Report**: The draw.io export applies to both the main configuration wizard's diagram export and the Configuration Report's host networking diagram export.

---

## [0.14.54] - 2026-02-10

### Fixed

#### NIC Mapping to Intent on Low Capacity (#88)

- **RDMA-Aware Port Assignment**: Fixed `getMgmtComputeNicAssignment()` which ignored RDMA capability when assigning ports on non-standard scales (Low Capacity, etc.). The function previously always placed ports [1, 2] in Management + Compute regardless of RDMA status, causing RDMA ports to be incorrectly assigned to Management + Compute instead of Storage.
- **All Scales Now Consistent**: Non-RDMA ports are now preferred for Management + Compute across ALL scales (not just standard/medium), keeping RDMA-capable ports available for Storage traffic. Falls back to fixed [1, 2] assignment only when fewer than 2 non-RDMA ports exist.
- **Diagram and ARM Alignment**: The network diagram, ARM output fallback, and intent override cards now correctly reflect RDMA-based port assignments on Low Capacity, matching what the adapter mapping UI displays.

#### Safari Drag-and-Drop Interference (#88)

- **Click-After-Drag Guard**: Added `_adapterDragActive` flag that is set on `dragstart` and cleared 100ms after `dragend`, preventing Safari's spurious `click` event from triggering the click-to-swap fallback and unintentionally reversing the user's drag-and-drop operation.

### Improved

#### Touch Device Support

- **Tap-to-Select Fallback**: Added `touchend` event handler on adapter pills for mobile Safari and other touch devices where HTML5 drag-and-drop is not supported. Users can now tap adapters to select them and tap a target zone to move them.

#### Touch Device Support

- **Tap-to-Select Fallback**: Added `touchend` event handler on adapter pills for mobile Safari and other touch devices where HTML5 drag-and-drop is not supported. Users can now tap adapters to select them and tap a target zone to move them.

#### Test Coverage

- **215 Unit Tests**: Added 4 regression tests for issue #88 covering RDMA-aware port assignment on Low Capacity, RDMA port ordering, all-RDMA fallback, and consistency between `getIntentNicGroups()` and `getDefaultAdapterMapping()`.

### Added

#### Mobile-Responsive Navigation (#87)

- **Responsive Nav Bar**: Added `@media (max-width: 768px)` breakpoint for the navigation bar. On mobile portrait, tab labels collapse to icon-only display, padding is reduced, and badge text is hidden to prevent overflow.
- **Onboarding Card Scrollability**: The welcome splash / onboarding card now has `max-height: 90vh` with `overflow-y: auto`, ensuring the "Next" button remains reachable on small screens.
- **Touch-Friendly Buttons**: Onboarding navigation buttons now have `min-height: 44px` to meet mobile touch target guidelines.

#### draw.io Diagram Export (#86)

- **Generate draw.io Diagram**: New `generateDrawioDiagram()` function produces draw.io XML from the current network configuration state, including intent-grouped adapter layouts, switchless storage subnet connections with color-coded RDMA ports, and rack-aware groupings.
- **Report Page draw.io**: New `generateHostNetworkingDrawio()` on the report page produces the same intent-grouped draw.io output with switchless subnet edges for 2/3/4-node topologies.
- **Download as .drawio**: "⬇️ Download .drawio" button downloads the diagram as an editable draw.io file compatible with diagrams.net.

---

## [0.14.53] - 2026-02-09

### Fixed

#### ARM Template Storage Adapter Naming (#74)

- **StorageNetwork2 Adapter Name**: Fixed ARM template generation where both StorageNetwork1 and StorageNetwork2 used the same adapter name (SMB1). StorageNetwork2 now correctly references the second adapter name (SMB2) by passing the correct 1-based index to the adapter lookup function.

#### VLAN ID Defaults of Zero (#75)

- **Empty String VLAN Handling**: Fixed `getStorageVlans()` to reject empty strings that JavaScript's `Number('')` silently converts to `0`, which is an invalid VLAN ID for Azure Local.
- **Default Override Guard**: Updated `ensureDefaultOverridesForGroups()` to treat VLAN values of `0` and empty string as unset, ensuring proper defaults (711/712) are applied instead of invalid zero values.

#### NIC Speed Locked to 10 GbE on Single-Node (#76)

- **Port Speed Override Removed**: Removed the forced `speed = '10GbE'` override that was applied to all ports in single-node cluster configurations, allowing users to select and retain their preferred NIC speed (1 GbE, 10 GbE, 25 GbE, 50 GbE, 100 GbE).

#### IP Address Validation — Network and Broadcast Addresses (#78)

- **Node IP Validation**: Node IP/CIDR entries now reject network addresses (host portion all zeros, e.g., `192.168.1.0/24`) and broadcast addresses (host portion all ones, e.g., `192.168.1.255/24`) with clear error messages.
- **DNS Server Validation**: DNS server IP fields now reject addresses with last octet `.0` (network) or `.255` (broadcast).
- **Real-time Feedback**: The inline field validators for `ipv4cidr` and `ipv4` types now show specific error messages when a network or broadcast address is entered.
- **Utility Functions**: Added `isNetworkOrBroadcastAddress()` for CIDR-aware validation and `isLastOctetNetworkOrBroadcast()` for bare IP checks.

#### Switchless Storage Intent Adapter Names

- **Intent List Adapter Names**: Fixed ARM `intentList` where switchless storage adapters were named `SMB1`, `SMB2`, etc. instead of using the wizard's port display names (`Port 3`, `Port 4`, etc.). Refactored `getStorageAdapterNamesForIntent()` to delegate to `armAdapterNameForSmb()` instead of duplicating logic with hardcoded "SMB" fallback.

#### Default Gateway Validation on Resume/Load

- **Gateway State Sync**: Fixed "Complete These Sections: Default Gateway" warning appearing incorrectly after resuming a saved session or loading a template, even when the gateway was already configured.
- **DOM Fallback Check**: `getReportReadiness()` now checks the DOM input field as a fallback when `state.infraGateway` is stale.
- **Resume/Load Restore**: `resumeSavedState()` and `loadTemplate()` now properly restore the `infraGatewayManual` flag and call `updateInfraNetwork()` to sync state.

#### Storage VLAN Key Mismatch for Custom Intent

- **VLAN Placeholder Fix**: Fixed ARM output showing `REPLACE_WITH_STORAGE_VLAN_1` / `REPLACE_WITH_STORAGE_VLAN_2` placeholders instead of actual VLAN IDs when using a custom intent with adapter mapping confirmed.
- **Key Alignment**: `getStorageOverrideKey()` now checks `adapterMappingConfirmed` and returns the correct unprefixed key (`storage`) matching `getIntentNicGroups()` behavior.
- **Fallback Lookup**: `getStorageVlans()` checks both `custom_storage` and `storage` override keys to handle timing-dependent state.

#### DNS Validation Blocks Report Generation

- **DNS Validation Gating**: DNS server validation (network/broadcast address checks) now blocks report and ARM generation instead of only showing a warning.

### Improved

#### Shared Navigation Component

- **Centralized Nav Bar**: Extracted the duplicated navigation bar HTML from `index.html`, `sizer/index.html`, and `docs/outbound-connectivity/index.html` into a shared `js/nav.js` component. All pages now render the nav from a single source, ensuring consistency.
- **Feedback Button**: Added a "💡 Feedback" link in the navigation bar (all pages) pointing to the GitHub Issues page for raising feedback or bugs.
- **Sizer Disclaimer**: Added a disclaimer banner on the Sizer page noting that Sizer functionality is in active development and integration with the Designer wizard will be available in a future release.

#### Port Name Consistency Across All Outputs

- **ARM Adapter Names**: ARM parameter file adapter names now use the wizard's port display names (e.g., `Port 1`, `Port 2`) instead of generic `NIC1`/`SMB1` prefixes, matching what users see in the wizard UI. JSON strings support spaces, so no sanitization is applied.
- **Configuration Summary Labels**: The sidebar Configuration Summary now displays custom port names from `getPortDisplayName()` instead of hardcoded "NIC X" labels.

#### CI Pipeline Hardening

- **Blocking CI Jobs**: ESLint, unit tests, and HTML validation CI jobs now block pull request merges on failure (removed `continue-on-error`).
- **HTML Validation**: Added automated HTML5 validation for all HTML files with `.htmlvalidate.json` configuration.
- **198 Unit Tests**: Expanded test suite from 136 to 198 tests with regression coverage for all bug fixes.

---

## [0.14.52] - 2026-02-06

### Added

#### Markdown Report Export

- **Download Markdown**: Added "📝 Download Markdown" button to the Configuration Report page, enabling export of the full report as a `.md` file with embedded network diagrams
- Markdown export includes all report sections: metadata, scenario & scale, host networking, port configuration, connectivity, infrastructure network, node configuration, identity, security, and SDN settings
- Host networking and outbound connectivity diagrams are embedded as inline images for self-contained documentation
- All configuration data is rendered as clean Markdown tables for easy embedding in documentation, wikis, or version-controlled repos
- File is named with timestamp (e.g., `AzureLocal-Config-20260206-1430.md`)

#### Duplicate Adapter Name Validation

- **Port Configuration Validation**: Added validation to prevent duplicate adapter names in Step 07 (Network Adapter Ports)
- **Visual Feedback**: Ports with duplicate names show red border and "⚠ duplicate" warning label
- **Toast Warning**: Shows warning notification when user enters a duplicate adapter name
- **Report Readiness Gating**: Blocks report/ARM generation when duplicate adapter names exist
- Duplicate detection is case-insensitive (e.g., "Ethernet1" and "ETHERNET1" are treated as duplicates)

### Fixed

#### Diagram Intent Grouping for Custom Intents

- **Custom Intent Diagram Grouping**: Fixed network diagram to properly group adapters by intent when using custom intent configurations with non-contiguous port assignments
- When users assign ports from different slots to the same intent (e.g., "Slot 3 Port 1" and "Slot 6 Port 2" both to Compute), the diagram now displays them adjacent to each other within the same intent box
- Previously, ports were displayed in physical slot order regardless of intent assignment, making the diagram confusing for non-standard configurations
- Intent boxes are now drawn based on logical grouping rather than physical port ordering

---

## [0.14.51] - 2026-02-05

### Added

#### Automated Build Pipeline

- **GitHub Actions CI/CD**: Automated build validation pipeline runs on every push and pull request
- **RFC 1918 DNS Validation**: DNS servers must be private IP addresses when using Active Directory (prevents use of public DNS like 8.8.8.8)
- **Keyboard Navigation**: Option cards are now keyboard accessible with Tab navigation and Enter/Space selection

### Fixed

- **Light Mode Input Fields**: Fixed all input fields (node name/IP, DNS, infrastructure CIDR, VLAN, AD domain, OU path) showing white text on light theme
- **Missing Sections Links**: "Complete These Sections" links for node items now correctly navigate to Management Connectivity step
- **SDN Management Resume**: Fixed SDN Management selection not being restored when resuming a saved session
- **Infrastructure Network Resume**: Fixed Infrastructure Network validation errors when resuming a saved session
- **ESLint Integration**: JavaScript code quality checks with comprehensive linting rules
- **HTML Validation**: Automated HTML5 validation to catch markup errors
- **136 Unit Tests**: Automated test suite runs in headless browser environment
- **Cross-Browser Testing**: Tests execute in Chromium via Playwright for consistent results
- **Code Quality Gates**: Pull requests must pass all checks before merge

---

## [0.14.50] - 2026-02-05

### Changed

#### Codebase Optimization & Modularization

- **Project Structure Reorganized**: Cleaner folder organization for better maintainability:
  - `arm/` - ARM parameter generator (arm.html, arm.js)
  - `report/` - Configuration report generator (report.html, report.js)
  - `css/` - Stylesheets (style.css)
  - `images/` - Logo and visual assets
  - `js/` - All JavaScript modules including new Phase 2A modules
  - `tests/` - Unit tests and development server
  - `scripts/` - Utility scripts
  - `docs/archive/` - Historical documentation
- **Phase 2A Modularization Complete**: Extracted additional functions into dedicated modules:
  - `js/formatting.js` - Display formatting functions (getPortDisplayName, formatScenario, formatRegion, etc.)
  - `js/validation.js` - Real-time field validation (validateFieldRealtime, addValidationFeedback)
  - `js/dns.js` - DNS server management (addDnsServer, removeDnsServer, renderDnsServers, etc.)
- **Comprehensive Unit Test Suite**: Expanded from 34 to 136 unit tests covering utils, formatting, validation, DNS, and theme modules
- **Preview Button Removed**: Removed redundant "Preview Cluster Configuration" button and Alt+P shortcut - the Configuration Summary panel provides real-time feedback
- **Documentation Updated**: QUICK_START.md refreshed with current project structure and features

---

## [0.14.2] - 2026-02-05

### Fixed

#### ARM Template Import - Adapter Names and Diagram

- **Adapter Names Preserved**: Importing ARM templates now preserves adapter names (NIC1, NIC2, SMB1, SMB2, etc.) from the template instead of displaying generic "Port 1", "Port 2" labels
- **Single-Node Diagram**: Fixed issue where host networking diagram was not displaying in the configuration report for single-node deployments (diagram extraction was missing 'Network Connectivity (Diagram)' title)

---

## [0.14.1] - 2026-02-05

### Fixed

#### ARM Template Import - Management + Compute Adapters

- **Adapter Mapping Zone Key**: Fixed issue where Management + Compute adapters were not loading into the wizard UI when importing ARM templates from existing deployments
- **Root Cause**: The adapter mapping was using zone key `'mgmt'` instead of `'mgmt_compute'`, causing adapters to not match any valid zone for the `mgmt_compute` intent
- **Affected Functions**: `parseArmTemplateToState` and `applyArmImportState` now correctly use `'mgmt_compute'` zone key

---

## [0.14.0] - 2026-02-05

### Added

#### Code Modularization (Phase 1)

- **Modular JavaScript Structure**: Extracted utility functions into separate files for better maintainability:
  - `js/utils.js` - Pure utility functions (escapeHtml, sanitizeInput, formatNumber, capitalize, CIDR/IP validation and manipulation)
  - `js/theme.js` - Theme switching and font size management (increaseFontSize, decreaseFontSize, applyFontSize, toggleTheme, applyTheme)
  - `js/notifications.js` - Toast notifications, error reporting, clipboard operations (showToast, reportUiError, showNotification, copyToClipboard)
  - `js/analytics.js` - Firebase analytics integration (FIREBASE_CONFIG, analytics state, initializeAnalytics, trackPageView, trackFormCompletion, fetchAndDisplayStats)
- **Load Order**: New modular files load before script.js to ensure global availability of functions

### Changed

#### Diagram NIC Label Positioning

- **Centered NIC Labels**: Network adapter names in cluster diagrams are now vertically centered when 9 characters or less
- **Staggered Long Labels**: Adapter names with 10+ characters use staggered vertical positioning for better readability
- **All Diagram Types Updated**: Improved label positioning applies to:
  - Storage Switched cluster diagrams
  - Rack-Aware cluster diagrams
  - 2-node Switchless diagrams
  - 3-node Switchless diagrams (single-link and dual-link)
  - 4-node Switchless diagrams

---

## [0.13.30] - 2026-02-05

### Added

#### ARM Import Private Endpoints Option

- **Private Endpoints Question**: When importing ARM templates, the import dialog now asks if the deployment uses Private Endpoints (Private Link)
- **Service Selection**: If Yes, an expandable section displays checkboxes for selecting which Azure services have Private Endpoints configured:
  - Key Vault, Storage Account, Container Registry, Site Recovery, Azure Backup, SQL Managed Instance, Microsoft Defender
- **State Population**: Selected services are properly imported into the Designer wizard's Private Endpoints configuration

#### Sizer UX Improvements

- **Rack-Aware Node Validation**: Rack-Aware clusters now only allow 2, 4, 6, or 8 nodes (even numbers for balanced rack distribution)
- **Sizer Section Reorder**: Workload Scenario section now appears first, followed by Cluster Configuration for better workflow

### Fixed

#### Theme Support

- **Disclaimer Banner Theme**: The disclaimer banner now properly responds to light/dark theme changes using CSS variables
- **Navigation Bar Theme**: Navigation bar background and button hover states now properly update in light/dark modes across all pages
- **Sizer Dropdown Theme**: Dropdown boxes in Sizer page now visible in light mode using CSS variables
- **Progress Bar Theme**: The wizard progress bar title and font size buttons now properly respond to light/dark theme changes
- **Breadcrumb Navigation Theme**: The step progress breadcrumb bar (Type, Cloud, Region, etc.) now properly responds to light/dark theme changes
- **Summary Panel Theme**: Configuration summary panel buttons (Import/Export) and section backgrounds now properly respond to light/dark theme changes
- **Disconnected Region Info Moved**: Azure region informational message for disconnected deployments moved from Step 02 to Step 03 (Azure region selection)

---

## [0.13.19] - 2026-02-05

### Added

#### Sizer Preview Badge on Navigation

- Added "Preview" badge on the Sizer tab button in the navigation bar across all pages
- Badge uses purple styling consistent with the ODIN design language

#### Theme Toggle in Navigation Bar

- Added theme toggle button to the navigation bar on all pages (Designer, Knowledge, Sizer)
- Theme toggle appears on the far right of the navigation bar
- Theme preference syncs across all pages using shared localStorage
- Light/Dark mode properly updates all UI elements

#### Disconnected Deployment Region Info

- Added informational message in Step 02 (Azure Cloud) when Disconnected deployment type is selected
- Message clarifies that Azure region is required for disconnected deployments to download the control plane appliance image, updates, and licensing
- Uses blue informational styling consistent with other info boxes in the wizard

---

## [0.13.18] - 2026-02-05

### Fixed

#### ARM Template Import Adapter Mapping

- Fixed ARM template import to properly parse adapter mapping from intentList
- When importing templates with mgmt_compute intent, both NIC and SMB adapters are now correctly mapped
- NIC adapters (from Compute_Management intent) are mapped to Management + Compute zone
- SMB adapters (from Storage intent) are mapped to Storage zone
- Port count now correctly includes both NIC and SMB adapter counts

---

## [0.13.17] - 2026-02-05

### Fixed

#### Diagram Uplink Connections Based on Intent Group Position

- Fixed ToR switch uplink connections to use position within intent group instead of physical NIC index
- First port of each intent group now correctly connects to ToR Switch 1
- Second port of each intent group now correctly connects to ToR Switch 2
- Applied fix to all switched diagram scenarios:
  - Standard adapter mapping (mgmt_compute intent)
  - Default port layout (NICs 1-2 Mgmt+Compute, NICs 3+ Storage)
  - Custom intent configurations

---

## [0.13.16] - 2026-02-05

### Fixed

#### Diagram Intent Grouping for Non-Contiguous Adapter Mapping

- Fixed switched storage diagram to properly group ports by intent visually
- When adapter mapping has non-contiguous NICs (e.g., Mgmt+Compute using NICs 1,3 and Storage using NICs 2,4), the diagram now:
  - Groups all Mgmt+Compute ports together on the left with a labeled dotted blue box
  - Groups all Storage ports together on the right with a labeled dotted purple box
  - Displays ports in logical groups rather than physical port order
- Both intent groups now have properly labeled boxes (previously only Storage had a label)

---

## [0.13.15] - 2026-02-05

### Improved

#### ARM Template Import Auto-Confirmation

- When importing ARM templates from existing deployments, wizard now auto-confirms:
  - Port configuration (portConfigConfirmed)
  - Adapter mapping for mgmt_compute intent (adapterMappingConfirmed)
  - Intent overrides (overridesConfirmed)
  - Custom storage subnets if present (customStorageSubnetsConfirmed)
- Removes unnecessary manual confirmations when importing a template from a working deployment
- Auto-builds adapter mapping for mgmt_compute intent based on port count (first 2 for mgmt, remaining for storage)

---

## [0.13.14] - 2026-02-05

### Fixed

#### Diagram Intent Box Rendering for Non-Contiguous Adapter Mapping

- Fixed switched storage diagram to correctly render intent group boxes when adapter mapping has non-contiguous NICs
- Previously, if Mgmt+Compute used NICs 1 and 3 while Storage used NICs 2 and 4 (interleaved), the intent boxes would incorrectly span from NIC 1-3 and 2-4, overlapping each other
- Now correctly renders separate boxes for each contiguous run of NICs within an intent group
- Properly handles any custom adapter mapping configuration with non-adjacent port assignments

---

## [0.13.13] - 2026-02-05

### Changed

#### Unified Confirmation Button Styling

- Updated all confirmation buttons to use the same purple gradient style as "Confirm Port Configuration"
- Applied consistent styling to: "Confirm Adapter Mapping", "Confirm Overrides", "Confirm Storage Subnets"
- Added checkmark icon to all confirmation buttons
- Added pencil icon when in "Edit" mode (after confirmation)
- Added green gradient styling for confirmed state
- Improved disabled state styling

---

## [0.13.12] - 2026-02-05

### Fixed

#### Switchless Storage Port Names

- **Correct Physical Port Names for Storage** - Switchless storage diagrams now correctly display custom port names for physical storage ports (ports 3+). Previously, the code incorrectly assumed SMB adapters were virtual and showed "SMB1", "SMB2", etc.

- **Storage Adapter IPs Section** - The "Storage Adapter IPs" section in reports now uses the correct storage port indices (ports 3+) instead of starting from port 1 (which is a Mgmt+Compute port).

- **Port Index Calculation** - Storage port index is now calculated as `smbIndex + 2` to correctly map to physical ports 3, 4, 5, etc. for 2-node, 3-node, and 4-node switchless configurations.

---

## [0.13.11] - 2026-02-05

### Fixed

#### Switchless Diagram Port Labels and Staggering

- **Correct SMB Adapter Names** - Switchless storage diagrams (2-node, 3-node, 4-node) now correctly display "SMB1", "SMB2", etc. for virtual SMB adapters instead of incorrectly showing physical port names from portConfig.

- **Staggered Text Positioning** - Added staggered vertical text positioning to both SET (vSwitch) NIC tiles and Storage intent (RDMA) SMB tiles in all switchless diagrams to prevent text overlap.

- **Consistent Across All Switchless Scenarios** - Applied fixes to 2-node switchless, 3-node single-link switchless, 3-node dual-link switchless, and 4-node switchless diagrams.

---

## [0.13.10] - 2026-02-05

### Fixed

#### Rack Aware Diagram Port Name Overlap

- **Staggered Text Positioning** - Port name labels in Rack Aware TOR diagrams are now staggered vertically within the adapter tiles (first port higher at y+14, second port lower at y+22) to prevent overlapping text when using long custom port names.

- **Applied to Both Intent Groups** - The staggered text fix applies to both Mgmt+Compute and Storage (RDMA) intent groups.

---

## [0.13.9] - 2026-02-05

### Fixed

#### Rack Aware Diagram Port Labels

- **Adapter Mapping Support in Rack Aware Diagrams** - The `renderRackAwareTorArchitectureDiagram` function now respects the confirmed adapter mapping to determine which ports belong to Mgmt+Compute vs Storage intents.

- **Correct Port Names in Intent Groups** - Mgmt+Compute and Storage intent groups now display the correct custom port names based on the user's adapter mapping configuration, instead of assuming ports 1-2 for Mgmt+Compute and ports 3+ for Storage.

---

## [0.13.8] - 2026-02-05

### Fixed

#### ARM StorageNetwork2 Custom Port Name

- **StorageNetwork2 networkAdapterName** - Fixed switched storage ARM template generation where `StorageNetwork2` was incorrectly using hardcoded "SMB2" instead of the custom port name. The port index calculation in `armAdapterNameForSmb()` was off by one for the second storage network.

---

## [0.13.7] - 2026-02-05

### Fixed

#### Diagram Port Labels and Text Overlap

- **Physical Port Names in Diagrams** - All diagram rendering functions now consistently use `getNicLabel()` for physical port names. Previously, storage ports incorrectly used `getSmbLabel()` which returns virtual SMB adapter names instead of physical port names.

- **Staggered Text Positioning** - Port name labels within adapter shapes are now staggered vertically (odd ports higher, even ports lower) to prevent overlapping text when using long custom port names.

- **Consistent Fix Across Rendering Paths** - Applied fixes to `renderAdaptersHorizontal()` (both adapter mapping and default paths) and `renderCustomAdaptersHorizontal()` functions.

---

## [0.13.6] - 2026-02-05

### Fixed

#### Report Diagrams Honor Adapter Mapping

- **Correct Intent Assignments in Diagrams** - Switched network diagrams now correctly display adapter-to-intent assignments based on the confirmed adapter mapping. Previously, diagrams assumed NICs 1-2 were always Management+Compute and NICs 3+ were Storage, ignoring user-defined mappings.

- **Adapter Mapping Groups** - Added `getAdapterMappingGroups()` helper to build intent groups from `state.adapterMapping` when adapter mapping is confirmed.

- **Smaller Font Size for Adapter Labels** - Reduced font size from 10-11px to 9px for adapter labels in switched network diagrams to accommodate longer custom port names.

---

## [0.13.5] - 2026-02-05

### Changed

#### Port Configuration UX Improvements

- **Read-Only Port Names by Default** - Port name inputs are now read-only by default. Users must click the pencil icon to enable editing, preventing accidental changes.

- **Confirm Port Configuration Button** - Added a "Confirm Port Configuration" button that must be clicked before proceeding to Step 08 (Network Traffic Intents). This ensures users intentionally finalize their port settings.

- **Edit Button for Confirmed Configuration** - After confirmation, a "✓ Port configuration confirmed" message appears with an "Edit" button to re-enable modifications if needed.

- **Disabled State When Confirmed** - All port configuration controls (name, speed, RDMA) are disabled after confirmation to prevent unintended changes.

- **Automatic Confirmation Reset** - Confirmation is automatically reset when port count changes or when earlier configuration choices affect port settings.

---

## [0.13.4] - 2026-02-05

### Fixed

#### Custom Port Names in ARM storageNetworkList

- **ARM Template Storage Network Names** - The `networkAdapterName` property in `storageNetworkList` now uses customer-provided custom port names instead of hardcoded "SMB1", "SMB2", etc.

- **Applies to All Switchless Configurations** - 2-node, 3-node, and 4-node switchless storage configurations now correctly use custom SMB adapter names.

- **Switched Storage Networks** - Regular (switched) storage network1/network2 sections also use custom port names.

#### Report Host Networking Section

- **Storage Adapter IPs Use Custom Names** - The Host Networking "Storage Adapter IPs" section in reports now displays custom port names instead of hardcoded SMB labels.

#### Diagram Font Sizes for Long Custom Names

- **Smaller Font in Adapter Tiles** - Reduced font size from 12px to 9px in NIC and SMB adapter tiles within switchless diagrams to accommodate longer custom port names.

---

## [0.13.3] - 2026-02-05

### Added

#### Custom Port Names for Storage (SMB) Adapters

- **SMB Adapters Use Custom Names** - Storage adapters in ARM templates now use custom port names instead of hardcoded "SMB1", "SMB2", etc. This applies to both switched and switchless storage configurations.

- **Full Round-Trip Support** - Custom port names are now fully preserved when exporting and importing ARM templates for all adapter types (NIC and SMB).

- **Switched Storage** - Uses custom names from storage port configuration (ports 3, 4, etc.)

- **Switchless Storage** - Uses custom names from ports after management/compute ports for virtual SMB adapters.

### Fixed

- **ARM Import Port Configuration** - Fixed issue where imported portConfig was missing required properties (speed, rdma, rdmaMode). Now properly merges imported custom names with default port settings.

---

## [0.13.2] - 2026-02-05

### Fixed

#### Custom Port Names Now Appear in Report Diagrams

- **Report Diagrams Use Custom Names** - Fixed issue where the host networking diagrams in the report were still showing default "NIC 1", "NIC 2", "SMB1", etc. names instead of user-defined custom port names. All diagram types (Storage Switched, Switchless 2/3/4-node) now correctly display custom port names.

- **Improved Port Naming UX** - Added a visible pencil icon (✏️) next to port names in Step 07 (Port Configuration) to make it clear that port names are editable. The input field now shows a subtle border even when not focused, improving discoverability.

---

## [0.13.1] - 2026-02-05

### Improved

#### ARM Import Honors Custom Adapter Names

- **Custom Adapter Names Preserved on Import** - When importing an ARM template that uses custom network adapter names (e.g., "Slot3-Port1", "NIC-MGMT-01"), the wizard now extracts and preserves these names in the Port Configuration section.

- **Automatic Detection** - The import logic distinguishes between NIC adapters (used for Management/Compute) and SMB adapters (used for Storage), mapping each to the appropriate port configuration.

- **Diagram Generation** - Imported custom names will appear in all generated diagrams and reports, ensuring consistency with the customer's existing naming conventions.

---

## [0.13.0] - 2026-02-05

### Added

#### Custom Network Adapter Port Naming

- **Editable Port Names** - Users can now customize network adapter port names in the Port Configuration section (Step 07) to match their existing Windows naming conventions. Simply click on any port name to rename it (e.g., "Slot3-Port1", "NIC-MGMT-01", etc.).

- **Propagated Throughout Wizard** - Custom port names automatically appear in:
  - Adapter Mapping Configuration (Step 08) - adapter chips display custom names
  - ARM Template generation - uses custom names for network adapter names
  - All generated reports and diagrams

- **Preserved When Changing Port Count** - If you change the number of ports, existing custom names are preserved for ports that still exist.

- **Visual Indicator** - Ports with custom names display a blue border and "custom" badge for easy identification.

- **ARM Compatibility** - Custom names are automatically sanitized for ARM template compatibility (special characters converted to underscores).

---

## [0.12.6] - 2026-02-05

### Fixed

#### Missing Section Navigation and Scroll Offset Issues

- **Fixed Incorrect Step ID Mappings** - Corrected the `missingSectionToStep` navigation mapping where clicking on incomplete sections in the progress bar was navigating to wrong wizard steps:
  - Identity/Active Directory sections now correctly navigate to step-13 (was incorrectly pointing to step-11)
  - Security Configuration now navigates to step-13-5 (was incorrectly pointing to step-12)
  - SDN sections now navigate to step-14 (was incorrectly pointing to step-13)
  - Infrastructure VLAN now navigates to step-11 (was incorrectly pointing to step-10)
  - Infrastructure CIDR/IP Pool now navigate to step-12 (was incorrectly pointing to step-10)
  - Storage Pool Configuration now navigates to step-5-5 (was incorrectly pointing to step-6)
  - Default Gateway now navigates to step-12 (was incorrectly pointing to step-10)
  - Added missing mappings for SDN Enabled/Disabled and SDN Features

- **Fixed Section Hidden Behind Sticky Headers** - Added `scroll-margin-top: 140px` to `.step` elements to prevent wizard sections from being hidden behind the fixed navigation bar (56px) and sticky breadcrumb/progress bar (~80px) when navigating via the incomplete sections list.

- **Fixed Duplicate "Nodes" Entry** - Fixed an issue where "Nodes" appeared twice in the incomplete sections list when the node count wasn't selected. The duplicate check was removed from `getReportReadiness()` since it's already handled by `getNodeSettingsReadiness()`.

- **Fixed "Start Over" Reset Issues** - Comprehensively fixed the `resetAll()` function to properly reset the entire wizard:
  - Added missing state property resets (witnessType, privateEndpoints, portConfig, nodeSettings, securityConfiguration, securitySettings, sdnEnabled, rackAware properties, torSwitchCount, storagePoolConfiguration, adapterMapping, etc.)
  - Added scroll to top of page after reset so wizard starts at Step 1
  - Added removal of `.selected` class from all option cards
  - Added clearing of localStorage saved state
  - Added reset of Private Endpoints and SDN Features checkboxes
  - Added toast notification to confirm reset

---

## [0.12.5] - 2026-02-04

### Added

#### Private Path Feature Preview Disclaimer

- **Coming Soon Badge** - Added "Coming Soon" disclaimer badge to the Private Path (ExpressRoute/VPN) option in the wizard's Outbound Connectivity step, indicating the feature is not yet available.
- **Preview Banner** - Added a preview banner to the Private Path section in the Outbound Connectivity Guide documentation, clarifying that Private Path is an upcoming feature provided for planning purposes.
- **Easy Removal** - All preview disclaimers are marked with `PRIVATE-PATH-PREVIEW` comments and `.private-path-preview` CSS class for easy removal when the feature becomes generally available.

---

## [0.12.4] - 2026-02-04

### Fixed

#### Step Progress Visibility While Scrolling (Issue #32)

- **Sticky Breadcrumb Navigation** - Fixed the step progress breadcrumb (Type, Cloud, Region, Scale, etc.) getting hidden under the top navigation bar when scrolling. The breadcrumb now sticks to position just below the fixed navigation bar, remaining visible at all times while scrolling through the wizard.

---

## [0.12.3] - 2026-02-04

### Added

#### Single ToR Switch Tooltip (Issue #31)

- **Single ToR Disabled Info Box** - Added a visible info-box message explaining why Single ToR Switch is unavailable for Hyperconverged clusters with 4 or more nodes. The message explains that Dual ToR switches are required for larger cluster deployments to provide necessary redundancy and bandwidth.

---

## [0.12.2] - 2026-02-04

### Fixed

#### AD-Less Option Initial State (Issue #30)

- **AD-Less Disabled on Fresh Start** - Fixed an issue where the Azure KeyVault for Identity (AD-Less) option was incorrectly enabled when starting a fresh wizard. The AD-Less option now correctly remains greyed out until the Infrastructure IP configuration step is completed.

---

## [0.12.1] - 2026-02-04

### Added

#### Arc Private Link Endpoint Visibility (Issue #29)

- **Arc Private Link Unsupported Notice** - Added Arc Private Link Endpoint to the Private Endpoints selection list as a disabled, non-selectable option with clear "Not supported for Azure Local" messaging. This helps users understand that Arc Private Link is not a valid option for Azure Local deployments.

- **Visual Distinction** - The unsupported option uses a red background styling to clearly differentiate it from selectable options.

### Fixed

- **Azure Container Registry Warning Style** - Updated the ACR warning note to use consistent warning styling (yellow/orange) matching Key Vault and other warning messages.

---

## [0.12.0] - 2026-02-04

### Added

#### ODIN Sizer Tool (Issue #27)

- **Comprehensive Workload Scenario Sizing** - New dedicated Sizer tool at `/sizer/index.html` for calculating Azure Local cluster hardware requirements based on workload scenarios.

- **Workload Scenario Concept** - Create scenarios with multiple workloads to model your infrastructure needs. Each scenario calculates total and per-node requirements.

- **Azure Local VMs Workload** - Add virtual machine workloads with configurable vCPUs, memory, storage, and VM count. Supports both general-purpose and specialized VM configurations.

- **AKS Arc Clusters Workload** - Size Kubernetes clusters with control plane and worker node specifications. Supports multiple clusters per scenario with HA or non-HA control plane options.

- **Azure Virtual Desktop Workload** - AVD workload sizing with three user profiles:
  - Light: Task workers (0.5 vCPU, 2 GB RAM, 20 GB storage per user)
  - Medium: Knowledge workers (1 vCPU, 4 GB RAM, 40 GB storage per user)
  - Power: Power users (2 vCPU, 8 GB RAM, 80 GB storage per user)

- **N+1 Capacity Reservation** - Automatic calculation of maintenance capacity, ensuring workloads can survive a single node failure.

- **Storage Resiliency Options** - Support for three storage resiliency configurations:
  - Two-way mirror (2x raw storage requirement)
  - Three-way mirror (3x raw storage requirement)
  - Dual parity (~1.5x raw storage requirement)

- **Per-Node Requirements** - Clear breakdown of physical core, memory, and storage requirements per cluster node.

- **Capacity Utilization Visualization** - Visual progress bars showing compute, memory, and storage utilization percentages.

- **Sizing Notes & Recommendations** - Dynamic guidance based on workload configuration including high memory warnings and vCPU overcommit ratios.

- **Firebase Analytics Integration** - Sizer page includes analytics tracking for page views, consistent with other ODIN pages.

---

## [0.11.0] - 2026-02-04

### Added

#### Tab Navigation System (Issue #24)

- **Top Navigation Bar** - New fixed navigation bar at the top of the page with ODIN branding and tab buttons for Designer, Knowledge, and Sizer sections.

- **ODIN Designer Tab** - The existing wizard functionality is now accessible via the Designer tab, which is the default active view.

- **ODIN Knowledge Tab** - Quick access to the documentation section, linking to the Outbound Connectivity Guide and future knowledge base articles.

- **ODIN Sizer Tab** - Placeholder for the upcoming cluster sizing tool with "Coming Soon" badge. Will help calculate Azure Local cluster sizing based on workload requirements.

- **Consistent Navigation Across Pages** - Both the main index.html and docs pages now share the same navigation pattern, making ODIN feel like a cohesive single-site application.

- **Session Persistence** - Active tab state is saved to session storage, so users return to their last viewed tab when navigating back.

### Changed

#### Documentation Page Updates

- **Docs Navigation Consistency** - The `/docs/outbound-connectivity/` page now includes the same top navigation bar as the main site.

- **Sidebar Repositioned** - Documentation sidebar now starts below the fixed top nav for proper layout.

- **Mobile Responsive** - Tab navigation adapts gracefully to smaller screens with condensed styling.

---

## [0.10.12] - 2026-02-03

### Added

#### Outbound Connectivity Documentation Integration

- **Outbound Connectivity Guide** - Integrated comprehensive outbound connectivity documentation into the wizard at `docs/outbound-connectivity/`. Includes detailed architecture comparisons for Public Path vs Private Path (ExpressRoute) scenarios.

- **Private Endpoints Selection Step** - New wizard step allowing users to select which Azure services will use Private Link endpoints (Key Vault, Storage, ACR, ASR, Backup, SQL MI, Defender).

- **Dynamic Connectivity Diagrams** - Configuration Report now displays the appropriate architecture diagram based on outbound path, Arc Gateway, and proxy selections (5 different scenarios supported).

- **Download SVG Buttons** - Added download buttons below connectivity diagrams in the Configuration Report for easy export.

### Changed

#### ExpressRoute Auto-Selection

- **Required Components for Private Path** - When users select "Private Path (ExpressRoute)", Arc Gateway and Proxy are now automatically enabled and marked as "Required" since both are mandatory for private connectivity.

#### Private Endpoints Configuration Report

- **Detailed PE Information** - Configuration Report now shows considerations and documentation links for each selected Private Endpoint service.

- **Proxy Bypass Examples** - Updated to use specific FQDN placeholders (e.g., `<your-keyvault-name>.vault.azure.net`) instead of wildcards for accurate proxy bypass configuration.

- **Conditional Bypass Display** - Proxy bypass information only shown when Arc Gateway OR Proxy is enabled (not shown for "No Proxy, No Arc Gateway" scenario).

#### Updated Comparison Modals

- **Outbound Connectivity Comparison** - Updated to accurately reflect Public Path (4 options) vs Private Path (ExpressRoute) with correct pros, cons, and use cases.

- **Arc Gateway Comparison** - Updated to emphasize that Arc Gateway reduces firewall rules from hundreds to fewer than 30 endpoints.

---

## [0.10.11] - 2026-01-28

### Fixed

#### Switchless Storage IPs by Adapter

- **ARM Template Alignment** - Switchless storage adapter IPs now display grouped by SMB adapter name (SMB1, SMB2, SMB3, etc.) matching the exact structure used in ARM template generation.

- **Node-to-IP Mapping** - Each adapter shows which node gets which IP address, consistent with the generated ARM parameters file.

- **Full Node Count Support** - Proper subnet-to-adapter mapping for 2-node, 3-node, and 4-node switchless configurations with correct host octet assignment (.2 for lower node, .3 for higher node).

---

## [0.10.10] - 2026-01-28

### Fixed

#### Switchless Storage Adapter IPs

- **Switchless Storage Support** - Configuration Report now displays storage adapter IPs for switchless storage configurations when Auto IP is disabled. Each subnet shows its two assigned IPs (one per connected node in the pair).

- **Both Storage Types Covered** - Storage adapter IP display now works correctly for both switched (SMB1/SMB2 per node) and switchless (per-subnet pair) configurations.

---

## [0.10.9] - 2026-01-28

### Fixed

#### Auto IP Storage Display Correction

- **Subnet-Only Display for Auto IP** - When Storage Auto IP is enabled, the Configuration Report now correctly shows only the subnet (10.71.0.0/16) instead of calculated IP addresses. This reflects the reality that Network ATC assigns IPs automatically and the actual addresses are not known until deployment.

- **Custom Subnets Unchanged** - When Storage Auto IP is disabled, the report continues to display calculated storage adapter IP addresses for each node, as these are user-defined values that will be used in the ARM template.

---

## [0.10.8] - 2026-01-28

### Fixed

#### Storage Adapter IPs for Auto IP Enabled

- **Storage Adapter IPs When Auto IP Enabled** - Configuration Report now displays default Network ATC storage adapter IP addresses when Storage Auto IP is enabled:
  - SMB1 uses 10.71.1.0/24 subnet with node IPs starting at 10.71.1.1
  - SMB2 uses 10.71.2.0/24 subnet with node IPs starting at 10.71.2.1
  - Each node is assigned sequential IPs within each subnet

- **Improved Node IP Display** - Made the node infrastructure IP display more robust with proper fallback to default node names when custom names are not set.

- **Both Auto IP Scenarios Covered** - Storage adapter IPs now display for both Auto IP enabled (default Network ATC) and Auto IP disabled (custom subnets) configurations.

---

## [0.10.7] - 2026-01-28

### Fixed

#### IP Address Display in Configuration Report (Issue #11)

- **Node Infrastructure IPs** - The Configuration Report now displays each node's name and assigned IP address in the Infrastructure Network section. This provides visibility into the exact IPs that will be used in the ARM template deployment.

- **Storage Adapter IPs** - When Storage Auto IP is disabled, the report now calculates and displays the storage adapter IP addresses for each node:
  - Shows IPs per storage subnet (e.g., SMB1 and SMB2 for switched storage)
  - Displays node name with corresponding IP address
  - IPs are calculated using the same logic as ARM template generation (subnet prefix + node index + 2)

- **ARM Template Alignment** - The Configuration Report now shows the exact IP addresses that will be populated in the ARM parameters file, helping users validate their network configuration before deployment.

---

## [0.10.6] - 2026-01-28

### Fixed

#### Storage Intent Subnet Display (Issue #9)

- **Storage Subnets in Configuration Report** - The Configuration Report now displays storage intent subnet information in the Host Networking section:
  - When Storage Auto IP is **enabled**: Shows "Default Network ATC (10.71.0.0/16)" to indicate the automatic subnet assignment
  - When Storage Auto IP is **disabled**: Displays all user-defined custom storage subnets that were configured in the wizard

- **Complete Storage Configuration Visibility** - Users can now see their complete storage network configuration in the generated report, including:
  - Switched storage: 2 storage subnets
  - Switchless 2-node: 2 storage subnets
  - Switchless 3-node: 6 storage subnets
  - Switchless 4-node: 12 storage subnets

---

## [0.10.5] - 2026-01-28

### Fixed

#### Configuration Report Security Details (Issue #7)

- **Security Configuration Details Display** - Fixed a bug where the Configuration Report only showed a summary for customized security configurations instead of displaying all the individual security settings.
  - WDAC (Windows Defender Application Control) status now displays correctly
  - Credential Guard enforcement status now displays correctly
  - Drift Control enforcement status now displays correctly
  - SMB Signing enforcement status now displays correctly
  - SMB Cluster Encryption status now displays correctly
  - BitLocker Boot Volume status now displays correctly
  - BitLocker Data Volumes status now displays correctly

- **Property Name Alignment** - Corrected mismatched property names between the wizard state object and the report generation logic:
  - `wdac` → `wdacEnforced`
  - `credentialGuard` → `credentialGuardEnforced`
  - `driftControl` → `driftControlEnforced`
  - `smbSigning` → `smbSigningEnforced`
  - `smbEncryption` → `smbClusterEncryption`
  - `bitlocker` → `bitlockerBootVolume` and `bitlockerDataVolumes`

---

## [0.10.4] - 2026-01-22

### Fixed

#### Single-Node Storage Intent Support (Issue #100)

- **Storage Intent for Single-Node Clusters** - Fixed a bug where single-node (1-node) Hyperconverged and Hyperconverged Low Capacity deployments with 4 ports could not select storage intent ports. Single-node clusters now have access to the same intent options as multi-node clusters:
  - All Traffic, Mgmt + Compute, Compute + Storage, and Custom intents are now available
  - Storage zones appear in the adapter mapping UI for all intent types
  - Single-node uses implicit "switched" storage connectivity

- **RDMA Requirements for Single-Node** - Updated RDMA port requirements:
  - **Hyperconverged (non-low-capacity)**: Requires 2 RDMA-enabled ports for storage intent (same as multi-node)
  - **Hyperconverged Low Capacity**: RDMA remains optional (no minimum requirement)
  - Default port configuration now enables RDMA for non-low-capacity single-node deployments

- **Updated Default Port Settings for Single-Node**:
  - Non-low-capacity: 10GbE with RoCEv2 RDMA enabled by default
  - Low Capacity: 10GbE with RDMA disabled by default

---

## [0.10.3] - 2026-01-20

### Added

#### Auto-Populate Storage Subnets (Issue #95)

- **Storage Subnet Auto-Population** - When Storage Auto IP is disabled (for Switched or Switchless scenarios), entering the first storage subnet now automatically populates the remaining subnet fields by incrementing the 3rd octet of the IP address:
  - Example: Entering `10.0.1.0/24` for Storage Subnet 1 will auto-fill:
    - Storage Subnet 2: `10.0.2.0/24`
    - Storage Subnet 3: `10.0.3.0/24`
    - And so on for all required subnets
  - Only empty subnet fields are auto-populated (existing values are preserved)
  - Works for all storage configurations: Switched (2 subnets), Switchless 2-node (2 subnets), 3-node (6 subnets), and 4-node (12 subnets)

---

## [0.10.2] - 2026-01-20

### Changed

#### SDN Configuration Step Redesign (Step 18)

- **SDN Enabled/Disabled Selection** - Step 18 (Software Defined Networking) now starts with a clear Yes/No selection asking whether to enable SDN:
  - **Enable SDN**: Shows the SDN feature selection cards (LNET, NSG, VNET, SLB) and management options
  - **No SDN**: Skips SDN configuration and completes the wizard without SDN features

- **Improved SDN Import Flow** - When importing ARM templates with SDN settings selected in the import dialog, the SDN enabled/disabled selection and feature checkboxes are now properly restored in the wizard.

- **Updated Validation Logic** - Step 18 validation now requires:
  1. User must select "Enable SDN" or "No SDN", AND
  2. If "Enable SDN" is selected, at least one feature and a management type must be chosen

This change provides a clearer user experience since SDN is optional and is not reflected in ARM templates.

---

## [0.10.1] - 2026-01-19

### Fixed

#### ARM Template Import Options Dialog (Issue #90)

- **ARM Import Options Dialog** - When importing an ARM template, users are now prompted with a dialog to specify settings that are not included in ARM templates:
  - **Arc Gateway**: Whether the deployment uses Arc Gateway for secure connectivity
  - **Enterprise Proxy**: Whether the deployment routes traffic through an enterprise proxy
  - **SDN Configuration**: Whether SDN is enabled, and if so, whether it's Arc-managed (with LNets/NSGs only or full VNets/SLBs) or legacy WAC-managed

This ensures that when users import a previously exported ARM template, these important deployment options are not lost and can be specified before the import completes.

---

## [0.10.0] - 2026-01-19

### Fixed

#### ARM Parameters Pre-Population (Issue #85, #86)

- **OU Path Auto-Population** - The OU Path field on the ARM Parameters page is now automatically pre-populated with the value entered during the wizard. If the OU Path was already provided, the input field is hidden since re-entry is not necessary. This eliminates redundant data entry for users. (Issue #85)

- **Cluster Name and HCI Resource Provider Object ID Loading** - When loading the ARM Parameters page, the Cluster Name and HCI Resource Provider Object ID fields are now properly pre-populated from the parameters payload. Previously, these values were not being loaded into the input fields even when they were present in the generated parameters. (Issue #86)

- **Additional Field Pre-Population** - Extended pre-population to include Tenant ID, Key Vault Name, Diagnostic Storage Account, Witness Storage Account, and Custom Location Name when these values are already present in the payload.

- **Copy JSON Now Copies Updated Parameters** - Fixed an issue where the "Copy JSON" button would copy the original JSON with placeholders instead of the updated JSON after the user fills in the input fields. Now both "Copy JSON" and "Copy Parameters & Scroll to JSON" buttons correctly copy the current (updated) parameters.

- **Storage Network VLAN ID Type Fix** - Fixed Azure ARM template validation error where `storageNetworks[].vlanId` was being output as an integer instead of a string. Azure requires this field to be a string type. This caused "Expected type string but found type integer" errors when validating the deployment in Azure Portal.

---

## [0.9.9] - 2026-01-14

### Added

#### ARM Placeholder Input Enhancement

- **Complete Placeholder Form** - Users can now input all ARM template placeholder values directly on the ARM parameters page (Section A2). The form allows filling in:
  - **Azure Context**: Tenant ID, Subscription ID, Resource Group Name, Deployment Name
  - **Cluster Configuration**: Cluster Name, Custom Location Name, Cloud Witness Storage Account, OU Path
  - **Azure Resources**: Key Vault Name, Diagnostic Storage Account, HCI Resource Provider Object ID

- **Real-time Parameter Updates** - As users enter values in the placeholder form, the parameters JSON displayed below updates instantly, replacing the REPLACE_WITH_* placeholders with actual values.

- **Update Parameters Button** - Added a prominent button to manually trigger parameter updates with visual feedback showing when parameters were last updated.

- **Conditional Field Display** - OU Path field is hidden for AD-less (Local_Identity) deployments; Cloud Witness Storage field only shows when applicable.

- **Arc Node Resource IDs Auto-Population** - The `arcNodeResourceIds` parameter now automatically uses:
  - Actual node names from the wizard's Node Settings (Step 11)
  - Subscription ID and Resource Group from the Azure Context inputs
  - No manual input required - values are populated automatically when the user enters subscription and resource group

---

## [0.9.8] - 2026-01-14

### Fixed

#### Required Badge Styling (Issue #76)

- **Badge-Style Labels** - Changed the "Required" indicators for Cloud Witness and Storage Switched options (in Rack Aware scenarios) to use the same badge styling as "Recommended" badges. The labels now appear as blue pill-shaped badges in the top-right corner of the option cards, matching the UI consistency of other badges.

---

## [0.9.7] - 2026-01-14

### Added

#### Deploy to Azure UX Enhancement

- **Step-by-Step Instructions** - Added a detailed instruction box in the Deploy to Azure section (Step A3) explaining how to copy and paste parameters to Azure Portal:
  1. Click "Deploy to Azure" to open Azure Portal with the ARM template
  2. Use the new "Copy Parameters & Scroll to JSON" button
  3. In Azure Portal, click "Edit parameters"
  4. Paste the copied JSON and save
  5. Replace any remaining REPLACE_WITH_ placeholders

- **Copy Parameters Button** - Added a convenient "Copy Parameters & Scroll to JSON" button that:
  - Copies the entire parameters JSON to clipboard
  - Scrolls the page to the JSON section
  - Highlights the JSON viewer to confirm the copy
  - Shows visual feedback on successful copy

- **Updated Confirmation Dialog** - The Deploy to Azure confirmation now includes numbered steps for the copy/paste workflow

---

## [0.9.6] - 2026-01-14

### Fixed

#### Deploy to Azure Button (Issue #73)

- **Clarified Deploy to Azure Behavior** - The Azure Portal's template deployment blade does NOT support pre-filling parameters via URL. Updated the Deploy to Azure functionality to:
  - Remove the non-working `/~/` parameter passing that was added in v0.9.3
  - Update the confirmation dialog to clearly instruct users to copy parameter values from the ARM Parameters section (Step A5)
  - Provide clearer instructions about manually entering values in the Azure Portal

#### Template Import Default (Issue #74)

- **Fixed Default Scale on ARM Import** - When importing an ARM template, the wizard now defaults to **Hyperconverged** (medium) instead of Low Capacity, regardless of node count. Users who want Low Capacity must explicitly select it after import.

---

## [0.9.5] - 2026-01-14

### Added

#### Azure Region Ordering (Issue #70)

- **Alphabetized Commercial Regions** - Azure commercial regions are now displayed in alphabetical order for easier navigation:
  - Australia East, Canada Central, East US, India Central, Japan East, South Central US, Southeast Asia, West Europe
  - US Gov Virginia remains at the end as a government cloud option

#### Documentation Links (Issue #69)

- **Low Capacity Info Link** - Added "Learn more" link to the Hyperconverged Low Capacity option pointing to system requirements documentation
- **Rack Aware Info Link** - Added "Learn more" link to the Rack Aware option pointing to rack-aware cluster overview documentation

#### Knowledge Links (Issue #71)

- **Cloud Witness Knowledge Link** - Added info icon (ℹ️) to Cloud Witness step header linking to quorum witness deployment documentation
- **Network Traffic Intents Knowledge Link** - Added info icon (ℹ️) to Network Traffic Intents step header linking to network considerations documentation

---

## [0.9.4] - 2026-01-14

### Fixed

#### Adapter Mapping Configuration (Issue #67)

- **Fixed Custom Adapter Mapping in ARM Output** - When users customize the adapter mapping (e.g., assigning Ports 2 and 4 to Storage instead of the default Ports 3 and 4), the ARM parameters output now correctly reflects the user's selection:
  - Storage intent adapters now use the actual port numbers (e.g., `SMB2`, `SMB4`) instead of always defaulting to `SMB3`, `SMB4`
  - Management + Compute intent adapters now correctly map to user-selected ports (e.g., `NIC1`, `NIC3`)
- **Fixed Diagram Labels** - The network topology diagram now displays adapter labels matching the confirmed adapter mapping
- **Consistent Behavior Across All Intent Types** - The fix applies to all intent types (`mgmt_compute`, `compute_storage`, `all_traffic`, `custom`) when adapter mapping is confirmed

---

## [0.9.3] - 2026-01-13

### Fixed

#### DNS Server Display (Issue #64)

- **Fixed DNS Server Display After Import** - DNS servers now properly render in the UI after:
  - ARM template import (dnsServers array parsed from ARM parameters)
  - Odin configuration file import
  - Session resume from localStorage
- **Root Cause**: The `renderDnsServers()` function was not being called after `updateUI()` in import/resume handlers, leaving the DNS servers container empty even though `state.dnsServers` was populated

#### Deploy to Azure Enhancement (Issue #65)

- **Pre-filled Parameters in Azure Portal** - The "Deploy to Azure" button now passes configured parameters directly to the Azure Portal URL:
  - `domainFqdn` - Active Directory domain FQDN
  - `adouPath` - Active Directory OU path
  - `dnsServers` - DNS server IP addresses
  - `arcNodeResourceIds` - Arc node resource IDs (if not placeholders)
  - `location` - Azure region
  - `witnessType` - Cluster witness type
  - `networkingPattern` - Network intent pattern
  - `subnetMask`, `startingIPAddress`, `endingIPAddress`, `defaultGateway` - IP configuration
  - `securityLevel`, `configurationMode` - Security and storage settings
- **Improved User Experience**: Users no longer need to manually copy/paste all parameters - key values are automatically pre-filled when redirected to Azure Portal

---

## [0.9.2] - 2026-01-13

### Fixed

#### Template Loading Fixes (Issue #59)

- **Fixed Template Loading Order** - Corrected the order of `selectOption` calls when loading templates so that storage is set before ports, preventing ports from being reset
- **Fixed Missing Sections Navigation** - Updated the `missingSectionToStep` mapping so clicking on missing sections (like "Ports") correctly scrolls to the right step:
  - Ports now correctly links to step-5 (Network Adapter Ports)
  - Azure Cloud links to step-cloud
  - Azure Local Instance Region links to step-local-region  
  - Scale links to step-2
  - Nodes links to step-3
  - Storage Connectivity links to step-4
  - Traffic Intent links to step-6
  - Outbound Connectivity links to step-7
  - Arc Gateway links to step-8
  - Proxy links to step-9

---

## [0.9.1] - 2026-01-13

### Changed

#### UI Improvements

- **Page Statistics Repositioned** - Moved the Page Statistics box (Page Views, Designs Generated, ARM Deployments) from above the disclaimer to below the header description paragraph for better visual flow
- **Renamed Statistics Label** - Changed "Documents Generated" to "Designs Generated" for clarity
- **Reduced Header Spacing** - Tightened the spacing below the header section from 4rem to 2.5rem for a more compact layout

---

## [0.9.0] - 2026-01-13

### Added

#### Missing Sections Display (Issue #55)

- **Dynamic Missing Sections Display** - Added a prominent red-bordered container above the Generate buttons that shows which configuration sections are incomplete:
  - Displays clickable anchor links for each missing section
  - Updates dynamically as users complete fields
  - Provides instant visibility into what's needed before generating outputs

- **Navigation to Missing Sections** - Clicking on any missing section link:
  - Smoothly scrolls to the relevant wizard step
  - Highlights the target step with a brief animation
  - Works with partial matches for flexible navigation

- **Complete Example Templates** - Fixed all 5 example templates to be 100% complete with all required fields:
  - **Small AD-Joined Cluster**: 2-node, switchless, Azure AD with full network config
  - **Medium Switched Cluster**: 4-node, switched storage, compute+storage intent
  - **Large Enterprise Cluster**: 8-node, switched, all traffic intent, full security
  - **Single Node (Dev/Test)**: 1-node, local identity, minimal configuration
  - **Rack-Aware Multi-Rack**: 4-node across 2 fault domains, full rack-aware settings

#### Import ARM Templates from Azure Portal (Issue #56)

- **ARM Template Import** - Extended the Import Configuration feature to accept Azure ARM templates exported from the Azure Portal:
  - Auto-detects ARM templates by checking the `$schema` property
  - Supports both ARM template files and parameters files
  - Shows informative toast message when ARM format is detected

- **Comprehensive Parameter Mapping** - Maps ARM template parameters to Odin wizard state:
  - `physicalNodesSettings` → Node names and IP addresses
  - `domainFqdn` → Active Directory domain
  - `dnsServers` → DNS server configuration
  - `subnetMask`, `startingIPAddress`, `endingIPAddress` → Network ranges
  - `networkingType` → Storage switched/switchless
  - `networkingPattern` → Traffic intent configuration
  - Security settings: driftControl, credentialGuard, SMB signing, BitLocker, WDAC

- **Graceful Import** - After importing an ARM template:
  - Prompts user to review and complete any missing fields
  - Preserves existing Odin export/import functionality
  - Provides clear error messages for invalid files

---

## [0.8.2] - 2025-12-19

### Fixed

#### Bug Fixes

- **Custom Storage Subnets in Diagrams (Issue #50)** - Fixed the switchless storage diagram legends to display custom storage subnet CIDRs when Storage Auto IP is disabled:
  - Legend now shows actual custom subnet values instead of conceptual/example CIDRs
  - Legend title changes from "Storage subnets (conceptual)" to "Storage subnets (custom)" when using custom subnets
  - Applied to all switchless diagram variants (2-node, 3-node single-link, 3-node dual-link, 4-node)

- **RDMA Hardware Requirement Tooltip** - Clarified that the RDMA port requirement applies to multi-node clusters, not single-node deployments

- **Code Cleanup** - Simplified redundant null/undefined checks per Copilot review

### Added

- **MLAG Peer Links in Diagram** - Added visual representation of MLAG connectivity between ToR switches in the Storage Switched diagram when dual ToR configuration is used

---

## [0.8.1] - 2025-12-19

### Fixed

#### Bug Fixes (Issue #48)

- **Compare Options Popup** - Fixed styling issues with the Compare Options modal:
  - Added `max-height: 90vh` with scrolling support so content fits within the viewport
  - Made the close button (X) visible with proper styling and hover effect
  - Added sticky header so title and close button remain visible while scrolling

- **ToR Switch Logic** - Fixed the conditional logic for Single/Dual ToR switch availability:
  - Hyperconverged clusters with 1-3 nodes can now correctly choose Single or Dual ToR
  - Hyperconverged clusters with 4+ nodes correctly restrict to Dual ToR only (Single is greyed out)
  - Fixed incorrect scale value check (was using wrong value for Hyperconverged detection)

---

## [0.8.0] - 2025-12-19

### Added

#### ToR Switch Selection (Issue #47)

- **ToR Switch Options** - Added "Single ToR Switch" and "Dual ToR Switches" selection options for Storage Switched scenarios with Hyperconverged or Low Capacity clusters:
  - **Hyperconverged (4+ nodes)**: Only Dual ToR is available (Single ToR is disabled)
  - **Hyperconverged (1-3 nodes)**: Both Single and Dual ToR options available, defaulting to Dual
  - **Low Capacity**: Both Single and Dual ToR options available

- **Improved Storage Switched Diagram** - Completely redesigned the network diagram for Storage Switched scenarios:
  - **ToR Switch Visualization**: Shows ToR switches at the top of the diagram (1 or 2 based on selection)
  - **Horizontal Adapter Layout**: All network adapters are now displayed horizontally within each node box for better visual clarity
  - **Uplink Connections**: Dashed lines show the uplink paths from adapters to ToR switches (odd NICs to ToR 1, even NICs to ToR 2 for dual configurations)
  - **Simplified View**: Shows maximum 2 nodes regardless of cluster size, with a badge indicating additional nodes

### Changed

- **Storage Connectivity Labels** - Renamed storage connectivity options from "Switched"/"Switchless" to "Storage Switched"/"Storage Switchless" for clarity

---

## [0.7.0] - 2025-12-19

### Added

#### Deploy to Azure Button (Issue #45)

- **One-Click Azure Deployment** - Added a prominent "Deploy to Azure" button on the ARM Parameters page that redirects users to the Azure Portal with the appropriate ARM template pre-loaded based on their configuration:
  - Commercial Azure deployments use `portal.azure.com`
  - Azure Government deployments use `portal.azure.us`

- **Template Auto-Selection** - The button automatically selects the correct ARM quickstart template based on the scenario configured in the wizard (standard cluster, rack-aware, AD-less, US Gov, etc.).

- **Collapsible Template Reference** - The list of all available ARM templates is now in a collapsible section to reduce clutter and highlight the Deploy button.

#### Node Name Auto-Population

- **Smart Node Naming** - When entering a name in the "Node 1 Name" field with a numeric suffix (e.g., `server01` or `customname1`), the remaining node name fields are automatically populated with sequential names:
  - `server01` → `server02`, `server03`, `server04`...
  - `node5` → `node6`, `node7`, `node8`...
  - `myhost` → `myhost2`, `myhost3`, `myhost4`...

- **Padding Preservation** - Number padding is preserved (e.g., `host001` → `host002`, `host003`).

- **SAM Account Name Validation** - Validates the maximum 15-character limit for Active Directory computer account names (SAM Account name).

- **Non-Destructive** - Only fills empty node name fields; never overwrites user-provided values.

#### DCB QoS Overrides for Storage Intents (Issue #44)

- **QoS Policy Customization** - Added new override options in the Network Traffic Intents section for storage intents that allow customization of Data Center Bridging (DCB) QoS policies:
  - **Storage Priority**: Choose between priority 3 (default) or 4 for SMB traffic
  - **System/Cluster Priority**: Choose between priority 7 (default), 5, or 6 for cluster heartbeat traffic
  - **Bandwidth Reservation**: Set the percentage of bandwidth reserved for storage traffic (40-70%, default 50%)

- **ARM Template Support** - When QoS overrides are configured, the ARM template includes `overrideQosPolicy: true` and a `qosPolicyOverrides` object with the custom settings.

#### Proxy Bypass String Generation (Issue #43)

- **Automatic Bypass String** - When proxy is enabled in the cluster configuration, the report now displays a ready-to-use proxy bypass string that includes:
  - `localhost` and `127.0.0.1`
  - All cluster node hostnames
  - All cluster node IP addresses
  - Domain wildcard (e.g., `*.contoso.local`)
  - Infrastructure subnet wildcard (e.g., `192.168.1.*` for 192.168.1.0/24)

- **CIDR to Wildcard Conversion** - Added helper function to convert CIDR notation to proxy bypass wildcard format.

#### Custom Storage Subnets (Issue #42)

- **Custom Subnet Input** - When Storage Auto IP is disabled, users can now specify custom storage subnet CIDRs instead of using the default 10.0.x.0/24 networks. The number of subnets required depends on the storage configuration:
  - 2-node switchless: 2 subnets
  - 3-node switchless: 6 subnets
  - 4-node switchless: 12 subnets
  - Switched storage with Auto IP disabled: 2 subnets

- **Dynamic UI** - Subnet input fields are automatically shown/hidden based on storage configuration and Auto IP setting.

- **ARM Template Integration** - Custom subnets are applied to the `storageNetworkList` in the ARM template with proper IP address and subnet mask calculations.

---

## [0.6.2] - 2025-12-18

### Fixed

#### iOS Mobile Layout Fixes

- **Fixed Configuration Summary Blocking Page** - The Configuration Summary panel was blocking the entire page on iOS and mobile devices due to the fixed 460px width sidebar. Added `!important` CSS overrides to force proper column stacking on mobile.

- **Fixed Header Logo Overlapping Title** - Replaced inline styles in header HTML with proper CSS classes (`.header-title-wrapper`, `.header-logo-wrapper`) that can be properly overridden by media queries. On mobile, the logo now displays above the title instead of overlapping it.

- **Improved Mobile Layout Reliability** - Added stronger CSS specificity with `!important` rules for mobile layout to ensure proper rendering on iOS Safari:
  - `.layout-flex` forces `flex-direction: column`
  - `.steps-column` and `.summary-column` force `width: 100%` and proper ordering
  - `#summary-panel` forces `position: relative` to prevent sticky floating behavior

---

## [0.6.1] - 2025-12-18

### Added

#### Mobile Browser Support (Issue #38)

- **Comprehensive Mobile Responsive Design** - Added full responsive CSS support for mobile and tablet devices:
  - Tablet breakpoint (1024px): Adjusted container padding and preview grid
  - Mobile breakpoint (768px): Reorganized header, breadcrumbs, wizard progress, steps, and modals for mobile screens
  - Small mobile breakpoint (480px): Further optimized compact layouts for very small screens
  - Touch device improvements: Larger touch targets, removed hover effects, added active states

- **Mobile-Optimized Components**:
  - Header and logo scale appropriately on smaller screens
  - Breadcrumb navigation becomes scrollable with compact styling
  - Option cards and step containers adapt to single-column layouts
  - Preview modal becomes full-screen on mobile for better usability
  - Onboarding tutorial optimized for mobile with stacked buttons
  - Report action buttons stack vertically on narrow screens
  - Input fields use 16px font size to prevent iOS zoom on focus
  - Keyboard shortcuts help hidden on mobile (touch devices)

---

## [0.6.0] - 2025-12-18

### Added

#### Visual Feedback Improvements

- **Selected Option Checkmarks** - Option cards now display a blue checkmark (✓) in the top-right corner when selected, providing clear visual feedback of the current selection.

- **Checkmark Animation** - Smooth pop-in animation when checkmarks appear for a polished user experience.

### Changed

#### UI/UX Improvements

- **Renamed Action Buttons** - Export buttons renamed for clarity:
  - "Generate Report" → "📋 Generate Cluster Design Document"
  - "Generate ARM" → "🚀 Generate Cluster ARM Deployment Files"

- **Removed PDF Export** - Removed the PDF export button as it was not providing value.

- **8 Ports Tooltip** - Updated tooltip from "Maximum Density" to "Maximum resiliency and performance" for accuracy.

### Fixed

#### Step Indicator Validation

- **Step Indicators** - Fixed all 19 step indicators to correctly show completion status with proper validation logic.

- **Network Traffic Intents (Step 6)** - Fixed validation to check actual intent state and custom intent confirmation.

- **Management Connectivity (Step 10)** - Fixed validation to require all node IPs when static IP is selected.

- **Infrastructure Network (Step 12)** - Fixed validation to require all fields (CIDR, start IP, end IP, gateway).

- **Active Directory (Step 13)** - Fixed validation to require all mandatory fields based on selected AD option.

#### Stability Improvements

- **Import Configuration Stability** - Fixed browser crash when importing configuration files. Added asynchronous processing, error handling, and loading feedback to prevent UI blocking.

---

## [0.5.4] - 2025-12-18

### Fixed

#### Code Quality Improvements (Copilot Review PR #24)

- **Keyboard Shortcuts Input Detection** - Keyboard shortcuts now check if the user is typing in an input field, textarea, or select element before triggering. Only the Escape key works while typing to allow closing modals.

- **Start Over Confirmation Dialog** - The Alt+S (Start Over) keyboard shortcut now shows a confirmation dialog before resetting all configuration, preventing accidental data loss.

- **Removed Inline Event Handlers** - Replaced inline `onclick` attributes with `addEventListener` in the shortcuts help modal and onboarding tutorial for better separation of concerns and maintainability.

---

## [0.5.3] - 2025-12-18

### Fixed

#### Bug Fixes

- **Issue #23: Multi-Rack Message Visibility** - Fixed issue where the Multi-Rack option note remained visible after changing to another scenario option. The message now properly hides when switching scenarios.

- **Issue #33: Multi-Rack Note with M365 Local** - Fixed issue where the Multi-Rack note remained visible when switching to M365 Local deployment type. The M365 Local handler now explicitly hides the Multi-Rack message.

- **Issue #25: RDMA Dropdown Auto-Disable** - The RDMA dropdown in Intent Overrides (Step 08) now automatically sets to "Disabled" and becomes non-interactive when the NICs in that intent group do not have RDMA enabled in Step 07 Port Configuration.

- **Issue #28: Low Capacity RDMA Enforcement** - For Low Capacity scenarios with Switched storage connectivity, the wizard no longer enforces RDMA ports for storage intent in custom intent mappings. This aligns with the existing behavior where Low Capacity deployments are exempt from minimum RDMA port requirements.

---

## [0.5.2] - 2025-12-18

### Changed

#### Logo and Header Improvements

- **Updated Logo** - New Odin logo with improved design and proper aspect ratio
- **Theme-Aware Logo** - Logo automatically switches between dark and light variants when toggling theme
  - Dark theme: `odin-logo.png`
  - Light theme: `odin-logo-white-background.png`
- **Improved Header Layout** - Restructured header for better visual balance
  - Title now centered independently
  - Logo positioned on the right with version info below
  - Description text with constrained width for better readability
- **Updated Disclaimer** - Revised disclaimer text for clarity
- **Centered Disclaimer Box** - Disclaimer now centered with fit-content width

---

## [0.5.1] - 2025-06-12

### Added

#### Drag & Drop Adapter Mapping

- **Interactive Adapter Mapping UI** - New visual drag-and-drop interface for assigning network adapters to traffic intents
  - Drag adapters between pool and intent zones
  - Click-to-select fallback for accessibility
  - RDMA status shown on adapter pills
  - Real-time validation of assignments

- **Scale-Aware Minimum Adapter Requirements** - Validation rules adapt to deployment scale
  - Standard deployments: Minimum 2 adapters per intent
  - Low Capacity deployments: Minimum 1 adapter per intent
  - RDMA requirement checking for storage intents

- **Intent Zone Cards** - Visual cards for each traffic intent zone
  - Color-coded headers (Management=Blue, Compute=Green, Storage=Purple)
  - Badge indicators for requirements (Required, Optional, RDMA Required)
  - Visual completion state (green border when requirements met)
  - Error state highlighting for RDMA issues

- **Confirm Overrides Button** - Lock mechanism for intent overrides
  - Prevents accidental changes after configuration
  - Edit mode toggle for adjustments
  - Status indicator showing confirmation state

### Changed

- **Intent Override Gate** - Overrides section now gates on adapter mapping confirmation
  - Custom intent flow requires adapter mapping to be confirmed before showing overrides
  - Provides clearer progression through configuration

### Fixed

- **State Reset Consistency** - Adapter mapping state properly resets when changing:
  - Scenario selection
  - Region selection
  - Scale selection
  - Node count selection
  - Port count selection
  - Intent type selection

---

## [0.5.0] - 2025-12-17

### Added

#### Professional UX Enhancements

- **Configuration Preview Modal** - New preview button shows complete configuration summary before generating outputs
  - Organized sections: Deployment, Cluster, Network, Identity & Security
  - Visual status indicator for completion state
  - Direct "Generate Report" action from preview
  - Shows missing configuration items with count

- **Breadcrumb Step Navigation** - Clickable step indicators for quick navigation
  - 8-step progress indicator at top of page
  - Visual completion checkmarks (✓) for finished steps
  - Click to jump directly to any step
  - Sticky positioning for always-visible access

- **Keyboard Shortcuts** - Power-user shortcuts for common actions
  - `Alt+P` - Preview Cluster Configuration
  - `Alt+R` - Generate Report
  - `Alt+E` - Export Configuration
  - `Alt+I` - Import Configuration
  - `Alt+S` - Start Over
  - `Alt+1-8` - Navigate to steps 1-8
  - `Esc` - Close modals
  - `Alt+?` - Show shortcuts help

- **PDF Export** - Export configuration summary as printable PDF
  - Professional layout optimized for printing
  - Includes all configuration sections
  - Shows completion status and missing items
  - Browser print dialog for save as PDF

- **Onboarding Tutorial** - First-time user walkthrough
  - 3-step interactive introduction
  - Feature highlights with icons
  - Progress dots indicator
  - Skip option for returning users
  - Stored preference in localStorage

- **Animated Step Transitions** - Smooth visual feedback
  - Fade-in animation for steps
  - Scale-in for modals
  - Smooth scroll for navigation

### Changed

- **Step Visibility** - Steps now use CSS animations when appearing/hiding
- **Modal Design** - Consistent modal styling across all overlays
- **Button Styling** - New preview button with gradient background

### Technical

- **CSS Additions** - 300+ lines of new styles for:
  - Breadcrumb navigation components
  - Preview modal layout
  - Onboarding overlay cards
  - Keyboard shortcuts display
  - Animation keyframes
- **JavaScript Functions** - New functions added:
  - `navigateToStep()` - Scroll to and highlight step
  - `updateBreadcrumbs()` - Update breadcrumb state
  - `initKeyboardShortcuts()` - Register keyboard handlers
  - `showShortcutsHelp()` - Display shortcuts modal
  - `showConfigurationPreview()` - Render preview modal
  - `exportToPDF()` - Generate print-friendly HTML
  - `showOnboarding()` - Display tutorial overlay
  - `renderOnboardingStep()` - Render tutorial step

---

## [0.4.3] - 2025-06-26

### Fixed

#### Issue #19 - Update Step 04 Cluster Configuration Option Names

- **Renamed Scale Options** - Updated Step 04 option names for clarity:
  - "Low Capacity" → "Hyperconverged Low Capacity"
  - "Standard" → "Hyperconverged"
  - "Rack Aware" → "Hyperconverged Rack Aware"

#### Issue #20 - AD-Less Option Incorrectly Enabled on Page Load

- **Fixed Initial State** - Added `updateUI()` call on DOMContentLoaded to ensure AD cards are properly disabled until infrastructure IP range is configured in Step 15

#### Issue #21 - M365 Local Warning Persists After Selecting Another Option

- **Fixed Message Hiding** - Added code in `selectOption()` to hide the M365 Local documentation message when user selects a different scenario option

---

## [0.4.2] - 2025-12-17

### Added

#### Issue #11 - Odin Branding on Output Pages
- **Report Page Branding** - Added "Odin for Azure Local" branding to report.html header
- **ARM Parameters Branding** - Added "Odin for Azure Local" branding to arm.html header

#### Issue #13 - Print Friendly Option
- **Print Friendly Toggle** - Added "Print Friendly" button to report.html
- **CSS Class Toggle** - Uses CSS class `print-friendly-mode` for robust style switching
- **White Background Mode** - Optimizes report for printing with white backgrounds and black text

#### Issue #14 - Export Filename Prompt
- **Custom Filename Support** - Export configuration now prompts for custom filename
- **Filename Sanitization** - Uses `sanitizeInput()` to prevent unsafe characters
- **User Confirmation** - Shows confirmation dialog if filename was adjusted during sanitization

#### Issue #15 - ARM Parameters Improvements
- **Tenant ID Field** - Added optional Tenant ID input field with GUID validation
- **GUID Pattern Validation** - Validates Tenant ID format (00000000-0000-0000-0000-000000000000)
- **ARM Template Reference Links** - Added links to Azure Quickstart Templates for reference
- **Renamed Identity Options** - Changed labels to "Active Directory Domain Services (AD) for Identity" and "Azure KeyVault for Identity (AD-Less)"

#### Issue #17 - Example Configuration Templates
- **Renamed Button & Modal** - Changed "Load Configuration Template" to "Load Example Configuration Template"
- **Complete Configurations** - All 5 templates now include ALL required wizard settings

### Fixed

#### Issue #12 - Session Restore for SDN Settings
- **SDN Features Restore** - Fixed session restore to properly cache and restore SDN feature checkboxes
- **SDN Management Restore** - SDN management selection is now properly restored from saved state

#### Copilot Code Review Fixes
- **Print Friendly Button Selector** - Added unique ID `print-friendly-btn` for unambiguous selection
- **Print Friendly Style Toggle** - Refactored to use CSS classes instead of inline styles for proper computed style handling
- **Filename Sanitization** - Added user confirmation when filename is modified during sanitization
- **PowerShell Comment Formatting** - Moved Tenant ID explanation to separate line above variable
- **Bash Comment Formatting** - Moved Tenant ID explanation to separate line above variable
- **Tenant ID Validation** - Added GUID pattern validation with visual error feedback

### Changed
- **Template Descriptions** - Updated to be more informative about use cases
- **Deployment Scripts** - Tenant ID is now included with proper comment formatting

### Improved
- **Template Loading** - `loadTemplate()` function handles all configuration properties in logical step order
- **Modal Description** - Updated to indicate templates include all required settings

---

## [0.4.1] - 2025-12-17

### Added
- **Disclaimer Notice** - Added disclaimer informing users that this tool is provided as-is without Microsoft support and is an experimental project to help customers accelerate their Azure Local skills ramp up while helping IT architects validate desired configurations

### Changed
- **Updated Description** - Removed reference to ARM template deployment from the main description text

### Fixed
- **Report Page Title** - Corrected the title on the report page to use "Odin for Azure Local"

---

## [0.4.0] - 2025-12-16

### Added

#### ARM Parameters Page - Deployment Automation
- **Deployment Script Generation** - Generate ready-to-use deployment scripts
  - **PowerShell Deployment Script** - Complete PS1 script with Azure authentication and ARM template deployment
  - **Azure CLI Command Preview** - Bash script with az CLI commands for deployment
  - **Bicep/Terraform Alternatives** - Modal showing IaC conversion options with documentation links
  - **Script Download** - One-click download of generated scripts

- **Parameter Input Fields with Auto-Update** - Editable fields that update parameters in real-time
  - **Subscription ID Field** - Input field for Azure subscription ID
  - **Resource Group Name Field** - Input field for target resource group
  - **Deployment Name Field** - Input field for deployment name
  - **Live JSON Updates** - Parameters JSON updates automatically as fields are populated
  - **Placeholder Replacement** - Automatically replaces REPLACE_WITH_* placeholders

- **Enhanced User Experience**
  - **Validation Notifications** - Shows error messages if required fields are missing
  - **Success Feedback** - Confirmation notifications when scripts are downloaded
  - **Input Guidance** - Helper text showing how to use parameter fields
  - **Section Reorganization** - Clearer section numbering (A1-A6) for better navigation

### Changed
- **ARM Page Section Numbers** - Updated to accommodate new deployment features:
  - A1: Metadata
  - A2: Placeholders (now with input fields)
  - A3: Deployment Script Generation (new)
  - A4: Parameters File Content → A5: Parameters File JSON
  - A5: Integration Features → A6: Integration Features

---

## [0.3.0] - 2025-12-16

### Added

#### User Experience Enhancements
- **Font Size Controls** - Adjust text size for better readability
  - **Increase/Decrease Buttons** - A+ and A- buttons in summary panel
  - **Four Size Options** - Small, Medium, Large, and X-Large
  - **Persistent Preference** - Font size saved to localStorage across sessions
  - **Instant Application** - Changes apply immediately to entire interface

- **Dark/Light Theme Toggle** - Switch between dark and light themes
  - **Theme Button** - Moon/sun icon toggle in summary panel
  - **Complete Theme Support** - All UI elements adapt to selected theme
  - **Persistent Preference** - Theme choice saved across sessions
  - **Smooth Transitions** - Animated theme switching

- **Step Progress Indicators** - Visual feedback on completed steps
  - **Checkmark Indicators** - Green checkmarks appear on completed steps
  - **Real-time Updates** - Indicators update as configuration progresses
  - **Clear Visual Progress** - Easy to see which steps are complete

- **Configuration Templates** - Pre-built templates for common scenarios
  - **5 Ready-to-Use Templates** - Common deployment configurations
    - 2-Node Standard Cluster (small production with cloud witness)
    - 4-Node High Performance (medium cluster with dedicated storage)
    - 8-Node Rack Aware (large rack-aware production cluster)
    - Disconnected - Management Cluster 3-Node (air-gapped with Autonomous Cloud endpoint)
    - Edge 2-Node Switchless (cost-optimized edge deployment)
  - **One-Click Loading** - Apply complete configurations instantly
  - **Template Browser** - Modal dialog with template descriptions and tags
  - **Success Notifications** - Confirmation when template loads

#### Documentation Links
- **Firewall Requirements Link** - Added to Outbound Connectivity section
  - **Direct Documentation** - Links to Microsoft Learn firewall requirements
  - **Required Endpoints Info** - Details on firewall rules and endpoints
  - **Lock Icon** - Visual indicator for security-related documentation

- **M365 Local Documentation Redirect** - Special handling for M365 Local deployment type
  - **Workflow Stop** - Selecting M365 Local stops the wizard flow
  - **Documentation Modal** - Displays informational message with link to M365 Local overview
  - **Direct Link** - Takes users to Microsoft Learn M365 Local on Azure Local documentation
  - **Clean Exit** - Users can close modal and select different deployment type

#### ARM Parameters Integration Features
- **Azure DevOps Pipeline Template** - Generate ready-to-use Azure DevOps YAML pipeline
  - **Validation Stage** - Automatic ARM template validation before deployment
  - **Deployment Stage** - Automated deployment with environment approval gates
  - **Download as File** - Export as azure-pipelines.yml

- **GitHub Actions Workflow** - Export GitHub Actions workflow for CI/CD
  - **Multi-Environment Support** - Separate validation and deployment jobs
  - **Secrets Integration** - Uses GitHub secrets for Azure credentials
  - **Deployment Summary** - Automatic summary in GitHub Actions output
  - **Download as File** - Export as deploy.yml for .github/workflows

- **REST API Documentation** - Information modal for automation capabilities
  - **API Endpoint Details** - Example POST endpoint for parameter generation
  - **Request Examples** - Sample JSON payload for configuration
  - **Feature Overview** - Batch processing, validation, webhook integration
  - **Future Availability** - Planned for future release

### Changed
- **Summary Panel Layout** - Reorganized controls into two rows for better organization
- **Font and Theme Controls** - Grouped together below auto-scroll toggle
- **Tool Rebranding** - Renamed to "Odin for Azure Local"
  - **Norse Mythology** - Named after Odin, the Norse god embodying strategic thinking and wisdom
  - **Acronym** - ODIN: **O**ptimal **D**eployment and **I**nfrastructure **N**avigator
  - **Updated Description** - Enhanced to reflect the tool's purpose as a strategic guide for Azure Local deployments

### Fixed
- **Rack Aware Identity Restriction** - Local Identity option is now disabled for Rack Aware deployments (only Active Directory is supported)

---

## [0.2.1] - 2025-12-15

### Added

#### Active Directory OU Path
- **AD OU Path Field** - New optional field in Active Directory step (Step 16)
  - **Appears with Active Directory** - Shown when "Azure Local with Active Directory" is selected
  - **Format Validation** - Validates OU path syntax (e.g., OU=Cluster1,OU=AzureLocal,DC=contoso,DC=com)
  - **Helpful Tooltip** - Info icon with example and explanation
  - **AD Preparation Tool Link** - Direct link to Microsoft documentation for AD preparation
  - **ARM Template Integration** - Maps to `adouPath` parameter in deployment template
  - **Report Integration** - Displays in Active Directory section of generated report
  - **Real-time Validation** - Immediate feedback if format is invalid

---

## [0.2.0] - 2025-12-15

### Added

#### Auto-Scroll Feature
- **Auto-Scroll Toggle** - New toggle control below Progress bar to enable/disable automatic scrolling
  - **Default Enabled** - Auto-scroll is on by default for smooth wizard flow
  - **1 Second Delay** - Pauses 1 second before scrolling to allow review of selection
  - **Persistent Preference** - Toggle state saved to localStorage across sessions
  - **Smart Scrolling** - Port selection scrolls directly to Port Configuration section instead of next step
- **Improved User Flow** - Automatically advances to next step after making a selection
- **Enhanced Navigation** - Guides users through the wizard naturally without manual scrolling

#### Cloud Witness Type
- **Cloud Witness Type Section** - New step after node count selection (Step 05.5)
  - **Automatic Configuration** - Witness type automatically determined based on cluster configuration
  - **Cloud Witness** - Azure cloud witness for high availability (required for Rack Aware and 2-node clusters)
  - **No Witness** - No witness configuration (default for 3+ node Standard/Low Capacity clusters)
- **Conditional Logic** - Witness type locked based on cluster configuration:
  - Rack Aware clusters → Cloud witness (required)
  - 2-node Standard/Medium clusters → Cloud witness (required)
  - 2-node Low Capacity clusters → Cloud witness (required)
  - All other node counts → No witness (default)
- **ARM Template Integration** - Maps to `witnessType` parameter in deployment template
- **Validation & Progress Tracking** - Witness type included in validation checks and progress tracking
- **Summary Report** - Witness type displayed in configuration summary
- **Visual Feedback** - Disabled cards with tooltips when locked, info box explains requirements

#### Storage Pool Configuration
- **Storage Pool Configuration Section** - Repositioned to Step 15 (after Infrastructure Network, before Active Directory)
  - **Express Mode** - Quick deployment with standard settings (default)
  - **Infra Only** - Infrastructure-only deployment without storage pool
  - **Keep Storage** - Preserve existing storage configuration
- **ARM Template Integration** - Maps to `configurationMode` parameter in deployment template

#### Security Configuration
- **Security Configuration Section** - Step 17 (after Active Directory)
  - **Recommended Option** - Secure by default configuration with all security controls enabled
  - **Customized Option** - Granular control over individual security settings
- **Custom Security Controls** - Toggle switches for 7 security settings:
  - Drift Control Enforced
  - Bitlocker Boot Volume
  - Bitlocker Data Volumes
  - WDAC Enforced
  - Credential Guard Enforced
  - SMB Signing Enforced
  - SMB Cluster Encryption
- **ARM Template Integration** - Security settings automatically map to ARM template parameters
  - `securityLevel` parameter set to "Recommended" or "Customized"
  - Individual security control parameters (camelCase, no spaces)
- **Validation & Progress Tracking** - Security configuration included in validation checks and progress tracking
- **Summary Report** - Security settings displayed in configuration summary with detailed breakdown when customized
- **Toggle Switch UI** - Custom-styled toggle switches with smooth animations and visual feedback

### Changed
- **Page Description** - Updated introductory text to better describe ALDA tool capabilities
- **Default Port Speed** - Changed default network adapter speed to 25GbE for all cluster scales (previously 1GbE for Low Capacity, 10GbE for Standard, 25GbE for Rack Aware)
- **Step Numbering** - Updated step numbers due to Storage Pool Configuration repositioning:
  - Storage Pool Configuration: Step 07.5 → Step 15
  - Active Directory: Step 15 → Step 16
  - Security Configuration: Step 16 → Step 17
  - Software Defined Networking: Step 17 → Step 18
- **State Management** - Added `securityConfiguration`, `securitySettings`, `storagePoolConfiguration`, `witnessType`, and `autoScrollEnabled` to wizard state
- **Step Flow** - Integrated new configuration steps into wizard flow visibility logic
- **Port Configuration Scrolling** - Selecting network adapter ports now scrolls directly to Port Configuration section for immediate setup

### Fixed
- **Auto-Scroll Accuracy** - Fixed mapping for scenario selection to properly scroll through all steps (was skipping Azure Cloud selection)

---

## [0.1.1] - 2025-12-15

### Fixed
- **CIDR Calculator** - Added missing `ipToLong()` and `longToIp()` utility functions that caused runtime error when opening the Subnet Calculator

### Changed
- **UI Layout** - Moved Import/Export Config buttons from header to Configuration Summary panel for better accessibility while scrolling
- **CIDR Calculator Position** - Relocated Subnet Calculator button from header to Step 12 (Infrastructure Network) where IP addresses are configured

### Removed
- **Cost Estimator** - Removed cost estimation feature (button and functionality)
- **Prerequisites Checklist** - Removed prerequisites modal and banner as requirements vary by deployment scenario (Rack Aware vs Multi-Rack)

---

## [0.1.0] - 2025-12-15

### 🎉 Major Release - Enhanced User Experience & Developer Tools

This release represents a comprehensive enhancement of Odin for Azure Local with 23 major improvements spanning user experience, technical capabilities, security, and documentation.

### Added

#### User Experience
- **Auto-Save & Resume** - Automatic progress saving to localStorage with resume capability
- **Export/Import Configuration** - Save and load configurations as JSON files with versioning
- **CIDR Calculator** - Built-in subnet calculator with network details
- **Cost Estimator** - Monthly cost estimation based on configuration
- **Prerequisites Checklist** - Comprehensive checklist modal with all requirements
- **Comparison Views** - Side-by-side comparisons for Storage, Outbound, Arc Gateway, and Intent options
- **Real-time Validation** - Instant feedback on input fields with color-coded messages
- **Contextual Help System** - Help modals for complex topics (NetBIOS, RDMA, ToR, VLAN, CIDR, SDN)
- **Toast Notifications** - Non-intrusive feedback for user actions
- **What's New Modal** - Comprehensive changelog accessible from header

#### Technical Enhancements
- **Version Tracking** - All exports include version 3.1.0 identifier
- **Change Detection** - Import process detects and reports changes
- **Enhanced Validation** - Improved validation functions for NetBIOS, IPv4, CIDR, VLAN, domain names
- **Input Sanitization** - Context-aware sanitization (HTML, JSON, URL, filename)
- **Copy to Clipboard** - Utility function with fallback for older browsers
- **LocalStorage Integration** - Robust state persistence with error handling

#### Security
- **HTTP Security Headers** - X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- **Enhanced Sanitization** - All user inputs sanitized appropriately for context
- **Referrer Policy** - no-referrer policy added

#### Accessibility
- **Meta Tags** - SEO-friendly meta tags added
- **Semantic HTML** - Maintained throughout enhancements
- **Keyboard Navigation** - Enhanced keyboard support
- **Screen Reader Friendly** - Improved for assistive technologies

#### Documentation
- **README.md** - Comprehensive project documentation (500+ lines)
- **IMPLEMENTATION_SUMMARY.md** - Detailed summary of all 23 enhancements
- **EXPORT_FORMATS.md** - Guide for current and future export formats
- **FRAMEWORK_MIGRATION.md** - Detailed guide for migrating to React/Vue/Svelte
- **QUICK_START.md** - Quick reference guide for users
- **CHANGELOG.md** - This file

#### Testing
- **Unit Test Suite** - Interactive test runner (tests.html) with 50+ tests
- **Validation Tests** - Comprehensive tests for all validation functions
- **Visual Test Results** - Color-coded pass/fail indicators

### Enhanced

#### Existing Features
- **ARM Parameters Page** - Copy to clipboard already implemented, now documented
- **Report Generation** - Architecture diagrams continue to update in real-time
- **State Management** - Centralized with auto-save capability
- **Error Handling** - Improved error messages and user feedback

#### UI Components
- **Header** - Added action buttons (Import, Export, Calculator, Cost Estimate)
- **Step Headers** - Added "Compare Options" buttons on key decision steps
- **Prerequisites Banner** - Prominent blue banner before wizard starts
- **Version Display** - Version number and "What's New" link in header

### Infrastructure

#### Code Organization
- **Utility Functions** - Grouped and documented
- **Export Logic** - Modularized for future format additions
- **State Persistence** - Centralized localStorage management
- **Modal System** - Reusable modal framework for all overlays

#### Developer Experience
- **Function Documentation** - All new functions documented
- **Code Comments** - Enhanced inline documentation
- **Migration Path** - Clear path to modern framework documented
- **Extension Points** - Easy to add new features

### Documentation Improvements

#### README.md
- Table of Contents
- Getting Started guide
- Prerequisites checklist
- Usage guide with navigation
- Configuration options tables
- Export formats documentation
- Development section
- Browser compatibility
- Troubleshooting guide
- Best practices
- Security considerations

#### Additional Guides
- Export format implementation guide
- Framework migration strategy
- Quick start reference
- Implementation summary

### Fixed
- No bug fixes in this release (enhancement-focused)

### Security
- Added HTTP security headers to all HTML files
- Enhanced input sanitization throughout
- Implemented context-aware escaping
- Added referrer policy

### Performance
- Maintained performance despite added features
- Efficient localStorage operations
- Lazy loading framework for modals
- No performance degradation

### Browser Compatibility
- Tested on Chrome/Edge 90+
- Tested on Firefox 88+
- Tested on Safari 14+
- Tested on Opera 76+
- IE explicitly not supported (documented)

---

## [0.0.1] - 2025-11-XX (Prior Release)

### Added
- Initial wizard framework
- Multiple deployment scenarios support
- Network configuration steps
- ARM parameters generation
- HTML report generation
- Word-compatible report export
- Summary panel with real-time updates
- Architecture diagram generation
- Validation system
- State management

### Features
- Hyperconverged, Disaggregated, Disconnected, Multi-Rack scenarios
- Azure cloud selection (Public, Government, China)
- Scale options (single-site, rack-aware)
- Node count selection (1-16+)
- Port configuration
- Storage connectivity (switched/switchless)
- Network intent configuration
- Outbound connectivity options
- Arc Gateway configuration
- IP assignment (static/DHCP)
- Infrastructure network configuration
- Identity options (Active Directory/Local Identity)
- DNS configuration
- SDN features (optional)

---

## Version Comparison

| Feature | v0.0.1 | v0.1.0 |
|---------|--------|--------|
| Core Wizard | ✅ | ✅ |
| ARM Export | ✅ | ✅ |
| Report Generation | ✅ | ✅ |
| Auto-Save | ❌ | ✅ |
| Import/Export Config | ❌ | ✅ |
| CIDR Calculator | ❌ | ✅ |
| Cost Estimator | ❌ | ✅ |
| Prerequisites Modal | ❌ | ✅ |
| Comparison Views | ❌ | ✅ |
| Real-time Validation | ❌ | ✅ |
| Contextual Help | ❌ | ✅ |
| Toast Notifications | ❌ | ✅ |
| Unit Tests | ❌ | ✅ |
| Comprehensive Docs | ❌ | ✅ |
| Security Headers | ❌ | ✅ |
| Version Tracking | ❌ | ✅ |
| Change Detection | ❌ | ✅ |

---

## Migration Guide

### From v0.0.1 to v0.1.0

**Automatic Migration**: No action required!

1. **Saved State**: Old localStorage state is automatically compatible
2. **Exports**: Old reports and ARM parameters continue to work
3. **New Features**: All new features are additive, nothing removed
4. **Breaking Changes**: None

**What's New for You**:
- Progress now auto-saves automatically
- Click "Export Config" to save complete configuration
- Use CIDR Calculator for IP planning
- Check Cost Estimate before deployment
- Review Prerequisites before starting
- Compare options before making decisions

---

## Upcoming Features (Future Releases)

### v0.2.0 (Planned)
- [ ] Bicep template export
- [ ] Terraform configuration export
- [ ] PowerShell deployment script export
- [ ] Azure Pricing API integration for accurate costs
- [ ] Multi-language support (translations)
- [ ] Dark mode toggle
- [ ] Configuration templates for common scenarios

### v0.3.0 (Planned)
- [ ] Collaboration features (share via URL)
- [ ] Configuration comparison tool
- [ ] Deployment checklist generator
- [ ] Integration with Azure Resource Graph
- [ ] Real-time Azure quota checking

### v0.4.0 (Planned)
- [ ] Migration to React + TypeScript
- [ ] Component-based architecture
- [ ] Enhanced performance
- [ ] Progressive Web App (PWA)
- [ ] Offline support
- [ ] Advanced state management

---

## Breaking Changes

### v0.1.0
**None** - Fully backward compatible with v0.0.1

### v0.0.1
- Initial release (no prior versions)

---

## Deprecation Notices

### v0.1.0
**None** - No features deprecated

### Future Considerations
- Direct DOM manipulation may be replaced in v4.0.0 (React migration)
- Global state object may be replaced with proper state management
- LocalStorage may be supplemented with IndexedDB for larger data

---

## Contributors

### v0.1.0
- Enhanced by AI assistant based on comprehensive improvement recommendations
- All 23 recommendations implemented systematically
- Tested across multiple browsers
- Documented extensively

### v0.0.1
- Original framework and wizard implementation
- Core decision logic and validation
- ARM parameters generation
- Report generation with diagrams

---

## Support

For questions, issues, or feature requests:
- **GitHub Issues** - Report bugs or request features
- **Documentation** - Consult README.md and other guides
- **Azure Local Docs** - [learn.microsoft.com/azure-stack/hci/](https://learn.microsoft.com/azure-stack/hci/)

---

## License

This project is provided as-is for planning and configuration purposes. See official Azure documentation for deployment guidance and support.

---

**Maintained by**: Azure Local Community  
**Repository**: GitHub - Azure/AzureLocal-Supportability  
**Last Updated**: December 15, 2025
