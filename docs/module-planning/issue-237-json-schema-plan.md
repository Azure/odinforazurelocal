# Issue #237 — ODIN design JSON Schema + import hardening (plan)

Status: **in-flight / scoping** · Issue: [#237](https://github.com/Azure/odinforazurelocal/issues/237) · Owner: Neil

## Why
@soufiane-elsan asked (after re-scoping away from a hosted API) for ODIN designs to be
**scriptable and automation-friendly, offline**, specifically:
1. a documented JSON schema for ODIN designs;
2. a way to validate/transform ODIN JSON outside the Designer UI;
3. clearer docs on the import/export format + required fields.

All three fit ODIN's local-first, no-backend design. No API, no published npm package,
no server — just a static schema + docs + (optional) in-app validation.

**Scope note:** ODIN has TWO independent export/import surfaces — the **Designer** and the
**Sizer**. They use **different envelopes and different payload shapes**, so this work needs
**TWO schemas** (`odin-design.schema.json` + `odin-sizer.schema.json`), with the same docs,
drift-guard tests, and import-hardening applied to both.

## Current state (reverse-engineered) — DESIGNER
- **Export** (`exportConfiguration()`, js/script.js) writes a 3-key envelope:
  ```jsonc
  { "version": "<WIZARD_VERSION>", "exportedAt": "<ISO>", "state": { ...wizard state... } }
  ```
- **Import** (`importConfiguration()`, js/script.js) is the de-facto spec and is **very permissive**:
  - only hard requirement: `imported.state` exists;
  - ARM templates are detected first (via `$schema`) and routed to `parseArmTemplateToState()`;
  - copies every known `state` key present, **then copies any extra keys too**;
  - **no field-level validation**; `version` / `exportedAt` are **not read** on import.
- **Source of truth for `state` shape**: `getInitialWizardState()` (js/script.js, ~120 fields).
- **`WIZARD_VERSION` is stale**: stamped `0.20.08` while the app is `0.22.55`. Used in the export
  envelope, localStorage autosave metadata, and the **report footer** (shows a wrong version to users).
  Import does NOT read it → safe to sync. Schema version must be **decoupled** from WIZARD_VERSION.

## Field taxonomy (state)
Core scenario (`scenario`, `architecture`, `region`, `scale`, `nodes`, `witnessType`) · UI prefs
(`theme`, `fontSize`) · networking/ports (`ports`, `portConfig`, `storage`, `intent*`, `adapterMapping`)
· IP/infra (`infra*`, `nodeSettings[]`, `customStorageSubnets[]`) · AD/DNS · security
(`securityConfiguration`, `securitySettings{7 booleans}`) · storage pool / SAN LUNs · rack-aware ·
private endpoints · disconnected/ALDO (`clusterRole`, `autonomousCloudFqdn`) · **disaggregated**
(~35 `disagg*` fields, the largest/most nested block) · Sizer pass-through (`sizerHardware`,
`sizerWorkloads`, `clusterName`).

### Known enums (from index.html onclick handlers + state comments)
- `scenario`: connected | disconnected | rackscale | m365local
- `architecture`: hyperconverged | disaggregated
- `witnessType`: Cloud | NoWitness
- `storage`: switched | switchless
- `storagePoolConfiguration`: Express | InfraOnly | KeepStorage
- `activeDirectory`: azure_ad | local_identity
- `securityConfiguration`: recommended | customized
- `privateEndpoints`: pe_enabled | pe_disabled
- `disaggStorageType`: fc_san | iscsi_4nic | iscsi_6nic
- `clusterRole`: management | workload

## Current state (reverse-engineered) — SIZER
The Sizer is a SEPARATE tool (sizer/sizer.js) with its own export/import — must NOT be conflated
with the Designer schema.
- **Export** (`exportSizerJSON()`) writes a DIFFERENT envelope shape:
  ```jsonc
  { "_meta": { "tool": "ODIN Sizer for Azure Local", "version": <SIZER_VERSION>,
                "exportedAt": "<ISO>", "url": "<href>" },
    "data": { ...sizer state... } }
  ```
  Note: envelope key is `_meta`/`data` (Sizer) vs `version`/`exportedAt`/`state` (Designer);
  and `SIZER_VERSION` is a **plain integer** (currently `1`), NOT a semver string. The two
  envelopes are deliberately distinct → two schemas.
- **Import** (`handleSizerFileImport()` → `applyImportedSizerState()`) is permissive but slightly
  stricter than the Designer:
  - accepts EITHER `{ _meta, data }` OR a raw state object (`const d = parsed.data || parsed`);
  - validation = duck-typing only: rejects unless `d.clusterType || d.workloads` is present;
  - `_meta`/`version` are **not read** on import;
  - `applyImportedSizerState()` reads a FIXED set of known fields with `|| default` fallbacks — it
    does NOT blind-copy arbitrary keys onto a state object, so the Designer's prototype-pollution
    vector is NOT directly present here. BUT `workloads[]` is taken largely as-is and pushed, and
    per-workload fields feed the UI/calculations, so workload-shape validation is still worth adding.
- **Source of truth for the Sizer payload**: `getSizerState()` (sizer/sizer.js, ~35 flat fields +
  a `workloads[]` array + `workloadIdCounter`).

### Sizer `data` field groups
- Cluster/topology: `clusterType`, `clusterName`, `nodeCount`, `futureGrowth`, `resiliency`,
  `disaggRackCount`, `disaggStorageType`, `disaggSpineCount` (+ several `*UserSet` booleans that
  track whether the user overrode an auto-calculated value — important to preserve on round-trip).
- CPU: `cpuManufacturer`, `cpuGeneration`, `cpuCores`, `cpuSockets` (+ `cpuConfigUserSet`).
- Memory/GPU: `nodeMemory`, `memoryUserSet`, `gpuCount`, `gpuType`, `vcpuRatio`, `vcpuRatioUserSet`.
- Storage: `storageConfig`, `storageTiering`, `capacityDiskCount/Size`, `cacheDiskCount/Size`,
  `tieredCapacityDiskCount/Size`, `repairDiskCount` (+ `diskSizeUserSet`, `diskCountUserSet`,
  `repairDisksUserSet`).
- Imported-CPU passthrough: `importedProcessorName`, `importedCoresPerSocket`.
- **`workloads[]`** — the main nested array. Every item: `{ id:int, type, name, ... }` where `type`
  ∈ `vm | aks | avd | foundry | edgerag | videoindexer` and the remaining fields are
  **type-discriminated** (e.g. `vm` → vcpus/memory/storage/count/inputMode; `aks` → control-plane +
  worker sizing; `avd` → profile/userCount/sessionType/concurrency/fslogix(+custom*); `foundry` →
  modelClass/replicas/engine(+custom*); `edgerag` → computeMode/corpusGB; `videoindexer` →
  configuration) plus common GPU fields (`gpuMode`, …). A JSON Schema `oneOf` keyed on `type` is the
  right modelling tool here.
- `workloadIdCounter` — int, the id high-water mark.

### Known Sizer enums
- workload `type`: vm | aks | avd | foundry | edgerag | videoindexer
- `clusterType`: standard | disaggregated | (+ others — confirm from cluster-type `<option>`s)
- `foundry.modelClass`: small | medium | large | custom · `foundry.engine`: onnx-genai | vllm
- `avd.profile`: (light/medium/heavy/custom — confirm) · `avd.sessionType`: multi | single
- `edgerag.computeMode`: gpu | cpu · `videoindexer.configuration`: minimum | recommended

## Proposed deliverables (v1) — applies to BOTH tools
1. **Two schemas** under `docs/json-schema/` — draft-07:
   - `odin-design.schema.json` — Designer envelope (`version`/`exportedAt`/`state`) + `state`.
   - `odin-sizer.schema.json` — Sizer envelope (`_meta`/`data`) + `data`, with a `workloads[]`
     `oneOf`-by-`type` model. Also accept the raw-state form the importer allows (`data || self`),
     i.e. document both the wrapped and unwrapped shapes.
   - Both: start permissive (`additionalProperties: true`, most fields nullable), enums only where
     confidently known, rich `title`/`description` so each schema doubles as documentation.
   - Envelope versions (`version` string for Designer, integer `SIZER_VERSION` for Sizer) are
     free-form metadata, NOT validated and NOT pinned to the app version.
2. `docs/json-schema/README.md` — documents BOTH envelopes side by side, required vs optional fields,
   one annotated example each, and how to validate from Terraform/CI/any language (ajv,
   python-jsonschema, VS Code `$schema`). Make the Designer-vs-Sizer distinction explicit so authors
   don't feed one into the other.
3. **Drift-guard tests** (one per tool) — this is also the "rev the schema when needed" enforcement:
   assert every top-level key of `getInitialWizardState()` matches `odin-design` `state.properties.*`,
   and every key of `getSizerState()` matches `odin-sizer` `data.properties.*` (**both directions**)
   → the moment a state field is added/renamed/removed without updating the schema, CI fails, forcing
   the schema to be revved in the same PR. Plus: validate fixture exports of each tool against its
   schema, and assert each schema's declared `$id`/version stays in sync with its source-of-truth
   constant where one applies. (NB: this guards *structure* drift; the envelope `version` /
   `SIZER_VERSION` are free-form metadata and intentionally NOT asserted against the app version.)
   - **SHIPPED (v0.22.61):** implemented Node-side in `scripts/run-tests.js` as `checkSchemaDrift()`,
     a fail-fast gate that runs in CI before the browser suite (mirrors the existing
     `checkVendorIntegrity()` pattern). Brace-aware `extractTopLevelObjectKeys()` parses the
     top-level keys of each state object literal (handles nested objects/arrays/strings/comments)
     and compares them both directions against the published schema's property map
     (`properties.state.properties` for Designer, `definitions.sizerState.properties` for Sizer).
     Building it immediately caught two real bugs in the just-published Designer schema: 63 state
     fields were undocumented and a phantom `clusterName` (a Sizer-only field) was present — both
     fixed in the same change. Fixture-export validation against the schemas (needs a JSON-Schema
     validator) deferred to avoid adding a runtime/dev dependency; the key-parity gate is the
     high-value enforcement.
4. **Import hardening** — apply to BOTH importers:
   - **Designer** (`importConfiguration()`): prototype-pollution guard — reject/skip
     `__proto__`/`constructor`/`prototype` in the "copy extra keys" loop (currently assigns arbitrary
     keys straight onto `state`). This is the higher-risk path.
   - **Sizer** (`handleSizerFileImport()`/`applyImportedSizerState()`): lower risk (reads a fixed key
     set), but add (a) the same dangerous-key guard defensively, and (b) `workloads[]` shape
     validation — reject items whose `type` isn't in the known set, and clamp/validate numeric fields
     before they reach calculations. Keep the existing `data || parsed` raw-state acceptance.
   - **Optional soft schema validation** (both): validate against the schema and surface a
     non-blocking warning toast listing unknown/invalid fields. KEEP forward-compat (accept
     newer/unknown non-dangerous fields) — warn, don't reject.
   - No new runtime dependency: tiny self-contained validator or fetch+parse the JSON schema and do
     shallow key/enum checks. (Full ajv in-browser is overkill — avoid.)
   - **SHIPPED (v0.22.61):** Designer `importConfiguration()` now guards BOTH copy loops with a
     `DANGEROUS_KEYS` skip-list (`__proto__`/`constructor`/`prototype`) and soft-warns
     (`console.warn`) on skipped keys — closes the prototype-pollution vector where `JSON.parse`'s
     own-enumerable `__proto__` was assigned straight onto `state`. Sizer `applyImportedSizerState()`
     strips dangerous own-keys defensively and validates `workloads[]` shape (drops non-objects /
     arrays / unknown `type`s, coerces a non-array `workloads` to `[]`), each with a soft warning;
     the rest of a valid import still applies. Both guards run before any side effects. Covered by 4
     new browser tests in the "Import Hardening (#237)" suite. The **optional soft schema-validation
     toast** was deliberately NOT built — it needs an in-browser validator (dependency/footprint) for
     marginal value over the dangerous-key + shape guards; revisit only if requested.
5. **Sync the version constants**: bump `WIZARD_VERSION` (`0.20.08` → current release) and add BOTH
   `WIZARD_VERSION` and `SIZER_VERSION` to the version-bump checklist so they don't drift again
   (fixes the wrong Designer report-footer version as a side-benefit). NB `SIZER_VERSION` is an
   integer payload-format version, not a release version — only bump it on a Sizer payload format
   change, and document that distinction.
   - **SHIPPED (v0.22.61):** `WIZARD_VERSION` bumped `0.20.08` → `0.22.61` in `js/script.js` (the
     Designer JSON-export envelope + report-footer version); `SIZER_VERSION` left at integer `1`
     (payload format unchanged). Both constants added to the version-bump checklist in
     `.github/copilot-instructions.md`, with the payload-format-vs-release distinction documented.

## Open questions
- Publish location: `docs/json-schema/` IS useful end-user content → leave it **included** in GitHub
  Pages (do NOT add to `_config.yml` exclude). Confirm.
- In-app validation: soft-warn only (recommended) vs hard-block on invalid import? Soft-warn keeps
  existing files working and matches today's permissive behaviour.
- Whitelist-only import (drop unknown keys) vs keep-unknown-but-guard-dangerous (recommended, keeps
  forward-compat)?
- Do we also want a tiny offline **validate CLI** (`scripts/validate-design.js`, Node, wraps the same
  schema) as a follow-on? Schema-first; CLI optional.

## Rough order
1. Land schema + docs (read-only, zero risk) → unblocks the requester immediately.
2. Add drift guard + fixture validation tests.
3. Import hardening (prototype-pollution guard first — small, clear security win; then optional soft
   validation).
4. Sync WIZARD_VERSION (separate tiny PR, or fold into the schema PR).

## Notes
- Schemas shipped to their final home in `docs/json-schema/` (`odin-design.schema.json`,
  `odin-sizer.schema.json`) + `docs/json-schema/README.md` in v0.22.61. The earlier
  `*.schema.draft.json` prototypes have been removed now that the production files exist.
- Sizer draft enums were confirmed from sizer/index.html `<option>` lists and sizer/sizer.js modal
  builders: clusterType (single/standard/rack-aware/disaggregated/aldo-mgmt), resiliency (2way/3way),
  cpuManufacturer (intel/amd/intel_edge), storageConfig (all-flash/mixed-flash/hybrid), gpuType
  (t4/a2/a16/a40/a100/l4/l40/l40s/rtxpro6000/h100), and per-workload enums (vm inputMode; aks cp-node
  1/3/5; avd profile light/medium/heavy/power/custom + sessionType multi/single; foundry modelClass
  small/medium/large/custom + engine onnx-genai/vllm; edgerag computeMode gpu/cpu; videoindexer
  configuration minimum/recommended; common gpuMode none/dda). `storageTiering` left as free string —
  its options are injected dynamically per storageConfig.
- The Sizer schema uses a top-level `oneOf` (wrapped `{_meta,data}` OR bare state) and a
  `workloads[]` item `oneOf` discriminated by `type` — mirrors the importer's `data || parsed`
  acceptance and the type-switch in addWorkload()/applyImportedSizerState().
- **Designer and Sizer schemas are separate by design** — different envelopes (`state` vs `data`),
  different version semantics (semver string vs integer), different payloads. Do not merge them.
- Keep everything client-side/offline. No API, no backend, no published package, no new runtime deps.
