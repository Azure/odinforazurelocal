---
name: pptx-export
description: |
  Build, extend, and debug ODIN's "Download PowerPoint" feature on the
  Configuration Report page. The exporter is template-driven: it loads
  OdinPPTTemplate.potx, strips its example slides, and injects custom OOXML
  for each section in SECTION_PLAN. JSZip (vendored via pptxgen.bundle.js)
  is the only runtime dependency. Theme/colors/fonts are owned by the .potx;
  the builder just emits text, tables, pictures, callouts, and hyperlinks.
  USE WHEN: adding/changing slides, tweaking the slide plan, fixing diagram
  rasterization, adjusting bullet/run formatting, or upgrading the template.
  DO NOT USE FOR: changes to the Word, Markdown, or PDF exports (different
  code paths in report/report.js); changes to the Designer or Sizer pages.
---

# ODIN — PowerPoint Export Skill

## Where the feature lives

| File | Role |
|------|------|
| [report/report.html](../../report/report.html) | Header has a single **📊 Download PowerPoint** button (no theme picker — the template owns the look). Loads the two scripts below. |
| [report/vendor/pptxgen.bundle.js](../../report/vendor/pptxgen.bundle.js) | Vendored [PptxGenJS](https://github.com/gitbrent/PptxGenJS) **3.12.0** (MIT). Used **only for its bundled JSZip**; PptxGenJS itself is not called. |
| [report/vendor/README.md](../../report/vendor/README.md) | Provenance: source URL, SHA-256, upgrade procedure. |
| [report/template/OdinPPTTemplate.potx](../../report/template/OdinPPTTemplate.potx) | Source-of-truth for all visual styling: master, layouts, theme colors, fonts, footer artwork. The builder loads this with JSZip and mutates the package. |
| [report/pptx-export.js](../../report/pptx-export.js) | DOM scraping + slide-plan + raw-OOXML slide builder. Exposes `window.downloadReportPptx()`. |
| [report/report.js](../../report/report.js) | Owns `CURRENT_REPORT_STATE` and `svgElementToPngDataUrl`. Re-exposes them for the exporter as `window.__odinGetReportState`, `window.__odinSvgElementToPng`, `window.__odinGetPrivateEndpointInfo`, `window.__odinBuildProxyBypassList`. **Do not duplicate** these — always reuse via the `__odin*` bridge. |
| [tools/demos/generate-disagg-fc-deck.spec.js](../../tools/demos/generate-disagg-fc-deck.spec.js) | Playwright regression: drives the Designer to a known disaggregated FC scenario, generates the report, downloads the PPTX, and saves it under `tools/output/`. Run after every change. |

## Architectural rules (must follow)

1. **No bundler / no modules.** Plain `<script>` tags. Functions live in an IIFE that only exposes `window.downloadReportPptx`. Match the rest of the repo.
2. **Template-driven, not API-driven.** The builder does **not** call PptxGenJS. It opens the `.potx` with JSZip, strips example slides + their rels + their content-type entries, then writes new `ppt/slides/slideN.xml` + `ppt/slides/_rels/slideN.xml.rels` + entries in `[Content_Types].xml` and `ppt/_rels/presentation.xml.rels` + `ppt/presentation.xml`. The template's master/layouts/theme are reused unmodified.
3. **All visual styling lives in the .potx.** Never hardcode hex colors or font names in `pptx-export.js`. If you need a new look, edit the template in PowerPoint and re-save as .potx.
4. **Vendor only — no CDN script tags.** Vendored libs live under `report/vendor/`. New entries require updating `report/vendor/README.md` with version + SHA-256.
5. **PPTX export loads only on the report page.** Don't pull `pptxgen.bundle.js` into `index.html`, `sizer/`, etc.
6. **Diagrams: SVG → PNG via the shared helper.** PowerPoint's SVG renderer is inconsistent. Always rasterize via `window.__odinSvgElementToPng(svgEl, { background, scale })` and embed the PNG. The helper strips animations, `foreignObject`, and `<switch>` fallbacks.
7. **DOM scraping over state re-rendering.** Mirror the Word/Markdown exporters: read from `#report-summary .summary-section` and `#report-rationale .summary-section`. The deck must reflect what the user sees.
8. **No new external network calls.** Generation is fully client-side. The only `fetch()` calls are same-origin to `../images/...` for diagram SVGs and to `report/template/OdinPPTTemplate.potx`.
9. **Accessibility.** The trigger is a single `<button onclick="downloadReportPptx()">` with `aria-label="Download PowerPoint"`. Keyboard-reachable.
10. **basic-ftp ≥ 5.2.2.** General repo policy still applies — see `.github/copilot-instructions.md`.

## Slide plan (`SECTION_PLAN`)

[report/pptx-export.js](../../report/pptx-export.js) has a `SECTION_PLAN` array. **One entry = one content slide.** Each entry can declare:

| Field | Purpose |
|------|------|
| `title` | Slide title (also used as the eyebrow / footer title). |
| `match` | Array of case-insensitive title prefixes. Any scraped `.summary-section` whose title matches contributes its rows (→ bullets) and diagrams (→ slide picture). |
| `customExtract(state, scraped)` | Optional. Returns `{ bullets, picture, links, runs, bulletSz, extraSps, bodySvgString, footerSvgString, paragraphXmlOverride }` to override the default scrape. Used for slides whose source data isn't a flat list of `.summary-row` pairs (Scenario & Scale grid, Physical Topology, Leaf & Spine architecture, AKS Reachability, Host Networking, Security, Private Endpoints, etc.). |
| `useRackDiagram: true` | Pin the slide picture to the rack diagram (Physical Network Configuration). |
| `diagramSrcMatch` | Substring match against `<img src>` to pick a specific external diagram (e.g. service-leaf SVG) instead of the first one found. |
| `requireDisagg: true` | Skip the slide entirely on hyperconverged configurations. |

Slides with zero bullets AND zero picture are silently skipped, so it's safe to register optional slides whose data may be absent.

## Layouts used

The template defines several layouts; the builder picks one per slide:

| Layout | Used for |
|------|------|
| `layout1` "Title and Subtitle" | Cover slide |
| `layout9` "Title and 2 column" | Text-only section slides |
| `layout10` "Title and 2 column with picture" | Section slides with a diagram on the right |
| `layout14` "Closing" | Final slide |

If you add a new layout to the template, add a builder function (`buildSectionSlide`, `buildPictureSectionSlide`, etc.) that emits the right placeholders for it.

## Bullets, runs, hyperlinks, callouts

- Bullets are emitted via `paragraphXml(text, lvl, sz, runs)`:
  - `lvl: 0` = top-level, `lvl: 2` = nested (used for `↳` follow-ups and security checks under Configuration mode).
  - `sz` = font size in 1/100 pt (`900` = 9pt). The current cap on body bullets is **9pt** for content density.
  - `runs` = optional array of `{ text, color, bold, linkRid }` for multi-color / hyperlinked runs (✓ green / ✗ red on the Security slide; Microsoft Learn reference links across slides).
- **Hyperlinks** are emitted by populating `links: [{ url, rId }]` on the section result. Each rId becomes a `<Relationship Type="…/hyperlink" TargetMode="External" Target="…">` entry in the slide rels XML, and `linkRid` on a run inserts the matching `<a:hlinkClick r:id="…"/>` into the run properties.
- **Bullet cap** is currently **24** in `buildSectionSlide` (raised from 14/18 because reference-link bullets were being trimmed off long slides).
- **Callouts / banners** are emitted as additional `<p:sp>` elements via `extraSps[]` (e.g. the red rounded-rect "Arc Private Link is NOT supported on Azure Local" banner on the Private Endpoints slide).
- **Footer raster** (e.g. subnet-utilisation bar on Infrastructure Network) is emitted via `footerSvgString` → rasterized to PNG → injected as a positioned picture.

## Microsoft Learn reference links

Where a slide describes a topology/feature with canonical Microsoft Learn coverage, attach a single Reference link as the last bullet via `runs` + `links`. Current mapping (see `getNetworkPatternUrl(state)`):

| Configuration | URL |
|------|------|
| Disaggregated, no backup | `…/network-patterns-overview-disaggregated#fiber-channel-no-backup-disaggregated-pattern` |
| Disaggregated, backup enabled | `…#fiber-channel-with-backup-disaggregated-pattern` |
| Single node | `…#single-server-deployment` |
| 2-node switchless | `…#two-node-switchless-two-switches` |
| 3-node switchless (dual-link) | `…#three-node-switchless-two-switches-two-links` |
| 4+ node switchless | `…#four-node-switchless-two-switches-two-links` |
| 2-node switched | `…#two-node-switched-two-switches` |
| 3+ node switched | `…#three-node-switched-two-switches-no-storage-switches` |

Other dedicated reference URLs:

- **Private Endpoints** slide → `…/deploy/about-private-endpoints`
- **Outbound Connectivity** slide (only when `s.arc === 'arc_gateway'`) → `…/deploy/deployment-azure-arc-gateway-overview?tabs=portal`

Paraphrase Microsoft Learn copy in narrative bullets — never quote verbatim.

## Common change recipes

### Add a new content slide
1. Append an entry to `SECTION_PLAN` with a `title` + either `match` or `customExtract`.
2. If your data isn't a list of `.summary-row` pairs, write a custom extractor that returns `{ bullets, picture?, links?, runs?, extraSps?, footerSvgString? }`.
3. Run the regression test (below). Open the resulting deck in PowerPoint Win + Mac.

### Adjust styling
Edit the template (`report/template/OdinPPTTemplate.potx`) in PowerPoint and re-save. **Do not** change colors/fonts in `pptx-export.js`.

### Upgrade JSZip / PptxGenJS bundle
1. Download new `dist/pptxgen.bundle.js` from upstream.
2. Replace `report/vendor/pptxgen.bundle.js`.
3. Update version + SHA-256 in `report/vendor/README.md` (`(Get-FileHash ... -Algorithm SHA256).Hash`).
4. Run regression test + manual PowerPoint smoke test.

## Testing & validation (must pass before commit)

```powershell
# Lint (matches CI)
npx eslint "report/*.js"

# HTML validation (matches CI)
npx html-validate "report/report.html"

# Full unit-test suite — must show all tests passing
node scripts/run-tests.js

# PPTX regression: drives Designer → report → download → save under tools/output/
npx playwright test tools/demos/generate-disagg-fc-deck.spec.js
```

**Manual smoke test** (no automated PPTX rendering test exists — file format is opaque):
1. `.\tests\serve.ps1 -Port 5500`
2. Open the Designer, build representative scenarios (HCI + Disaggregated both, with and without Arc Gateway, with and without Private Endpoints).
3. Click **📊 Download PowerPoint** → open the deck in **PowerPoint for Windows** *and* **PowerPoint for Mac** (Mac surfaces SVG/raster issues first).
4. Check: title slide, rack picture crispness, leaf-spine + service-leaf diagrams, Security slide ✓/✗ runs, Private Endpoints red callout, hyperlinks (Reference bullets must be clickable), footer raster on Infrastructure Network, slide numbers, no orphaned bullets cut at the cap.

## Branch & merge discipline

- Iterate on `feature/pptx-export`. **No push, no PR until the maintainer validates the deck in PowerPoint.**
- When approved, fast-forward Release from main, merge feature branch into Release, then PR Release → main per the standard ODIN flow in `.github/copilot-instructions.md`.
- `CHANGELOG.md` entry under the in-progress version, one-liner under **What's New** in `index.html` + `sizer/index.html`, and bump the version string everywhere it appears.

## Anti-patterns to reject

- ❌ Calling PptxGenJS APIs (`new pptxgen()`, `slide.addText`, `slide.addImage`, `pres.writeFile`). The builder is raw OOXML; mixing in PptxGenJS fights the template.
- ❌ Hardcoding hex colors, fonts, or sizes in `pptx-export.js` instead of editing the .potx.
- ❌ Re-introducing a Light/Dark theme picker. The template owns the theme.
- ❌ Re-introducing `report/pptx-themes.js`. Removed; the export does not need it.
- ❌ Embedding raw SVG with a slide picture — always rasterize via `__odinSvgElementToPng`.
- ❌ Adding a `<script src="https://cdn..."` for any new library. Vendor it.
- ❌ Promoting `pptxgen.bundle.js` to a global include outside `report/`.
- ❌ Skipping the SHA-256 update in `report/vendor/README.md` after a library upgrade.
- ❌ Quoting Microsoft Learn verbatim. Paraphrase.
