# report/vendor — third-party libraries

Files here are vendored copies of upstream open-source libraries. They are loaded
locally by the report page so the site has zero runtime dependency on third-party
CDNs (per repo policy in `.github/copilot-instructions.md`).

## pptxgen.bundle.js

- **Library**: [PptxGenJS](https://github.com/gitbrent/PptxGenJS)
- **Version**: 3.12.0
- **License**: MIT (© Brent Ely)
- **Source URL**: https://cdn.jsdelivr.net/gh/gitbrent/PptxGenJS@3.12.0/dist/pptxgen.bundle.js
- **SHA-256**: `CD078CA9E91C6F9E061EE0A3C310D6FF157C3A71B1DEA7F40FD53818017266FF`
- **Size**: 477,529 bytes
- **Used by**: [`../pptx-export.js`](../pptx-export.js)
- **Why bundled**: Includes JSZip — needed to assemble the PPTX (zip-of-XML) in-browser.

To verify locally:

```powershell
(Get-FileHash report/vendor/pptxgen.bundle.js -Algorithm SHA256).Hash
```

This canonical LF hash is also enforced by `node scripts/run-tests.js`, so a
corrupted or replaced bundle fails CI consistently on Windows and Linux.

To upgrade: replace the file from the upstream `dist/` of the new tag, update the
version + SHA-256 above, run `node scripts/smoke-test-pptx.js`, and re-test the
report → Download PowerPoint flow with representative HCI and disaggregated
designs before committing.
