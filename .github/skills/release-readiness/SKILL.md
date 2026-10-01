---
name: release-readiness
description: 'Complete ODIN release documentation and validation checks before declaring user-visible work complete, preparing a release, or opening the Release-to-main pull request.'
---

# Release Readiness

Use this shared checklist alongside the relevant Designer, Sizer, and PowerPoint
skills. It does not replace their scenario matrices.

## Release documentation

For every user-visible change, including additions to an already-numbered
unreleased version:

1. Update the current entry in `CHANGELOG.md`.
2. Review and update the current README What's New summary and the current
   in-app entry in `js/changelog.js` so their feature/fix coverage is accurate.
   Summaries can be shorter than the detailed changelog; do not require identical
   wording or duplicate historical entries.
3. If a surface needs no change, explain why in the PR checklist. An unchanged
   version number is not a reason to omit newly added features.
4. Check `ODIN_VERSION` in `js/version.js` against all three release surfaces.
   Only bump the version when preparing an application release.
5. On a version bump, move the previous README summary to
   `docs/version-history/README.md`. Keep only the current release in the README.
6. Review the rendered What's New dialog, not just its source text.

The release-history guard verifies version/rollover structure, not whether the
summaries describe every meaningful change. Content coverage still needs review.

## Validation gates

Run from the repository root:

```powershell
npm run lint:js
npm run lint:html
npm run lint:css
npm run test:runner
node scripts/run-tests.js
npm run test:http
git diff --check
```

`test:http` starts an isolated loopback server on an available port and shuts it
down afterward. The harness must signal completion of all enabled tests; a
non-zero count, a loaded page, or a successful download is not completion.
Unhandled browser errors, rejected promises, inconsistent counts, and completion
timeouts fail validation.

The file-mode suite preserves offline coverage. HTTP integration checks add
coverage; neither replaces real-control end-to-end scenarios.

For changed workflows, run the relevant smoke path and its inverse. Before a
release, run both complete Designer and Sizer matrices. Rerun affected scenarios
after subsequent changes, including changes to shared CSS or dialog helpers.

## Evidence and failures

Record the tested revision/worktree, scenario, expected result, observed result,
viewport/theme, and one status: **passed**, **failed**, **blocked**, or **not run**.
Separate focused smoke coverage from complete release coverage. Include test
counts, console/page errors, output checks, and unresolved limitations in the PR.

For failures, retain synthetic reproduction inputs and runner diagnostics and
screenshots from `test-results/` (HTTP artifacts are in `test-results/http/`).
Do not commit generated artifacts. Add a focused automated regression for each
UI defect; repeat the exact real-control reproduction after fixing it.

A blocked/manual check is not a pass. In particular, successful PPTX generation
or XML checks do not prove that PowerPoint opens without repair or clipping.

## Publication and privacy

- Work on `Release`; the only release PR is `Release` to `main`.
- Review status before committing and preserve other contributors' work.
- Check public guidance and fixtures for credentials, personal paths, customer
  data, private URLs, and real environment identifiers. Use synthetic examples
  and repository-relative paths.
- Keep required manual validation explicit. Do not describe the release as fully
  validated while required checks are failed, blocked, or not run.
- Push only after the gates pass.
- **Only a human may merge a pull request.** AI assistants and automation must
  never merge PRs, invoke merge commands or APIs, or enable auto-merge.
  Passing checks, approvals, or a request to prepare/finish a release do not
  authorize an agent to merge.
- Agents may prepare commits, push `Release`, address reviews, record validation
  evidence, and mark a PR ready when authorized. Stop at the readiness handoff:
  report outstanding blockers or that the PR is ready for the human author's
  manual merge. Never treat "ready" as permission to merge.
