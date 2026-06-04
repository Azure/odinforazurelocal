# Copilot Instructions

## Git Operations
- Always use Git CLI commands in the terminal for all git operations
- Do not use MCP tools or other git integrations, such as Kraken
- Do not use pwsh commands for PowerShell 7, as they may not work in all environments
- Use `git status` to check the status of your repository before making any commits
- When updating the version number, ensure that it is updated in all relevant files, such as the `README.md`, `CHANGELOG.md`, and the index.html and What's New section in the java script code.
- When making updates use the Release Branch and create a pull request to merge it into the main branch. Do not commit directly to the main branch.
- **STRICT branching rule (no exceptions without explicit user approval)**: There are exactly **two long-lived branches** in this repo — `main` and `Release`. ALL work goes onto `Release`, and `Release → main` is the ONLY PR pattern. Do **NOT** create feature branches, fix branches, `feat/*`, `fix/*`, `ci/*`, `chore/*`, etc. — not even for "small isolated changes". If you find yourself typing `git checkout -b`, **stop** and use `Release` instead. The only acceptable reasons to create a third branch are: (a) the user explicitly asks for one by name, or (b) you need to recover from a botched `Release` state (and even then, ask first). Multiple in-flight PRs against `main` are a sign you've already broken this rule — consolidate onto `Release` as one PR.
- When creating a pull request, ensure that it includes a clear description of the changes made and the reason for the changes. This will help reviewers understand the context of the changes and provide feedback more effectively.
- Before starting new work, always pull the latest changes from the main branch into Release Branch to ensure that you are working with the most up-to-date codebase, fast-forward merge. This will help prevent merge conflicts and ensure that your changes are based on the latest version of the code.
- **If `Release` has diverged from `main`** (e.g. another PR landed on `main` while your work was in flight), bring `Release` back in sync by **merging `main` into `Release`** (`git merge origin/main` from `Release`, then push). Do NOT rebase `Release` and do NOT force-push it — it's a shared long-lived branch.
- When adding new release notes to the top of the readme, for each new release, ensure that we move the existing / old versions to only exist in the appendix of the readme, and only the latest version is at the top of the readme. This will help keep the readme organized and make it easier for users to find the latest release notes.
- PRs should be merged manually by the author, after all checks have passed and any necessary approvals have been obtained. Do not use auto-merge features, as they may merge PRs before they are ready or without proper review.

## Planning Notes (`docs/module-planning/`)
- **Before starting any non-trivial work**, read [`docs/module-planning/`](../docs/module-planning/). If a plan already exists for the area you're touching (a `*-plan.md` file at the top of that folder), read it first — it likely contains decisions, tradeoffs, files-touched lists, and open questions that affect how the implementation should land.
- For new multi-step or cross-file work, capture a short plan as `docs/module-planning/<topic>-plan.md` before coding. Include: current state, proposed change, files touched, open questions, and a rough implementation order. Keep plans concise and skimmable.
- **When a plan's work has shipped** (PR merged, version released), move the plan file from `docs/module-planning/` into `docs/module-planning/complete/` in the same release PR (or a follow-up). This keeps the top level focused on what's still in-flight. Do not delete completed plans — the history is useful.
- Folder names are lowercase (`docs/module-planning/`, `docs/module-planning/complete/`). Plan filenames are lowercase kebab-case (e.g. `issues-230-232-plan.md`).
- **Privacy**: this folder is committed and therefore public. No PII, no personal/internal file paths (e.g. `C:\Users\<name>\...`, OneDrive/SharePoint URLs), no customer names, no tenant/subscription IDs, no real cluster/host names, no internal-only material. Use obviously-synthetic placeholders and redact anything sensitive (note what was redacted, e.g. *"path redacted"*). The same standard as the rest of the repo applies.
- **Pre-commit scan** for any change touching `docs/module-planning/`: before staging, grep the modified plan file(s) for common PII markers, such as customer names, and confirm zero hits (or that any hits are legitimate, e.g. inside a code-block example like `C:\Users\<name>\...` showing the *forbidden* pattern). PowerShell one-liner:
  ```powershell
  Select-String -Path docs\module-planning\**\*.md -Pattern 'C:\\Users\\','OneDrive','sharepoint\.com','@microsoft\.com','tenant.{0,5}[0-9a-f-]{36}','subscription.{0,5}[0-9a-f-]{36}' -AllMatches
  ```
  If anything matches, redact it (replace with a placeholder and a short *"redacted"* note) before committing.
