# Azure Local Solutions Catalog API — Reference

> **Source of truth:** `https://azurelocalsolutions.azure.microsoft.com/#/catalog`
> **Owner:** Microsoft (public, marketing-tier content)
> **Local consumer:** [`scripts/catalog-gap-check.js`](../../scripts/catalog-gap-check.js)

This file documents the public, undocumented HTTP API that powers the
Azure Local catalog SPA. We consume it for *research only* — to compare what
real OEM hardware SKUs are shipping today vs. the OEM-agnostic option lists in
the ODIN Sizer ([sizer/sizer.js](../../sizer/sizer.js)). The catalog is **not**
referenced from any runtime page on the published site.

## Endpoint

```
POST https://azurelocalsolutions.azure.microsoft.com/api/catalog/default/search?
Content-Type: application/json
```

- Trailing `?` is part of the path (the server returns `404` to `GET`).
- No authentication, no cookies, no tokens required.
- CORS is permissive (`Access-Control-Allow-Methods: GET, POST, …`).
- The server returns `200` with no `Origin`/`Referer`, but our client sends them anyway as a courtesy.

## Request body

```json
{
  "resourceType": "Platforms",
  "searchText": "",
  "filters": [
    { "name": "lifecycleStage",           "values": ["1", "2"] },
    { "name": "qualificationGeneration",  "values": ["Current (2026 or later)"] }
  ],
  "sortOptions": null,
  "page": 1,
  "pageSize": 100
}
```

- `resourceType`: `"Platforms"` (the only value we use). Other resource types may exist for vendors, etc.
- `filters[].name = "lifecycleStage"` values:
  - `"1"` = generally available
  - `"2"` = preview / pre-release
  - Other lifecycle stages (`"3"` retired, etc.) are filtered out by the SPA by default.
- `filters[].name = "qualificationGeneration"` selects the hardware qualification
  generation. `"Current (2026 or later)"` is the SPA's default. Other observed
  values include older year buckets that you can request explicitly if you need
  to inspect retired SKUs.

## Response shape (relevant fields only)

```jsonc
{
  "data": {
    "currentPage":     1,
    "totalPages":      1,
    "totalResults":    24,
    "resourceType":    "Platforms",
    "platformFilters": [/* dropdown filter taxonomy used by the SPA */],
    "platforms": [
      {
        "properties": {
          "platformId":              "<guid>",
          "platformName":            "ExampleNode V4",
          "vendorId":                "<guid>",
          "vendorName":              "ExampleOEM",
          "systemType":              "PremierSolution | IntegratedSystem | ValidatedNode",
          "formFactor":              "Rack | Rugged",
          "rackUnits":               2,
          "minimumScale":            1,
          "maximumScale":            16,
          "lastTestedVersion":       "24H2",
          "qualificationGeneration": "Current (2026 or later)",
          "cpuFamily":               "Intel®",       // double-encoded UTF-8 — see note below
          "cpuModel":                "6th Gen Xeon® Scalable Processor",
          "isGpuSupported":          true,
          "storageDrives":           ["NVMe", "SSD", "HDD"],
          "featuresSupported":       ["SecuredCoreServer", "MicrosoftSDN"],
          "sdnNicDetails": {
            "isSdnNicSupported":     true,
            "sdnNicVendorModels":    ["Broadcom NetXtreme 575xx", "Intel® Ethernet E810", "NVIDIA ConnectX-6"]
          },

          "configurations": [
            {
              "configurationId":           "<guid>",
              "configurationName":         "All Flash NVMe and SSD",
              "isSingleNodeConfiguration": true,
              "architecture":              "Hyperconverged | Disaggregated",
              "clusterSize":               { "minimum": 1, "maximum": 16 },

              "cpuDetails": {
                "minimumCores":           8,
                "maximumCores":           172,
                "totalSocketsSupported":  2,
                "coresPerSocket":         [8, 12, 16, 24, 32, 36, 48, 64, 80, 86]
              },

              "memoryDetails": {
                "minimumMemoryBytes":     34359738368,        // 32 GB
                "maximumMemoryBytes":     8796093022208,      // 8 TB
                "numberOfDimmSlots":      16,
                "isHalfDimmSlotsSupported": true,
                "dimmSlotSizes":          "8 16 32 64 96 128 256"  // GB, space-separated
              },

              "storageDetails": {
                "minimumStorageBytes":    3840000000000,
                "storageMaxBytes":        436000000000000,
                "storageDrives":          "NVMe SSD",
                "cacheDriveDetails": {
                  "cacheDriveTypes":               ["NVMe"],
                  "minimumNumberOfCacheDrives":    2,
                  "maximumNumberOfCacheDrives":    4,
                  "cacheDriveSizes":               [{ "amount": 960, "byteUnit": "GB" }, { "amount": 1.6, "byteUnit": "TB" }],
                  "cacheDriveSizesBytes":          [960000000000, 1600000000000]
                },
                "capacityDriveDetails": {
                  "capacityStorageDriveTypes":     ["SSD"],
                  "minimumNumberOfCapacityDrives": 2,
                  "maximumNumberOfCapacityDrives": 40,
                  "capacityDriveSizes":            [{ "amount": 1.92, "byteUnit": "TB" }],
                  "capacityDriveSizesBytes":       [1920000000000]
                }
              },

              "gpuDetails": {
                "isGpuSupported": true,
                "gpuMfgModel":    "NVIDIA",
                "gpuDda":         ["NVIDIA (L4, L40S, RTX Pro 6000)"],
                "gpuP":           ["NVIDIA (L4, L40S, RTX Pro 6000)"]
              },

              "networkingDetails": {
                "networkingSpeed":  100,             // Gbps
                "nicVendorModel":   "Intel® E810,NVIDIA ConnectX-6,NVIDIA ConnectX-7,Broadcom NetExtreme-E",
                "rdmaType":         "RoCE,iWarp"
              },

              "miscellaneousDetails": {
                "hbaManufacturer":  "Broadcom",
                "hbaModel":         "SAS3816"
              },

              "solutionCapabilities": ["DisconnectedOperations", "AIWorkloads", "M365Local"]
            }
          ]
        }
      }
    ]
  },
  "message": "OK",
  "status":  200
}
```

