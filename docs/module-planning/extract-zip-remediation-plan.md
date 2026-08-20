# Extract-Zip Remediation Plan

## Current state

- Dependabot alert #31 reports `extract-zip` 2.0.1 as vulnerable to unvalidated symlink path traversal (GHSA-jmr9-qjv8-65gv / CVE-2026-56876).
- The development-only dependency path is `puppeteer` -> `@puppeteer/browsers` -> `extract-zip`.
- `extract-zip` has no patched release, but Puppeteer 25.6.0 removes the vulnerable path through `@puppeteer/browsers` 3.2.0.
- Puppeteer 25 is ESM-only and requires Node.js 22.12.0 or newer.

## Proposed change

- Upgrade Puppeteer to 25.6.0 or newer within the 25.x line and declare the matching Node.js engine floor.
- Adapt the two CommonJS Node scripts to load Puppeteer with dynamic `import()` and use the current headless option.
- Document a security floor that prevents the vulnerable Puppeteer dependency path from returning.
- Do not change the ODIN application version, README What's New section, or public release notes because this affects development tooling only and does not change shipped application behavior.

## Files touched

- `package.json`
- `package-lock.json`
- `scripts/run-tests.js`
- `scripts/smoke-test-pptx.js`
- `.github/copilot-instructions.md`
- `docs/module-planning/extract-zip-remediation-plan.md`

## Open questions

- None. A patched parent dependency is available, so no audit exception is warranted.

## Implementation order

1. Upgrade Puppeteer and regenerate the lockfile.
2. Update the CommonJS script loading and headless launch options.
3. Add the dependency security constraint.
4. Verify `extract-zip` is absent and the policy audit passes.
5. Run the full test, smoke-test, and lint validation suite.