- `docs/module-planning/` is **excluded from the live GitHub Pages site** via `_config.yml` (still visible on github.com). Keep it excluded — planning notes aren't end-user documentation.

## Security Constraints
- **basic-ftp**: NEVER allow `basic-ftp` to regress below version **5.3.1**. Versions ≤ 5.2.2 have known security vulnerabilities (DoS in `Client.list()` via unbounded memory consumption — GHSA-rp42-5vxx-qpwr; CRLF injection in MKD command credentials — GHSA-7f3f-c83q-2pgw). The override in `package.json` (`"basic-ftp": ">=5.3.1"`) must be maintained. If any dependency change or PR attempts to downgrade this, reject it. (Originally flagged April 2026 via Dependabot PR #198; bumped to 5.3.1 May 2026 to also clear the CRLF/DoS advisories.)
- **ip-address**: NEVER allow `ip-address` to regress below version **10.1.1**. Versions ≤ 10.1.0 have an XSS vulnerability in `Address6.group()`, `Address6.link()`, and `parseMessage` (GHSA-v2v4-37r5-5v8g / CVE-2026-42338). Pulled in transitively as a dev-only dependency via `puppeteer → @puppeteer/browsers → proxy-agent → socks-proxy-agent → socks → ip-address`. The override in `package.json` (`"ip-address": ">=10.1.1"`) must be maintained. If any dependency change or PR attempts to downgrade this, reject it. (Flagged May 2026 via Dependabot alert #13.)
- **fast-uri**: NEVER allow `fast-uri` to regress below version **3.1.2**. Versions ≤ 3.1.1 have two high-severity URI-parsing issues: path traversal via percent-encoded dot segments (GHSA-q3j6-qgpj-74h6 / CVE-2026-6321, patched in 3.1.1) and host confusion via percent-encoded authority delimiters (GHSA-v39h-62p7-jpjc / CVE-2026-6322, patched in 3.1.2). Pulled in transitively via `html-validate → ajv` and `stylelint → table → ajv`. The override in `package.json` (`"fast-uri": ">=3.1.2"`) must be maintained. If any dependency change or PR attempts to downgrade this, reject it. (Flagged May 2026 via Dependabot alerts #14 and #15.)
- **brace-expansion**: NEVER allow the `brace-expansion` **5.x** line to regress below version **5.0.6**. Versions `>= 5.0.0, < 5.0.6` apply the `max` DoS guard too late, so expanding a large numeric range like `{1..10000000}` still allocates ~505 MB and spends ~800 ms building the full intermediate array before truncation (GHSA-jxxr-4gwj-5jf2 / CVE-2026-45149). Pulled in transitively via `html-validate → glob → minimatch → brace-expansion@5`. The override in `package.json` uses a **version-selector** form (`"brace-expansion@>=5.0.0 <6.0.0": "5.0.6"`) on purpose — it pins only the vulnerable **5.x** line while leaving the unaffected **1.x** line (`brace-expansion@^1.1.x`, used by `minimatch@3` in the eslint toolchain) untouched. Do NOT replace this with a name-nested override (e.g. `"html-validate": { "brace-expansion": ... }`): npm 10 (CI's Node 22) and npm 11 (local Node 24) resolve nested/scoped overrides differently, producing divergent lockfiles that break CI's `npm ci` ("lock file's brace-expansion@1.1.13 does not satisfy brace-expansion@5.0.6"). The selector form resolves identically across npm 10/11. Do NOT use a global `brace-expansion` override either — that would force 1.x consumers onto 5.x. If any dependency change or PR attempts to downgrade the 5.x line, reject it. (Flagged June 2026 via Dependabot alert #16; selector form adopted June 2026 to fix cross-npm-version `npm ci` divergence on PR #236.)

## GitHub Pages Publication (`_config.yml`)
- The live site at `https://azure.github.io/odinforazurelocal/` is built by GitHub Pages using Jekyll. The root `_config.yml` file controls which folders/files are **excluded** from publication (currently: `tools/`, `scripts/`, `tests/`, `test-results/`, `docs/archive/`, `node_modules/`, `package*.json`, lint configs, `CONTRIBUTING.md`).
- **Do not remove `_config.yml`** and do not add a `.nojekyll` file — doing either disables the `exclude:` mechanism and will re-publish local-only dev tooling to the public site.
- **Underscore caveat**: Jekyll **automatically ignores any file or folder whose name starts with an underscore** (e.g. `_drafts/`, `_layouts/`, `_anything.js`). Never create site assets (HTML, JS, CSS, images, SVGs) with a leading underscore — they will silently fail to publish. If you must, add an explicit `include:` entry in `_config.yml`.
- When adding new top-level folders that the live site needs, verify they are **not** in the `exclude:` list in `_config.yml`. When adding new folders that are local-dev-only (build scripts, test harnesses, tooling), **add them to `exclude:`** to keep the published surface minimal.
- After changes that touch routing, new folders, or new asset paths, verify the site still works on the published GitHub Pages URL after the next deploy — Jekyll exclusion issues only show up post-publish.

## Demo Video Tooling (Playwright, `tools/` folder)
- The `tools/` folder contains [Playwright](https://playwright.dev/) (Apache 2.0, Microsoft) for scripted browser demos that produce short walkthrough videos (e.g. for LinkedIn, README GIFs). See `tools/README.md` for usage.
- **`@playwright/test` is a `devDependency` only.** It must NEVER be promoted to `dependencies`, referenced from any `<script>` tag, or bundled into the published site. It only runs locally via `npm run demo:sizer`.
- **`tools/` is excluded from GitHub Pages** via `_config.yml`. Do not remove that entry, and do not add the folder to any `href=` / `src=` / `fetch()` on the live site.
- **Demo scripts must only target `http://localhost:5500`.** Never script against the deployed GitHub Pages URL or any authenticated site — Playwright recordings capture everything on screen (tokens, cookies, notifications, other tabs).
- **No credentials, tokens, tenant IDs, subscription IDs, real customer data, or private IP ranges in demo scripts, fixtures, or committed test inputs.** Use obviously-dummy values (e.g. `Demo SQL Server VMs`).
- **Never commit rendered videos.** `tools/output/` is git-ignored; keep it that way. Review any generated `.webm` / `.mp4` before posting externally to confirm no private info (other tabs, notifications, clipboard) leaked into the recording.
- When adding new demos, keep them < 60s runtime, use visible-text selectors (`getByRole`, `getByText`) over brittle CSS selectors, and add `slowMo` / `waitForTimeout` only as needed for readability.

## Coding Standards
- Only make changes directly related to the task. Don't "improve" adjacent code, comments, or formatting, without asking.
- Match the existing code style, even if you'd do it differently.
- No abstractions, helpers, or configurability for single-use code.
- If your changes make imports, variables, or functions unused, remove them. Don't remove pre-existing dead code without asking first, but if you add new dead code, remove it.
- Before implementing, state assumptions. If multiple approaches exist, present the tradeoffs — don't pick silently.
- After making all changes and committing, verify the code by running `node scripts/run-tests.js` to confirm all 958+ tests pass, and that the new code is covered by tests. If you add new functionality, add tests for it.
- If you need to make a breaking change, that would impact users, first raise it in the prompt to discuss it.
- Consider this website is used on mobile devices, so ensure that any changes to the UI are responsive and work well on smaller screens.
- When changes are made to the Designer, or Sizer, ensure that the interactions between them are fully considered and tested, to prevent any unintended consequences or bugs, for example, if you make a change to the Designer, ensure that it does not break any existing functionality in the Sizer, and vice versa.

## Architecture & Build Model
- **This is a plain HTML/CSS/JS static site.** There is **no bundler, no transpiler, no TypeScript, no module system** — files are loaded directly via `<script src="...">` tags, and functions are exposed on the global scope (e.g. `addWorkload()`, `showChangelog()`, called from inline `onclick=` handlers).
- **Do not introduce** webpack, Vite, Rollup, esbuild, Parcel, TypeScript, Babel, ES modules (`import`/`export`), JSX, or any framework (React, Vue, Svelte, etc.) without explicit approval. These would require restructuring every HTML page and break the "clone-and-open" workflow that end users rely on for offline use.
- New JS files go in the appropriate folder (`js/`, `sizer/`, `switch-config/`, etc.) and are referenced from the relevant HTML page. Keep functions global unless there's a strong reason to scope them.
- Runtime state lives in `localStorage` and in-memory globals. Do not add client-side state libraries (Redux, Zustand, etc.).

## Linting & Validation (must pass before push)
CI (`.github/workflows/test.yml`) runs ESLint on all browser-facing JS (`js/`, `arm/`, `report/`, `sizer/`, `switch-config/`, `docs/outbound-connectivity/`), the full test suite, and HTML validation on every PR. Local pre-push checks that mirror CI:
```powershell
npx eslint "js/*.js" "arm/*.js" "report/*.js" "sizer/*.js" "switch-config/**/*.js" "docs/outbound-connectivity/*.js"
npx html-validate "**/*.html"        # must pass — run after any .html edit
node scripts/run-tests.js            # must show 958/958 passed
```
- Zero **errors** are allowed; warnings are tolerated (legacy `var`, indentation, etc.). Don't introduce new warnings in new code — use `let`/`const`, follow existing indentation.
- Do not disable lint rules inline (`// eslint-disable-line`) without a comment explaining why.
- Do not modify `.eslintrc.json` or `.htmlvalidate.json` to make errors go away — fix the underlying issue or, for pre-existing structural patterns, downgrade specific rules with justification.
- Node.js scripts (under `scripts/`, `tools/`) are not linted by CI. `tools/` has its own `.eslintrc.json` with `env.node = true` so local broad-scope lints (`npx eslint tools/`) still pass.

## CHANGELOG & Version Discipline
- Every user-visible change gets an entry in `CHANGELOG.md` under the **current unreleased version heading** at the top of the file (create a new `## Version X.Y.Z` section if one doesn't exist for the in-progress release).
- When a version ships, the latest version stays at the top of `README.md`'s release-notes section; **older versions move to "Appendix A — Version History"** at the bottom of `README.md` (do not leave multiple active release-notes sections in the top half of the README).
- Version numbers must be bumped consistently in all of: `README.md` (header + appendix anchor), `CHANGELOG.md`, `index.html` (visible version string + "What's New" JS block), and `sizer/index.html` (visible version string). Also keep the in-code version constants in step: `WIZARD_VERSION` in `js/script.js` (stamped into Designer JSON exports + report footer) and `SIZER_VERSION` in `sizer/sizer.js` (note: `SIZER_VERSION` is the Sizer *payload-format* integer, bumped only when the export shape changes — not on every release).
- Commit messages: imperative mood, ≤72 char summary line, reference PR/issue numbers where relevant (e.g. `Fix storage-tier validation (#201)`).

## JSON Schemas (`docs/json-schema/`) — keep in sync with Sizer / Designer changes
The repo ships two public JSON Schemas that describe the export/import payloads:
- [`docs/json-schema/odin-sizer.schema.json`](../docs/json-schema/odin-sizer.schema.json) — Sizer "Export JSON" payload. Source of truth: `getSizerState()` in `sizer/sizer.js`, per-workload shapes from `addWorkload()` / the `WORKLOAD_DEFAULTS` block.
- [`docs/json-schema/odin-design.schema.json`](../docs/json-schema/odin-design.schema.json) — Designer "Export JSON" envelope + `state`. Source of truth: the Designer export path in `js/script.js` (stamped with `WIZARD_VERSION`).

These are linked from the README and are the only public contract for third parties (and our own importers) consuming ODIN JSON. **CI guards STRUCTURAL drift** — `scripts/run-tests.js` fails the build if a top-level field on `getInitialWizardState()` / `getSizerState()` is missing from (or extra in) the matching schema, or if a new workload type is added to `WORKLOAD_DEFAULTS` without being added to the Sizer schema's `type` enum. **Value-level drift is NOT CI-enforced** — new enum values on existing fields, new per-workload fields, or envelope-shape changes will silently slip through until a downstream consumer breaks. Keep those in sync manually.

**Update the schema in the same PR** as any change that:
- Adds a new workload `type` (Sizer) — add it to the `type` enum AND add a new `oneOf` branch describing its fields. The CI drift check will fail the build if you forget the enum half. Example: GHEL was added in v0.22.62 but the schema wasn't updated until a follow-up PR — the CI guard was extended at the same time to catch this class of drift going forward.
- Adds/removes/renames a field on an existing workload, on `sizerState`, or on the Designer `state` object.
- Adds a new value to any existing `enum` (e.g. a new `clusterType`, `gpuType`, `cpuManufacturer`, `storageConfig`, `resiliency`, AVD `profile`, Foundry `engine`/`modelClass`, etc.).
- Changes the accepted shape of an envelope (wrapped vs bare, new top-level metadata keys, new required fields).
- Bumps `SIZER_VERSION` in `sizer/sizer.js` or `WIZARD_VERSION` in `js/script.js` — update the matching `version` field description in the schema and note the reason in the same place the in-code constant is commented.

**Schema-version bumps are decoupled from release version.** The schema `$id` URL and structure don't need a release bump — but if you make a breaking change to the schema shape (rename/remove a required field), call it out in the CHANGELOG entry so external consumers see it.

**Validation tip** (optional, local-only): after editing a schema, sanity-check it against a representative export by running it through any JSON-Schema validator (e.g. `npx ajv-cli validate -s docs/json-schema/odin-sizer.schema.json -d <exported.json>` — `ajv-cli` is not a project dependency, install ad-hoc). The importers are deliberately permissive (`additionalProperties: true`, most fields nullable) so a stricter schema than the importer is fine; a looser one isn't.

## External Network Calls & Telemetry
- The site's only external runtime calls are **Firebase (anonymous page-view and counter stats)** and **image/font assets served from the repo itself**. Do not add new third-party `<script>` tags, `fetch()` / `XMLHttpRequest` to external domains, analytics SDKs, ad networks, or telemetry beacons without explicit approval in the prompt.
- All other data stays client-side in `localStorage` — do not introduce backend calls, serverless endpoints, or cross-origin POSTs.
- Do not add or reference new CDN URLs for JS libraries; vendor the code locally if it's truly needed.

## Accessibility (a11y)
- This is a public Microsoft tool — keyboard and screen-reader support is required.
- Preserve existing `aria-*` attributes, `role=` attributes, `alt=` text, and `<label for="...">` associations. If you remove one, add an equivalent replacement.
- All interactive elements must be reachable by Tab and activatable by Enter/Space. Do not use `<div onclick>` as a substitute for `<button>`.
- After UI changes, Tab through the modified screen to confirm focus order is sensible and nothing is keyboard-trapped.
- Maintain sufficient color contrast (WCAG AA) — rely on the existing CSS variables rather than picking new colors.

## Theming & CSS
- Use the **existing CSS custom properties** defined in `css/style.css` for all colors (e.g. `var(--accent-blue)`, `var(--success)`, `var(--bg-primary)`, `var(--text-primary)`). Do not hardcode hex values in new CSS or inline styles.
- Light/dark mode is driven by `js/theme.js`. New UI must render correctly in both themes — verify by toggling the theme after changes.
- Prefer adding new variables to `css/style.css` over hardcoding, if a truly new color is needed.

## Generated Files — Do Not Hand-Edit
Several asset folders are produced by scripts in `scripts/` and will be overwritten on the next regeneration. Edit the **source generator**, not the output.
- `images/disaggregated/*.svg` — generated by `scripts/export-*.js`
- `docs/disconnected-operations/aldo-*.svg` — exported from the `.drawio` source files in the same folder via `scripts/export-intent-svgs.js`, `export-switchless-svgs.js`, `export-1wl-svgs.js`, `export-4storage-svgs.js`, `export-single-node-wl-svgs.js`
- Any `*.svg` next to a same-named `*.drawio` is a generated export
If you need to change one of these outputs, update the `.drawio` source (or the generator script) and re-run the export, then commit both the source change and the regenerated asset in the same commit.