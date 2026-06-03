# Sizer — Foundry Local refresh + GitHub Enterprise Local plan (COMPLETE)

Status: **complete** — shipped in **v0.22.62** (PR [#247](https://github.com/Azure/odinforazurelocal/pull/247), Jun 2026).
Source: Build 2026 sovereign-AI announcements (Jun 2026 Azure Arc blog posts).

Originally part of `sizer-foundry-ghel-m365-plan.md`; split out and moved here
once both pieces shipped. The remaining M365 Local portion lives in
[`docs/module-planning/sizer-m365-local-plan.md`](../sizer-m365-local-plan.md).

## Why

Three public Tech Community blogs (Jun 2026) expanded Foundry Local on Azure
Local, and a fourth introduced **GitHub Enterprise Local** (public preview).
This plan reviewed what the Sizer listed for **Foundry Local**, aligned it with
the announcements, and added **GitHub Enterprise Local** as a new Sizer workload.

Reference blogs:
- Build/deploy/govern sovereign AI with Foundry Local — `techcommunity…/4522945`
- Scale on-prem AI: multi-node inference + vLLM — `techcommunity…/4516692`
- Agentic Retrieval in Foundry Local — `techcommunity…/4523646`
- Introducing GitHub Enterprise Local (Preview) — `techcommunity…/4523046`

---

## 1. Foundry Local — content refresh (SHIPPED)

All in [`sizer/sizer.js`](../../../sizer/sizer.js) (+ button/tooltip in
[`sizer/index.html`](../../../sizer/index.html)).

### What the Sizer had before the refresh

- **Model size classes** (`FOUNDRY_MODEL_CLASSES`):
  - Small SLM — *Phi-3.5-mini, Llama-3.2-3B (~3B)* — 4 vCPU / 8 GB / 20 GB
  - Medium SLM — *gpt-oss-20b, Phi-4, Mistral-7B, Llama-3.1-8B (~7–20B)* — 8 / 16 / 40
  - Large LLM — *gpt-oss-120b, DeepSeek-R1-Distill-32B, Llama-3.3-70B Q4 (~32–120B)* — 16 / 64 / 100
  - Custom — user-specified
- **Inference engine** selector: `ONNX-GenAI (CPU or GPU)` and `vLLM (GPU only)` — already present.
- **Replicas** (1–100), **GPUs per replica** via DDA (AKS Arc-hosted, no GPU-P).
- **AKS-supported GPU filter** already enforced (T4, A2, A16, L4, L40, L40S, RTX Pro 6000).
- **Links**: preview request, "What is Foundry Local on Azure Local?" Learn doc.

Verdict was: structurally sound; **content/catalog refresh**, not re-architecture.

### Foundry changes that shipped (low risk, content only)

| # | Change | Result |
|---|--------|--------|
| F1 | Add **NVIDIA Nemotron** to medium/large model-class examples and tooltip | Done — Nemotron now in Medium class. |
| F2 | Add **Phi-4-reasoning** and **Whisper / Qwen3** to catalog examples | Done — Phi-4-reasoning in Medium; Whisper + Qwen3 ranges across Small/Medium. |
| F3 | Multi-node scheduling hint in the modal copy | Done — "scheduled across cluster-wide GPU / CPU capacity for multi-node inference". |
| F4 | Refresh "Learn more" links block | Done — *What is Foundry Local on Azure Local?*, *AI workloads on Azure Local* (overview), *Build 2026 announcement*, *Multi-node inference, vLLM & expanded model catalog*, *Agentic Retrieval, Knowledge & Chat UI in Foundry Local*. |
| F5 | Tooltip wording: ONNX = CPU/GPU broadest compat; vLLM = GPU high-throughput multi-user | Done — engine-choice tooltip clarified in the Foundry workload modal. |

### Catalog-accuracy correction (post-initial-edit)

Initial F1–F5 used model names that turned out **not** to be in the actual
Foundry Local catalog blog (Llama 3.x variants, Qwen3-72B, Nemotron-Super).
A second pass (follow-up commit in the same PR) corrected the lists against
blog 4516692's catalog table:

- **Small** — Phi-3.5-mini, Phi-4-mini, Phi-4-mini-reasoning, Qwen3 (0.6b–14b), Qwen2.5, Whisper (~1–7B params).
- **Medium** — Phi-4, Phi-4-reasoning, gpt-oss-20b, Mistral-7B-v0.2, DeepSeek-R1 (7b/14b), NVIDIA Nemotron (~7–20B params).
- **Large** — gpt-oss-120b (vLLM-only), plus larger BYO models served via vLLM on GPU (~30–120B+ params).
- Dropped (not in catalog): Llama-3.2-3B, Llama-3.1-8B, Llama-3.3-70B Q4, Qwen3-72B, Nemotron-Super.

Engine-choice rule confirmed from the catalog + Learn AI Workloads overview:
- **ONNX-GenAI** is the default engine — CPU or GPU; covers all Small/Medium SLMs.
- **vLLM** is GPU-only and required for `gpt-oss-120b` (and other catalog rows
  flagged vLLM-only); recommended on GPU for batched multi-user throughput
  even where ONNX-GenAI would also work.
- You never *skip* the engine — every model is served by exactly one of them —
  but for Small/Medium models the default ONNX-GenAI choice is fine.

### Open question that closed during implementation

> Do we want a separate **Agentic Retrieval** mention?

Resolved: **no new workload.** Agentic Retrieval is the evolution of Edge RAG
and is now surfaced via the new *Agentic Retrieval, Knowledge & Chat UI in
Foundry Local* link in the Foundry modal. The existing Edge RAG workload
unchanged. No sizing impact.

### Out of scope (intentional)

- No sizing-constant changes — the presets remain conservative rules-of-thumb
  (the blogs give no per-model RAM/GPU figures; vLLM planner auto-sizes at
  deploy).
- No `SIZER_VERSION` bump from the Foundry refresh — content only, export shape
  unchanged. (`SIZER_VERSION` was bumped 1 → 2 for the GHEL fields in the same
  release; see section 2.)

---

## 2. GitHub Enterprise Local — NEW Sizer workload (SHIPPED)

GHEL was previously in the **reference-architectures** (Knowledge tab) only.
The blog describes it as a **prebuilt GHES VM image** on Azure Local —
single-node (PoC) or multi-node (VM-level HA). That maps cleanly onto the
Sizer's existing **VM** workload model, so it shipped as a **dedicated workload
type that produces one (or a failover pair of) sized VM(s)**, analogous to how
`foundry` / `edgerag` / `videoindexer` are specialised presets.

### Sizing model (from the blog + GHES min-recommended reqs)

Sized by **active user count** per GitHub's GHES *minimum recommended
requirements* doc. Tiers that shipped:

- Trial / very small
- ≤ 500 seats
- 500–3000 seats
- 3000–5000 seats
- 5000–8000 seats
- 8000–10000 seats

(See `GHEL_TIERS` in [`sizer/sizer.js`](../../../sizer/sizer.js) for the exact
vCPU / memory / storage numbers — pulled from the linked GitHub doc.)

User-exposed inputs:

- **Active developers / seats** — drives the tier table.
- **HA** Yes/No basic dropdown.
- **Advanced configuration** panel (collapsible `<details>`) — **0–7 replicas**
  (1 primary + N) with a link to the GHES HA docs and a throughput note.
- Workload-card detail line shows the active topology (HA pair, Primary + N
  replicas) and a `(sizing info)` link straight to the GHES sizing reference.

### Files touched (GHEL — shipped)

- [`sizer/index.html`](../../../sizer/index.html) — new workload-type tile
  (Preview), tooltip, empty-state legend entry, GHEL icon reference.
- [`sizer/sizer.js`](../../../sizer/sizer.js) — `WORKLOAD_DEFAULTS.ghel`,
  `GHEL_TIERS`, `getGhelModalContent()`, save/restore/summary handling, and
  inclusion in the aggregate compute/memory/storage roll-up. GHEL is a plain
  Hyper-V VM (not AKS-hosted) → excluded from `AKS_HOSTED_WORKLOAD_TYPES`,
  normal VM placement, no GPU by default.
- [`sizer/sizer.css`](../../../sizer/sizer.css) — `.workload-icon.ghel` styling.
- `images/` — GHEL icon committed alongside.
- Links embedded: GHES min-recommended reqs, GHES HA docs.

### `SIZER_VERSION` 1 → 2

The new `tier` / `ha` / `replicas` fields on GHEL workloads change the Sizer
export payload shape, so `SIZER_VERSION` bumped 1 → 2. The Sizer importer
continues to accept v1 payloads (forward-compatible).

### Open questions resolved during implementation

1. **Exact GHES min-recommended tier numbers** — pulled from the GitHub doc at
   implementation time; baked into `GHEL_TIERS`.
2. **v1 scope: self-hosted Actions runners** — deferred. GHEL workload models
   the GHES VM(s) only; runners can be added as plain VM workloads alongside.
3. **Homogeneous-GPU rule** — GHEL is CPU-only; excluded from the AKS GPU
   filter, treated like a plain `vm` without GPU.

---

## Related sub-decisions that also shipped in v0.22.62

These were added to the same release PR but planned/tracked separately:

- **"Info: Sizer hardware scaling weighting logic" popup** in the *Physical
  Node(s) – Example Hardware Configuration* section, documenting the auto-scaler's
  rules (1.5 TB / 2 TB memory cap, cores → sockets → ratio escalation, two-pass
  memory limits, the 768 GB 3-node preference, the 16-node auto-upgrade to
  Disaggregated Storage, and the step-back-down reduction loop). Includes an
  explicit override note: every auto-decision is advisory.
- **2-node memory-density 3-node preference** — `NODE_WEIGHT_2NODE_MEMORY_DENSITY_THRESHOLD_GB = 768`.
  When the conservative auto-scale pass lands on 2 nodes but per-node memory has
  climbed above 768 GB, the Sizer auto-bumps to 3 nodes to unlock a three-way
  mirror; reverts if 3 nodes would push any resource over 90 % utilisation or
  the user has pinned the node count.
- **Hardware Requirements Summary label renames** and workload-card reorder.
- **Stable "What's New" anchor + TOC entry** in `README.md`.

---

## Implementation order that was actually followed

1. **GHEL workload** + popup + 768 GB rule + label renames + What's New anchor —
   commit `5355a70`.
2. **Foundry Local content refresh** (F1–F5) — commit `95d0213`, with the
   catalog-accuracy correction applied in the same commit after fetching the
   blog catalog table end-to-end.
3. CHANGELOG / README / What's-New entries updated under the 0.22.62 block in
   both commits.
4. Version constants synced: `WIZARD_VERSION`, `SIZER_VERSION` (1 → 2),
   visible version strings in `index.html` and `sizer/index.html`.
5. Validation: `node scripts/run-tests.js` → **1325 / 1325 passing**,
   `npx eslint` → 0 errors, `npx html-validate "**/*.html"` → clean.
6. PR [#247](https://github.com/Azure/odinforazurelocal/pull/247) opened
   Release → main; merged manually per repo convention (no auto-merge).

## Cross-surface notes verified

- New workload type touches save/load (localStorage), summary, 3D rack viz, and
  export paths — mirrored the existing `vm` shape and added unit tests for the
  GHEL tier lookup + HA/replicas handling.
- GHEL excluded from the AKS-hosted GPU filter and homogeneous-GPU validator.
- Designer ↔ Sizer: GHEL is Sizer-only; no Designer coupling required.
