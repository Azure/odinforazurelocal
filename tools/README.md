# Demo Video Tools

Playwright-based scripted browser demos for generating short walkthrough videos of ODIN (e.g. for LinkedIn posts, README GIFs, conference talks).

## What's included

- **Playwright** (Apache 2.0, Microsoft) — headed browser automation + native video recording (`.webm`)
- **`demos/sizer-walkthrough.spec.js`** — scripted end-to-end walkthrough of the Sizer
- **`playwright.config.js`** — 1080p viewport, video always on, slowed-down actions for readability

Output videos land in `tools/output/` (git-ignored).

## One-time setup

From the **repo root**:

```powershell
npm install
npx playwright install chromium
```

> `npx playwright install chromium` downloads the Chromium build Playwright uses. This is required on every machine and is not tracked in `package.json`.

**For LinkedIn (MP4):** install [ffmpeg](https://ffmpeg.org/) separately — it's not bundled with Playwright.

```powershell
winget install --id=Gyan.FFmpeg -e
```

## Record a demo

In one terminal, start the static web server:

```powershell
pwsh -NoProfile -File .\tests\serve.ps1 -Port 5500
```

In a second terminal, run the demo:

```powershell
npm run demo:sizer
```

The recording is written to `tools/output/<spec-name>/video.webm`.

## Convert WebM → MP4 for LinkedIn

LinkedIn does **not** accept `.webm`. Convert with ffmpeg:

```powershell
npm run demo:convert
```

This produces `tools/output/sizer-walkthrough.mp4` (H.264, AAC audio-less, yuv420p — the profile LinkedIn prefers).

### LinkedIn video specs (reference)
- Format: MP4 (H.264 + AAC)
- Max size: 5 GB, max length: 10 min (feed posts)
- Aspect ratio: 16:9 works well on desktop feed
- Min resolution: 256×144 / Max: 4096×2304

Our default 1920×1080 @ the Playwright default 25 fps fits comfortably inside these limits.

## Writing new demos

Copy `demos/sizer-walkthrough.spec.js` and adjust. Tips for readable demos:

- Use `await page.waitForTimeout(800)` between major actions so viewers can follow
- Prefer clicking via visible text (`getByRole('button', { name: 'Add Workload' })`) over CSS selectors when possible — more resilient
- Keep total run time < 60s for social media

## Safety rules for demo scripts

These scripts run in a real browser and are committed to a public repo. Treat them like any other production code:

- **Only script against `http://localhost:5500`.** Never point a demo at an authenticated or private URL — recordings capture everything on screen, including tokens, cookies, and session data.
- **No credentials, tokens, or secrets in scripts or test data.** Use dummy values (e.g. `Demo SQL Server VMs`) for any text input.
- **Review the generated video before posting.** Confirm no private info (other browser tabs, notifications, clipboard) was captured.
- **Keep recordings out of git.** The `output/` folder is already in `tools/.gitignore`; don't add it back.

## Published site exclusion

The `tools/` folder is excluded from GitHub Pages via the root-level [`_config.yml`](../_config.yml), so nothing in here is served from `https://azure.github.io/odinforazurelocal/`. The source remains public on GitHub (same as any other repo file), but visitors to the live site cannot download demo scripts by guessing URLs.

## Licensing

- **Playwright**: Apache 2.0 — free for commercial use
- **ffmpeg**: LGPL/GPL depending on build — free for commercial use (the Gyan builds commonly installed on Windows are GPL)