## Quirks worth knowing

- **Encoding double-up.** Strings like `cpuFamily`, `cpuModel`, `nicVendorModel`
  contain UTF-8 bytes that have been re-encoded a second time, so `Intel®`
  arrives over the wire as `Intel\u00c2\u00ae` (renders as `IntelÂ®` if printed
  verbatim). [`scripts/catalog-gap-check.js`](../../scripts/catalog-gap-check.js)
  detects the canonical mojibake markers (`\u00c2[\u0080-\u00bf]` or `\u00e2\u0080`)
  and reinterprets the latin1 bytes as UTF-8 to recover the intended text.
- **`coresPerSocket` shape varies by transport.** The POST endpoint returns it
  as `number[]`; the same SPA's older GET endpoint returns a space-separated
  string. The gap-check accepts either form via `parseSpaceList()`.
- **`gpuDda` / `gpuP` shape varies similarly.** Sometimes `string`,
  sometimes `string[]`. Model names inside the parentheses can themselves
  contain spaces (`"RTX Pro 6000"`), so the parser splits on `,` and `|`
  only — never on whitespace.
- **`totalSocketsSupported`** can be `0` for some single-node SKUs; treat it
  as "unknown" rather than zero.
- **Snapshot file** ([catalog-snapshot.json](catalog-snapshot.json)) is a slim
  view of this payload, kept committed for offline / CI gap analysis. To
  refresh it, run from the repo root:
  ```
  node scripts/catalog-gap-check.js --live --update-snapshot
  ```

## Stability

This is an undocumented internal API for the Microsoft-owned catalog SPA, so it
**can change without notice**. The gap-check defaults to *snapshot mode* so
that a schema break only fails the manually-triggered `--live` refresh, never
CI or the public site.

## Privacy & safety

- Endpoint is fully public and anonymous — no credentials, cookies, or PII
  are sent or received.
- The committed snapshot contains only OEM hardware specs and partner names
  that already appear publicly on the catalog website.
- No part of this flow runs on the published GitHub Pages site —
  [`tests/`](../) is excluded via [`_config.yml`](../../_config.yml).
