# ODIN for Azure Local — JSON Schemas

Machine-readable [JSON Schema](https://json-schema.org/) (draft-07) definitions for the files ODIN
exports and imports. They let you **validate, generate, and transform ODIN configurations offline**,
in any language or CI pipeline, with no ODIN code and no network calls.

> Tracking issue: [#237](https://github.com/Azure/odinforazurelocal/issues/237)

## Two separate formats

ODIN has **two independent export/import surfaces**, each with its own file format. Do **not** feed one
tool's export into the other.

| Tool | Schema | Envelope | Payload |
|------|--------|----------|---------|
| **Designer** ("Export Configuration") | [`odin-design.schema.json`](odin-design.schema.json) | `{ version, exportedAt, state }` | `state` — the wizard configuration (~120 fields) |
| **Sizer** ("Export JSON") | [`odin-sizer.schema.json`](odin-sizer.schema.json) | `{ _meta, data }` | `data` — cluster/hardware config + `workloads[]` |

Stable URLs (suitable for a `$schema` reference):

- `https://azure.github.io/odinforazurelocal/docs/json-schema/odin-design.schema.json`
- `https://azure.github.io/odinforazurelocal/docs/json-schema/odin-sizer.schema.json`

## Designer export

```jsonc
{
  "version": "0.22.61",            // metadata only — the producing app version; NOT validated
  "exportedAt": "2026-06-02T10:00:00.000Z",
  "state": {
    "scenario": "connected",        // connected | disconnected | rackscale | m365local
    "architecture": "hyperconverged",
    "nodes": "3",                   // node count is stored as a string
    "witnessType": "Cloud",
    "storage": "switchless",
    "securityConfiguration": "recommended",
    "securitySettings": {
      "driftControlEnforced": true, "bitlockerBootVolume": true, "bitlockerDataVolumes": true,
      "wdacEnforced": true, "credentialGuardEnforced": true, "smbSigningEnforced": true,
      "smbClusterEncryption": true
    }
    // … many more optional fields; see the schema for the full list
  }
}
```

- **Required**: `state`. Everything inside `state` is optional/nullable until the matching wizard step
  is completed.
- `version` / `exportedAt` are **metadata only** — they are not read on import and are not pinned to
  the app version.

## Sizer export

```jsonc
{
  "_meta": {
    "tool": "ODIN Sizer for Azure Local",
    "version": 2,                   // SIZER_VERSION — a PAYLOAD-FORMAT integer, not a release version
    "exportedAt": "2026-06-02T10:00:00.000Z",
    "url": "https://azure.github.io/odinforazurelocal/sizer/index.html"
  },
  "data": {
    "clusterType": "standard",      // single | standard | rack-aware | disaggregated | aldo-mgmt
    "nodeCount": "3",
    "resiliency": "3way",
    "workloads": [
      { "id": 1, "type": "vm",  "name": "Prod VMs", "vcpus": 8, "memory": 32, "storage": 256, "count": 20 },
      { "id": 2, "type": "aks", "name": "AKS", "workerNodes": 4, "workerVcpus": 8, "workerMemory": 32 }
    ]
  }
}
```

- **Required**: at least one of `clusterType` or `workloads` (the importer duck-types validity).
- The importer also accepts the **bare `data` object** (no `{ _meta, data }` wrapper) — both forms are
  modelled by the schema's top-level `oneOf`.
- Each `workloads[]` item is discriminated by `type` (`vm` / `aks` / `avd` / `foundry` / `edgerag` /
  `videoindexer` / `ghel`); the remaining fields depend on the type. See the schema's `workload`
  definition.
- `_meta.version` (`SIZER_VERSION`) is a **payload-format** integer — it only bumps when the Sizer
  payload shape changes, not on every release. Bumped 1 → 2 in v0.22.62 when GitHub Enterprise Local
  (GHEL) became a first-class workload type.

## Validate an export

Any standard draft-07 validator works. Examples:

**Node.js (ajv):**

```bash
npm install ajv ajv-formats
```

```js
import Ajv from "ajv";
import addFormats from "ajv-formats";
import design from "./odin-design.schema.json" assert { type: "json" };
import myExport from "./my-design.json" assert { type: "json" };

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const valid = ajv.validate(design, myExport);
if (!valid) console.error(ajv.errors);
```

**Python (jsonschema):**

```bash
pip install jsonschema
```

```python
import json, jsonschema
schema = json.load(open("odin-design.schema.json"))
data = json.load(open("my-design.json"))
jsonschema.validate(data, schema)   # raises ValidationError on failure
```

**VS Code** — add a `$schema` reference at the top of your export to get inline validation and
autocomplete:

```jsonc
{
  "$schema": "https://azure.github.io/odinforazurelocal/docs/json-schema/odin-design.schema.json",
  "version": "0.22.61",
  "state": { /* … */ }
}
```

## Backwards & forwards compatibility

Both schemas are intentionally **permissive** (`additionalProperties: true`, most fields nullable):

- **Old exports keep working** — files from earlier ODIN versions (with fewer fields) still validate.
- **New exports work in older tooling** — unknown fields added by newer ODIN releases are accepted,
  not rejected.
- ODIN's importers **never hard-reject on schema mismatch.** They surface a non-blocking warning for
  unknown/invalid fields and still load the file. The only keys ever rejected are the dangerous
  prototype-pollution keys (`__proto__`, `constructor`, `prototype`), which no legitimate export
  contains.

If you need strict validation in your own pipeline, configure your validator accordingly (e.g. ajv
`strict` / disallow additional properties) — that is your choice, independent of ODIN's tolerant
import behaviour.

## Keeping the schemas accurate

These schemas are guarded by CI tests (`scripts/run-tests.js`) that compare them against ODIN's
source-of-truth state objects — `getInitialWizardState()` for the Designer, `getSizerState()` for the
Sizer, and `WORKLOAD_DEFAULTS` for the Sizer's workload `type` enum. If an ODIN state field is added,
renamed, or removed — or a new Sizer workload type is added — without updating the matching schema,
the build fails, so the published schemas can't silently drift out of date at the structural level.

Value-level drift (a new enum value on an existing field, a new per-workload field, an envelope-shape
change) is not CI-enforced — contributor guidance for those cases lives in
[`.github/copilot-instructions.md`](../../.github/copilot-instructions.md) (*JSON Schemas* section).
