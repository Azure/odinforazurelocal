# AI workload sizing and included infrastructure refresh

## Current state

- Foundry Local, Agentic Retrieval, and AI Video Indexer calculations already
  include a dedicated three-node AKS Arc control plane and workload workers.
  The workload cards do not expose that included substrate, so users can add a
  separate AKS workload and unintentionally size another independent cluster.
- Foundry Local uses estimated small, medium, and large model classes. Current
  Microsoft Learn guidance instead publishes minimum and recommended worker
  node capacity, model-dependent runtime sizing, and a 100 GiB default model
  cache per ModelDeployment.
- Agentic Retrieval worker counts match the explicit deployment-mode table,
  but ODIN adds an undocumented operator allowance on top of the published
  worker capacity.
- Video Indexer worker totals match the production table, but ODIN also adds an
  undocumented extension allowance on top of the published cluster-wide
  capacity.
- GitHub Enterprise Local is a standalone GHES virtual appliance, not an AKS
  workload. ODIN defaults to an HA pair even though the current deployment
  guidance starts with one GHES VM, and it does not add the documented CPU and
  memory allowances for GitHub Actions or GitHub Code Security.

## Proposed change

- Keep each specialized AI workload self-contained with one dedicated AKS Arc
  cluster. Do not create a second editable AKS workload automatically.
- Add a visible, non-editable AKS Arc infrastructure line to Foundry Local,
  Agentic Retrieval, and Video Indexer cards, and state that users should add a
  generic AKS workload only for a separate application cluster.
- Replace Foundry model-size assumptions with Microsoft minimum, Microsoft
  recommended, and custom worker profiles. Track worker count separately from
  model replicas, count the 100 GiB model cache once per ModelDeployment, and
  retain a clearly labeled platform-services allowance.
- Preserve legacy Foundry imports by mapping old model classes to the closest
  new worker profile.
- Remove undocumented Agentic Retrieval and Video Indexer overhead added above
  their published worker capacities while retaining the explicit AKS control
  plane planning assumption and fixed AKS node OS disks.
- Update GitHub Enterprise Local to GHES 3.21 guidance, default new workloads
  to one appliance VM, and add optional GitHub Actions and GitHub Code Security
  CPU/memory allowances of 25 percent each. Keep replicas optional and sized
  identically to the primary.
- Add contextual source links and plain-language included/excluded guidance in
  each affected workload dialog.

## Files touched

- `sizer/sizer.js`
- `sizer/sizer.css`
- `tests/index.html`
- `docs/json-schema/odin-sizer.schema.json`
- `report/report.js`
- `report/pptx-export.js`
- `CHANGELOG.md`
- `README.md`
- `js/changelog.js`

## Open questions resolved

- GitHub Enterprise Local does not use AKS. It runs as a GHES virtual appliance
  on Azure Local; optional replicas are active/passive and do not add write
  throughput.
- A separate AKS workload must not be added for Foundry Local, Agentic
  Retrieval, or Video Indexer unless the user intends to deploy another AKS
  cluster. Their specialized workload entries include their AKS substrate.
- Foundry Local and Agentic Retrieval can share one cluster when both
  extensions are deployed together. The Agentic Retrieval local-endpoint
  choice therefore adds model-host capacity to its included cluster rather
  than adding a second Foundry control plane.
- The three-node control plane remains an explicit ODIN production/HA planning
  assumption. Microsoft supports one, three, or five control-plane nodes.
- The review follows sizing, architecture, storage, GPU, deployment, and HA
  links referenced by the supplied articles; unrelated navigation links are
  outside this sizing audit.

## Implementation order

1. Add regression tests for included AKS metadata and refreshed calculations.
2. Update Foundry, Agentic Retrieval, Video Indexer, and GHES calculations.
3. Add workload-card and modal included-infrastructure guidance.
4. Update schemas, report output, release surfaces, and migration coverage.
5. Run ESLint, HTML validation, privacy scan, and the complete test suite.
