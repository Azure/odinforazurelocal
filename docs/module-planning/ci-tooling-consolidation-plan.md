# CI and Development Tooling Consolidation

## Current state

- PRs #305-#308 contain reviewed GitHub Actions and development-dependency bumps.
- Their functional checks pass, but Dependency Audit is blocked by existing dependencies.
- Current high-severity findings affect source-map-js, Zod, and picomatch.
- Picomatch advisory GHSA-fc5q-39xc-vjpf has no patched published release.

## Proposed change

- Consolidate the four updates on `Release` for one `Release` to `main` PR.
- Upgrade Puppeteer within 25.x to use a parent dependency supporting patched Zod.
- Keep all existing dependency security floors and the high/critical audit gate.
- Apply the maintainer-approved exception only to the picomatch advisory in
  transitive, development-only lockfile entries, before 2026-12-18 00:00 UTC.
  Log the exception explicitly; block it after expiry or if its scope changes.
- Keep production assets, application versions, and user-facing release notes
  unchanged: these changes affect validation tooling only.
- Close the superseded PRs only after the replacement is validated and ready.

## Files touched

- `.github/workflows/codeql.yml` and `.github/workflows/test.yml`
- `package.json` and generated `package-lock.json`
- `scripts/check-npm-audit.js` and focused policy tests
- `CONTRIBUTING.md` and `.github/copilot-instructions.md`
- This plan

## Open questions

- Remove the picomatch exception when a patched dependency path is available;
  otherwise it expires and blocks CI on 2026-12-18.

## Implementation order

1. Apply the reviewed action pins and compatible dependency updates.
2. Add the scoped, expiring exception and fail-closed audit validation.
3. Test the policy, audit, file-mode and HTTP suites, runner, linters, and PPTX smoke.
4. Publish one replacement PR and close superseded PRs; leave merging to a human.
