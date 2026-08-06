# Shared Header Branding Plan

## Current state

Designer, Sizer, ToR Switch, and S2D Calc repeat the logo, release version, and
What's New button markup. Their release strings can drift independently.

## Proposed change

- Define the application release once in `js/version.js`.
- Render the repeated interactive header branding from `js/header-branding.js`.
- Keep document-specific ARM/report branding and the compact navigation logo unchanged.
- Use the shared release value for Designer export metadata.

## Files touched

- `js/version.js`, `js/header-branding.js`, `js/script.js`
- `index.html`, `sizer/index.html`, `switch-config/index.html`, `s2d-calc/index.html`
- `tests/index.html`, `README.md`, `CHANGELOG.md`, `js/changelog.js`

## Open questions

None. `SIZER_VERSION` remains an independent payload-format integer.

## Implementation order

1. Add the shared modules and replace repeated header markup.
2. Bump release documentation and the What's New modal to 0.23.01.
3. Add regression coverage and run lint, HTML validation, and the full test suite.