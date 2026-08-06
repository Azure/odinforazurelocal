# Configuration Report PowerPoint Export

Use this guidance when changing the Configuration Report PowerPoint export in `report/pptx-export.js` or its report-page integration.

## Architecture

- The exporter builds a `.pptx` package from scratch as OOXML in the browser. It does not load or modify a `.potx` template.
- `report/pptx-export.js` owns the presentation theme, slide master, slide layout, content types, relationships, slide XML, media, and package assembly.
- `SECTION_PLAN` is the source of truth for which report sections become slides and how they are rendered.
- The exporter uses JSZip from the vendored PptxGenJS browser bundle to assemble the package. Do not add a CDN or runtime dependency.
- Images and diagrams are fetched only from same-origin repository assets. Keep export functional for local/offline use.
- The generated deck uses its own dark visual treatment. The report page's light/dark theme does not select a PowerPoint theme.

## Integration Boundaries

- `report/report.js` exposes report data and rendering bridges through the existing `window.__odin*` globals consumed by the exporter.
- Preserve those bridges unless both producer and consumer are updated together with regression coverage.
- Keep section ordering and availability aligned with the HTML report. Test both HCI and disaggregated designs when shared report behavior changes.
- Keep the export browser-only and compatible with the repository's classic global-script architecture. Do not introduce modules, a bundler, or server-side generation.

## Editing Guidance

- Change layout, typography, colors, and OOXML structures in `report/pptx-export.js`; there is no external presentation template to edit.
- Reuse the existing XML builders, relationship helpers, and style constants. Add a helper only when it removes repeated package-building logic.
- Escape all user-derived text through the existing XML escaping path before inserting it into OOXML.
- Keep relationship IDs, part names, content types, and package paths internally consistent. A deck that downloads successfully can still be invalid OOXML.
- Maintain the vendored bundle version and SHA-256 record in `report/vendor/README.md`. Do not hand-edit the minified bundle.

## Validation

Run the focused checks after exporter changes:

```powershell
npx eslint "report/*.js"
npx html-validate "report/report.html"
node scripts/smoke-test-pptx.js
npx playwright test tools/demos/generate-disagg-fc-deck.spec.js
```

Then run the complete repository suite:

```powershell
node scripts/run-tests.js
```

Inspect at least one generated HCI deck and one disaggregated deck when slide content, ordering, rendering, or media changes. Confirm that PowerPoint opens the file without a repair warning and that text, diagrams, and footers fit their slide bounds.

## Repository Workflow

- Work directly on the long-lived `Release` branch.
- The only pull request direction is `Release` to `main`; do not create a feature branch.
- Record user-visible export changes under the current release in `CHANGELOG.md`.
- Update `ODIN_VERSION` only for an application release. PowerPoint export changes do not have a separate version constant.