# Minimatch and Sizer Disk Compatibility

## Current state

- The main Sizer lacks the 3.2 TB disk preset already offered by the S2D
  calculator. Capacity, cache, import choices, and automatic disk-size stepping
  maintain separate lists.
- Development-only HTML Validate uses glob 13 and vulnerable minimatch 10
  (GHSA-g3hv-75wg-m249, Dependabot alert 50). Glob 14 supports patched minimatch
  11; forcing minimatch 11 beneath glob 13 is not compatible.
- Release 0.23.08 has shipped. The maintainer explicitly requests 0.23.09 for
  this combined follow-up PR.

## Proposed change

- Add the 3.2 TB preset consistently without changing existing defaults,
  capacity formulas, JSON fields, or the independent Sizer format version.
- Include the maintainer-requested Custom option in the same 0.23.09 release.
  Show separate numeric inputs for single-tier capacity and tiered cache and
  capacity, including Hybrid and Mixed All-Flash. Use the agreed S2D Calc range
  of 0.1-100 TB and preserve decimal values without changing existing units.
- Keep custom capacity sizes user-owned; clearing the manual override returns
  to standard automatic presets. Validate active inputs explicitly and block
  invalid sizing, exports, and handoffs. Preserve custom sizes through storage
  transitions, save/resume, JSON round-trips, and hardware imports using the
  existing numeric disk-size fields rather than a literal `custom` payload value.
- Verify manual ownership, capacity results, export/import, reset, and relevant
  Sizer/Designer/S2D compatibility through actual controls.
- Override only the glob 13 dependency line with glob 14.0.6 and regenerate the
  lockfile using the existing registry and TLS verification. Retain all security
  floors, legacy dependency lines, and the existing audit policy.
- Prepare 0.23.09 release metadata and README history rollover. Document this
  additional explicitly requested legacy-numbering exception; retain CalVer
  for the following release and preserve historical notes.

## Files touched

- `package.json`, generated `package-lock.json`, and dependency guidance
- `sizer/index.html`, `sizer/sizer.js`, related existing styles, and focused
  existing browser tests
- `scripts/catalog-gap-check.js` preset-versus-Custom guidance
- Relevant JSON Schema descriptions
- `js/version.js`, `README.md`, `CHANGELOG.md`, `js/changelog.js`, and
  `docs/version-history/README.md`
- Release-numbering guidance in `CONTRIBUTING.md`, contributor instructions, and
  the release-readiness skill

## Open questions

None. The maintainer confirms custom capacity and cache inputs, the 0.1-100 TB
range, and inclusion alongside the 3.2 TB preset in 0.23.09. Use the existing
disk-size units and conversion behavior. Registry package installation succeeded
without weakening TLS; subsequent full audit requests are proxy/network-blocked
and require exact-head CI evidence.

## Implementation order

1. Apply the compatible dependency override and regenerate the lockfile.
2. Add real-control regressions and implement the disk preset and Custom inputs.
3. Synchronize version, release summaries, schema descriptions, and guidance.
4. Run vulnerability, lint, file/HTTP/runner, and real-UI release validation.
5. Publish one Release-to-main PR with accurate evidence; only a human merges.

## Implementation outcome

Implemented for 0.23.09; publication still requires CI and a human PR merge.

- File-mode tests: 1729/1729; HTTP integration: 2013/2013.
- Real-control UI suite: 31/31, plus 4/4 final affected disk regressions.
- Complete Sizer matrix: 18/18; complete Designer matrix: 13/13.
- Runner tests: 12/12; audit-policy tests: 6/6; all three lints passed.
- All three main Custom inputs passed keyboard, bounds, and rendered-palette
  checks at mobile, tablet, and desktop sizes in light and dark themes.
- An actual saved Custom export passed the public schema and exact numeric
  value, timestamp, manual-ownership, and v5 compatibility assertions.
- The affected minimatch range is absent from the lockfile. Full local live
  audit requests were network-blocked; require exact-head CI audit evidence.
