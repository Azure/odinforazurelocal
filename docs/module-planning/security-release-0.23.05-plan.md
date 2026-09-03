# Security Release 0.23.05 Plan

## Current state

- Dependabot alerts 33-36 report four high-severity `fast-uri` vulnerabilities fixed in 4.1.3 or newer.
- Pull request 288 updates the development-only transitive dependency from 4.1.2 to 4.1.4 and passes its GitHub checks, but targets `main` instead of the required `Release` branch.
- Code scanning alerts 43-44 report two unused Microsoft reference constants in `report/report.js`.
- Pull request 285 pins GitHub Actions to immutable commit SHAs and adds grouped weekly GitHub Actions updates with a seven-day cooldown.

## Proposed change

- Apply the `fast-uri` 4.1.4 floor and lockfile update on `Release`.
- Remove only the two constants identified by CodeQL.
- Incorporate the action pinning and Dependabot configuration from pull request 285 on `Release`.
- Publish these changes as ODIN 0.23.05 with security-focused release notes.

## Files touched

- `package.json`
- `package-lock.json`
- `report/report.js`
- `.github/dependabot.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/test.yml`
- `.github/copilot-instructions.md`
- `js/version.js`
- `js/changelog.js`
- `README.md`
- `CHANGELOG.md`
- `docs/version-history/README.md`
- `docs/module-planning/security-release-0.23.05-plan.md`

## Open questions

- None. The patched dependency and exact CodeQL findings are known, and both open security-related pull requests have been reviewed for scope.

## Implementation order

1. Apply dependency and CodeQL remediations and run focused audit and lint checks.
2. Pin workflow actions and add Dependabot configuration.
3. Update version and release notes, including README history rollover.
4. Run lint, HTML validation, the full automated test suite, dependency audit, and diff checks.
5. Run the complete Sizer and Designer release-validation matrices through localhost.
6. Push `Release`, open the `Release` to `main` pull request, and verify GitHub checks and alert closure behavior.