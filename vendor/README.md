# Vendored client-side libraries

These third-party libraries are vendored locally so the published site never
makes runtime calls to a third-party CDN. This satisfies the README guarantee
that the only external runtime calls are Firebase analytics, and lets the tool
work fully offline (clone-and-open use case).

| File | Library | Version | License | Source |
|------|---------|---------|---------|--------|
| `html2canvas-1.4.1.min.js`       | [html2canvas](https://github.com/niklasvh/html2canvas) | 1.4.1   | MIT | https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js |
| `jspdf-4.2.1.umd.min.js`         | [jsPDF](https://github.com/parallax/jsPDF)             | 4.2.1   | MIT | https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js |
| `three-0.128.0.min.js`           | [three.js](https://github.com/mrdoob/three.js)         | 0.128.0 | MIT | https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js |
| `three-OrbitControls-0.128.0.js` | three.js OrbitControls (examples)                       | 0.128.0 | MIT | https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js |

These files are loaded as plain `<script src="...">` tags from `index.html`,
`sizer/index.html`, and `report/report.html`. Do not minify, transpile, bundle,
or otherwise modify them. To upgrade, fetch the new version from the source
URL above and update the entries in this table.

The PowerPoint export library (`pptxgen.bundle.js`) is vendored separately
under `report/vendor/` for historical reasons — see `report/vendor/README.md`.
