# Vendored client-side libraries

These third-party libraries are vendored locally so the published site never
makes runtime calls to a third-party CDN. This satisfies the README guarantee
that the only external runtime calls are Firebase analytics, and lets the tool
work fully offline (clone-and-open use case).

| File | Library | Version | License | Source |
|------|---------|---------|---------|--------|
| `html2canvas-1.4.1.min.js`       | [html2canvas](https://github.com/niklasvh/html2canvas) | 1.4.1   | MIT | https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js |
| `jspdf-4.2.1.umd.min.js`         | [jsPDF](https://github.com/parallax/jsPDF)             | 4.2.1   | MIT | https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js |
| `jszip-3.10.1.min.js`            | [JSZip](https://github.com/Stuk/jszip)                 | 3.10.1  | MIT | https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js |
| `three-0.128.0.min.js`           | [three.js](https://github.com/mrdoob/three.js)         | 0.128.0 | MIT | https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js |
| `three-OrbitControls-0.128.0.js` | three.js OrbitControls (examples)                       | 0.128.0 | MIT | https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js |
| `xlsx-0.20.3.min.js`             | [SheetJS Community](https://sheetjs.com)               | 0.20.3  | Apache-2.0 | https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js |

These files are loaded as plain `<script src="...">` tags from `index.html`,
`sizer/index.html`, and `report/report.html`. Do not minify, transpile, bundle,
or otherwise modify them. To upgrade, fetch the new version from the source
URL above and update the entries in this table.

## SheetJS (`xlsx-0.20.3.min.js`) — special handling

Unlike the libraries above, **SheetJS is _not_ loaded via a static `<script>` tag.**
It powers the Sizer's RVTools `.xlsx` import (issue #230) and is the largest single
asset in the repo (~930 KB), so it is **lazy-loaded**: the `<script>` is injected only
the first time a user opens the **📊 RVTools** import tab in the Sizer. Users who never
touch RVTools never download it, and the initial Sizer page weight is unchanged. Do not
add a static `<script src=".../xlsx-0.20.3.min.js">` tag anywhere.

- **Provenance:** version `0.20.3`, downloaded 2026-06-01 from the official SheetJS CDN
  (`https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js`). The `xlsx`
  package was delisted from npmjs.com in 2023, so it is **not** in `package.json` and is
  **not** tracked by Dependabot — it is vendored as a prebuilt blob exactly like the
  files above.
- **License:** Apache-2.0.
- **SHA-256:** `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41`
  (lower-case). This hash is **pinned** by an integrity test in the unit-test suite
  (`tests/index.html` / `node scripts/run-tests.js`); any accidental corruption or
  tampered/swapped blob fails that test.
- **Upgrading:** download the new official release, replace the file (renaming to match
  the new version), update the version + URL in the table above, update the SHA-256 here,
  and update the expected hash in the integrity test. Do **not** add a network/upstream
  "is there a newer version?" check — CI stays offline and deterministic.

The PowerPoint export library (`pptxgen.bundle.js`) is vendored separately
under `report/vendor/` for historical reasons — see `report/vendor/README.md`.
