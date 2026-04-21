# Copilot Instructions

## Git Operations
- Always use Git CLI commands in the terminal for all git operations
- Do not use MCP tools or other git integrations, such as Kraken
- Do not use pwsh commands for PowerShell 7, as they may not work in all environments
- Use `git status` to check the status of your repository before making any commits
- When updating the version number, ensure that it is updated in all relevant files, such as the `README.md`, `CHANGELOG.md`, and the index.html and What's New section in the java script code.
- When making updates use the Release Branch and create a pull request to merge it into the main branch. Do not commit directly to the main branch. Try to avoid creating additional branches, to prevent merge conflicts and maintain a clean commit history.
- When creating a pull request, ensure that it includes a clear description of the changes made and the reason for the changes. This will help reviewers understand the context of the changes and provide feedback more effectively.
- Before starting new work, always pull the latest changes from the main branch into Release Branch to ensure that you are working with the most up-to-date codebase, fast-forward merge. This will help prevent merge conflicts and ensure that your changes are based on the latest version of the code.
- When adding new release notes to the top of the readme, for each new release, ensure that we move the existing / old versions to only exist in the appendix of the readme, and only the latest version is at the top of the readme. This will help keep the readme organized and make it easier for users to find the latest release notes.
- PRs should be merged manually by the author, after all checks have passed and any necessary approvals have been obtained. Do not use auto-merge features, as they may merge PRs before they are ready or without proper review.

## Security Constraints
- **basic-ftp**: NEVER allow `basic-ftp` to regress below version **5.2.2**. Version 5.2.1 and below have known security vulnerabilities. The override in `package.json` (`"basic-ftp": ">=5.2.2"`) must be maintained. If any dependency change or PR attempts to downgrade this, reject it. (Flagged April 2026 via Dependabot PR #198)

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
CI (`.github/workflows/test.yml`) runs ESLint on `js/*.js`, the full test suite, and HTML validation on every PR. Local pre-push checks that mirror CI:
```powershell
npx eslint js/*.js                   # must pass — CI blocks the PR on lint errors here
npx html-validate "**/*.html"        # must pass — run after any .html edit
node scripts/run-tests.js            # must show 958/958 passed
```
- Do not disable lint rules inline (`// eslint-disable-line`) without a comment explaining why.
- Do not modify `.eslintrc.json` or `.htmlvalidate.json` to make errors go away — fix the underlying issue.
- Node.js scripts (under `scripts/`, `tools/`) are not linted by CI. `tools/` has its own `.eslintrc.json` with `env.node = true` so local broad-scope lints (`npx eslint tools/`) still pass.

## CHANGELOG & Version Discipline
- Every user-visible change gets an entry in `CHANGELOG.md` under the **current unreleased version heading** at the top of the file (create a new `## Version X.Y.Z` section if one doesn't exist for the in-progress release).
- When a version ships, the latest version stays at the top of `README.md`'s release-notes section; **older versions move to "Appendix A — Version History"** at the bottom of `README.md` (do not leave multiple active release-notes sections in the top half of the README).
- Version numbers must be bumped consistently in all of: `README.md` (header + appendix anchor), `CHANGELOG.md`, `index.html` (visible version string + "What's New" JS block), and `sizer/index.html` (visible version string).
- Commit messages: imperative mood, ≤72 char summary line, reference PR/issue numbers where relevant (e.g. `Fix storage-tier validation (#201)`).

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