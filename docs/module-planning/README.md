# Module Planning

This folder holds **in-flight planning notes** for ODIN features and changes —
design sketches, decision records, open questions, and implementation outlines
that are captured *before* code lands.

These notes are intentionally committed to the repository (not local-only) so
that contributors, reviewers, and future maintainers can see the intent behind
a change and reuse the analysis later.

## Layout

```
docs/module-planning/
├── README.md                 ← this file
├── <topic>-plan.md           ← in-flight plans (one per feature / issue group)
└── complete/
    └── <topic>-plan.md       ← plans whose work has shipped (moved here after release)
```

## Workflow

1. **Before starting non-trivial work**, skim this folder. If a plan already
   exists for the area you're touching, read it — it likely contains decisions,
   tradeoffs, and open questions that affect the implementation.
2. **For new multi-step or cross-file work**, capture a short plan here (a
   single `.md` file is fine). Include: current state, proposed change, files
   touched, open questions, and a rough implementation order.
3. **When the work ships** (PR merged, version released), move the plan into
   [`complete/`](complete/) so the top level stays focused on what's still
   in-flight. Don't delete the plan — the history is useful.

## Privacy & content rules

These notes are **public** (the repository is public). Treat them like any
other committed file:

- **No PII** — no usernames, personal file paths, customer names, tenant IDs,
  subscription IDs, internal URLs, OneDrive / SharePoint links, or anything
  that identifies a specific customer or internal system.
- **No real customer data** — no extracted inventories, no real cluster
  names, no real hostnames or IPs. Use obviously-synthetic placeholders.
- **No internal-only material** — no copy-paste from internal Microsoft
  decks, design docs, or chat threads unless that content is also publicly
  available.
- When in doubt, redact and add a short note explaining what was removed
  (e.g. *"path redacted; file remained on contributor's machine"*).

If you spot something here that shouldn't be public, raise it in a PR or
issue — sanitising a plan is a normal, encouraged change.

## Publication

This folder is **excluded from the live GitHub Pages site** via
[`_config.yml`](../../_config.yml) (it's still visible on github.com, but
won't appear at `https://azure.github.io/odinforazurelocal/`). Keep it that
way — planning notes aren't end-user documentation.
