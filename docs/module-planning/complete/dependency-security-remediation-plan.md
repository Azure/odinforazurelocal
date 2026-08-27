# Dependency Security Remediation Plan

Status: **shipped (v0.23.01)**.

## Current state

- Development-only transitive dependencies have new high and moderate advisories.
- Patched `ip-address` and `postcss` releases are available through the configured npm feed.
- Advisory-fixed `brace-expansion` releases are not yet available through that feed. Dependabot supplied verified `fast-uri` 4.1.2 lock metadata after the initial remediation.
- The JSZip integrity gate hashes platform-specific working-tree line endings, so it passes on Windows and fails on Linux CI.

## Proposed change

- Raise available security override floors and refresh compatible direct development tools.
- Keep narrowly scoped, documented audit exceptions only for advisories with no installable patched release.
- Raise `fast-uri` to 4.1.2 and remove its temporary audit exception.
- Canonicalize text line endings before hashing vendored JavaScript and enforce the documented PptxGenJS integrity pin.
- Regenerate the lockfile and verify resolved versions, npm audit policy, CI-equivalent checks, and the full test suite.

## Files touched

- `package.json`
- `package-lock.json`
- `scripts/check-npm-audit.js`
- `scripts/run-tests.js`
- `vendor/README.md`
- `report/vendor/README.md`
- `.gitattributes`
- `.github/copilot-instructions.md`
- `CHANGELOG.md`
- `s2d-calc/s2d-calc.js`
- `tests/index.html`

## Open questions

- Remove each temporary audit exception as soon as its patched package release is available through the configured feed.

## Implementation order

1. Update available package versions and security policy.
2. Regenerate and inspect the lockfile.
3. Fix and extend vendored-library integrity verification.
4. Harden malformed S2D Share URL validation without changing valid URLs.
5. Run audit, lint, HTML/CSS validation, and the full test suite.