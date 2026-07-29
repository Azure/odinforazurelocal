# JSON Import Security Hardening Plan

Status: **implemented and validated** for version 0.22.71.

## Current state

Designer and Sizer configurations are processed entirely in the browser. Imported Sizer workload names can reach workload-card `innerHTML`, including through Share-as-URL auto-load. Designer import accepts unknown state keys and generated print HTML contains unescaped state fields. JSON file imports have no explicit size limit.

## Proposed change

- Treat every imported or restored configuration as untrusted data.
- Normalize Sizer workload fields and escape all values used in HTML or inline handler arguments.
- Restrict Designer imports to known state keys and escape generated print-document values.
- Reject oversized JSON files before `FileReader` parsing and cap imported workload counts.
- Neutralize spreadsheet formula prefixes in CSV exports.
- Add regression tests for malicious markup and malformed/oversized import structures.
- Record the security fix in the current release changelog.

## Files touched

- `sizer/sizer.js`
- `js/script.js`
- `tests/index.html`
- `CHANGELOG.md`
- `README.md`
- `js/changelog.js`
- `docs/module-planning/json-import-security-hardening-plan.md`

## Open questions

- Firebase Realtime Database rules are verified separately by the repository owner.
- A strict Content Security Policy requires removal of inline scripts and event handlers, so it is follow-up work rather than part of this focused fix.

## Implementation order

1. Fix Sizer workload import/render XSS and add regression coverage.
2. Fix Designer import/print XSS and add regression coverage.
3. Add file-size and collection-count bounds.
4. Neutralize CSV formula prefixes and add regression coverage.
5. Run lint, HTML validation, audit, and the full test suite.
