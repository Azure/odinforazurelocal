# Shared Interaction Dialogs Plan

Status: **implemented and validated** for version 0.22.71. Full browser suite passes **1,449 / 1,449**.

## Current state

Designer and Sizer both load `js/notifications.js`, but toast styling is inline and several user actions still use browser-native `prompt`, `confirm`, and `alert` dialogs. Import uses a richer in-app modal, so Reset, Share, and Export feel unrelated across the two tools.

## Proposed change

- Add a shared interaction stylesheet loaded by Designer and Sizer.
- Upgrade the shared toast helper with consistent icons, dismiss controls, stacking, ARIA live behavior, and theme-aware colors.
- Add reusable Promise-based confirmation, text-input, and copy-fallback dialogs using the native `<dialog>` element.
- Keep Import as a workflow modal; use compact dialogs for simple confirmation and input actions.
- Migrate Sizer Reset and Share URL plus Designer Export and Start Over to the shared dialogs.
- Show cross-tool JSON import mistakes in a centered guidance dialog with a direct action to open the correct tool.
- Preserve existing global function names used by inline handlers and keyboard shortcuts.

## Files touched

- `css/interactions.css`
- `js/notifications.js`
- `index.html`
- `sizer/index.html`
- `js/script.js`
- `sizer/sizer.js`
- `tests/index.html`
- `CHANGELOG.md`
- `README.md`
- `js/changelog.js`
- `docs/module-planning/shared-interactions-plan.md`

## Open questions

- Remaining native alerts and confirmations outside the requested workflows will be migrated incrementally after the shared primitives are proven.
- Import remains a multi-step workflow modal and is not collapsed into the compact dialog component.

## Implementation order

1. Add shared styles and notification/dialog primitives.
2. Migrate Reset, Share URL, Designer Export, and Start Over.
3. Add behavior, accessibility, and visual regression coverage.
4. Update release notes and run lint, HTML validation, audit, privacy scan, and the full test suite.
