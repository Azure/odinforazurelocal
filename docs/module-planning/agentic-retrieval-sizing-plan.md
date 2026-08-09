# Agentic Retrieval sizing alignment plan

Status: in progress for v0.23.02.

## Current state

The Sizer persists Agentic Retrieval as workload type `edgerag`. Its current
`gpu` / `cpu` compute modes both model four identical worker VMs, and GPU mode
assigns one GPU to every worker. That no longer matches the current public
Microsoft Learn requirements, which separate CPU workers, embedding GPU
workers, and the external language-model endpoint.

The scheduled dependency-audit workflow also blocks on newly published
`js-yaml` and `nanoid` advisories. Patched `brace-expansion` releases that were
previously unavailable are now present in the configured package feed.

## Proposed change

- Keep the persisted `edgerag` type for compatibility.
- Replace the UI's compute-mode choice with deployment modes: `combined`,
  `knowledge`, and `agentic`.
- Model three CPU workers at 8 vCPU / 32 GB each for all modes.
- Add two A2/A16 embedding GPU workers for Combined and Knowledge modes;
  Agentic mode has no embedding GPU workers.
- Add an explicit language-model endpoint choice: external, Foundry Local
  minimum, or Foundry Local production. Local choices add the documented
  dedicated model-host CPU, RAM, storage, and GPU capacity.
- Treat old exports that only contain `computeMode` as Combined with an
  external endpoint. This preserves their prior omission of LLM capacity.
- Keep the 1.5x corpus storage multiplier clearly identified as an ODIN
  estimate rather than a Microsoft hardware requirement.
- Restrict Agentic Retrieval embedding GPU selection to A2 and A16.
- Update report output, JSON Schema, tests, release documentation, and version
  surfaces together.
- Raise dependency floors where fixes are available and keep only a narrowly
  scoped temporary exception for the unavailable `nanoid` fix.

## Documentation interpretation

The Learn page's minimum-capacity summary lists one GPU worker for Combined,
but its explicit VM topology, deployment-mode matrix, on-premises resource
table, and GPU-purpose table require two GPU-enabled VMs: one for text
embedding and one for image processing. The Sizer will use the repeated,
purpose-specific two-GPU topology and expose that assumption in the UI.

## Files touched

- `sizer/sizer.js`
- `tests/index.html`
- `docs/json-schema/odin-sizer.schema.json`
- `report/report.js`
- `report/pptx-export.js`
- `package.json` and `package-lock.json`
- `scripts/check-npm-audit.js`
- `js/version.js`, `js/changelog.js`, `README.md`, and `CHANGELOG.md`

## Implementation order

1. Add focused sizing and validation tests, then update the Sizer model and UI.
2. Update schema and report/PPTX renderers for the new persisted fields.
3. Update dependency floors and the package-scoped audit exception.
4. Bump all release surfaces to v0.23.02 and document the behavior change.
5. Run lint, HTML validation, the policy-aware dependency audit, and the full
   repository test suite.

## Open questions

- Confirm the 1.5x corpus-storage estimate with the Agentic Retrieval product
  team; it remains user-visible as an estimate until a published formula exists.