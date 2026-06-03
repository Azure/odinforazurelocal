# Sizer — Foundry Local refresh + GitHub Enterprise Local (+ M365 Local) plan

Status: **in-flight / proposal** — awaiting go-ahead before coding.
Source: Build 2026 sovereign-AI announcements (Jun 2026 Azure Arc blog posts).

## Why

Three public Tech Community blogs (Jun 2026) expanded Foundry Local on Azure
Local, and a fourth introduced **GitHub Enterprise Local** (public preview).
This plan reviews what the Sizer lists today for **Foundry Local**, aligns it
with the announcements, and proposes adding **GitHub Enterprise Local** (and,
optionally, **Microsoft 365 Local**) as new Sizer workloads.

Reference blogs:
- Build/deploy/govern sovereign AI with Foundry Local — `techcommunity…/4522945`
- Scale on-prem AI: multi-node inference + vLLM — `techcommunity…/4516692`
- Agentic Retrieval in Foundry Local — `techcommunity…/4523646`
- Introducing GitHub Enterprise Local (Preview) — `techcommunity…/4523046`

---

## 1. Foundry Local — current state in the Sizer

All in [`sizer/sizer.js`](../../sizer/sizer.js) (+ button/tooltip in
[`sizer/index.html`](../../sizer/index.html)).

- **Model size classes** (`FOUNDRY_MODEL_CLASSES`):
  - Small SLM — *Phi-3.5-mini, Llama-3.2-3B (~3B)* — 4 vCPU / 8 GB / 20 GB
  - Medium SLM — *gpt-oss-20b, Phi-4, Mistral-7B, Llama-3.1-8B (~7-20B)* — 8 / 16 / 40
  - Large LLM — *gpt-oss-120b, DeepSeek-R1-Distill-32B, Llama-3.3-70B Q4 (~32-120B)* — 16 / 64 / 100
  - Custom — user-specified
- **Inference engine** selector: `ONNX-GenAI (CPU or GPU)` and `vLLM (GPU only)` — **already present** ✅
- **Replicas** (1–100), **GPUs per replica** via DDA (AKS Arc-hosted, no GPU-P).
- **AKS-supported GPU filter** already enforced (T4, A2, A16, L4, L40, L40S, RTX Pro 6000).
- **Links present**: preview request (`aka.ms/FoundryLocalAzure_PreviewRequest`),
  "What is Foundry Local on Azure Local?" Learn doc.
- **Button tooltip** lists: DeepSeek, Microsoft, OpenAI, Qwen, Mistral, or BYO.

**Verdict:** structurally sound and already covers the big two (multi-node via
replicas, vLLM engine). Mostly **content/catalog refresh**, not re-architecture.

### Proposed Foundry Local changes (low risk, content only)

| # | Change | File | Notes |
|---|--------|------|-------|
| F1 | Add **NVIDIA Nemotron** to the medium/large class descriptions + button tooltip | `sizer.js`, `index.html` | New in catalog (vLLM on GPU; ONNX on CPU). Tied to RTX Pro 6000 / NVIDIA partnership. |
| F2 | Add **Phi-4-reasoning** (vLLM-only) and note **Qwen3 / Whisper** to catalog examples | `sizer.js` | Keeps the model name list current; purely descriptive. |
| F3 | Mention **multi-node scheduling** in the "Includes"/hint copy (replicas scheduled across cluster-wide GPU capacity) | `sizer.js` | Reassures users the replica model maps to the new multi-node capability. |
| F4 | Add doc links: **model catalog** + **multi-node/vLLM blog** (and optionally the vLLM planner concept doc) | `sizer.js` modal | New "Learn more" anchors next to the existing "What is…" link. |
| F5 | (Optional) tooltip wording: clarify ONNX = CPU/GPU broadest compat; vLLM = GPU high-throughput multi-user | `sizer.js` | Matches the blog's "choosing the right runtime" guidance. |

Open question (F): do we want a separate **Agentic Retrieval** mention? The
agentic-retrieval blog is essentially the evolution of the existing **Edge RAG**
workload (already in the Sizer). Recommend a *small* note/link on the Edge RAG
modal rather than a new workload — confirm with maintainer. No sizing change.

No sizing-constant changes proposed — presets remain conservative rules-of-thumb
(the blogs give no per-model RAM/GPU figures; vLLM planner auto-sizes at deploy).

---

## 2. GitHub Enterprise Local — NEW Sizer workload (proposed)

Today GHEL exists only in the **reference-architectures** (Knowledge tab), not as
a **Sizer** workload. The blog describes it as a **prebuilt GHES VM image** on
Azure Local — single-node (PoC) or multi-node (VM-level HA/failover). This maps
cleanly onto the Sizer's existing **VM** workload model, so the cleanest
implementation is a **dedicated workload type that produces one (or a failover
pair of) sized VM(s)**, analogous to how `foundry`/`edgerag`/`videoindexer` are
specialised presets.

### Sizing model (from the blog + GHES min-recommended reqs)

GHES is sized by **active user count**; the blog links GitHub's
*minimum recommended requirements* (GHES 3.15). Proposed tiers (⚠ **verify exact
numbers against the GitHub doc before coding** — values below are from memory):

| Seats | vCPU | RAM (GB) | Attached storage (GB) |
|-------|------|----------|------------------------|
| ≤ 500 | 8 | 61 | 200 |
| 500–3000 | 12 | 96 | 300 |
| 3000–5000 | 16 | 128 | 500 |
| 5000–8000 | 20 | 160 | 750 |
| 8000–10000+ | 32 | 256 | 1000 |

Additional inputs the blog calls out for capacity planning: repository size &
growth, CI/CD pipeline frequency, artifact (Packages) storage. Suggest exposing:
- **Active developers / seats** (drives the tier table above)
- **Failover replica?** (toggle — adds a second identical GHES VM for HA)
- **Self-hosted Actions runners** (optional count × small VM spec) — or defer to
  a plain VM add; keep v1 simple.
- **Extra artifact/Packages storage (GB)** added to the data disk.

### Files touched (GHEL)

- [`sizer/index.html`](../../sizer/index.html) — new workload-type button
  (Preview badge), tooltip, empty-state legend entry, GHEL icon.
- [`sizer/sizer.js`](../../sizer/sizer.js) — `WORKLOAD_DEFAULTS.ghel`,
  a `GHEL_TIERS` table, `getGhelModalContent()`, save/restore/summary handling,
  and inclusion in the aggregate compute/memory/storage roll-up. GHEL is a plain
  Hyper-V VM (NOT AKS-hosted) → exclude from `AKS_HOSTED_WORKLOAD_TYPES`, allow
  normal VM placement (no GPU by default).
- [`sizer/sizer.css`](../../sizer/sizer.css) — `.workload-icon.ghel` styling.
- `images/` — GHEL icon (user is providing images).
- Links to embed: GHEL docs (`aka.ms/GHEL`), preview sign-up
  (`aka.ms/GitHubEnterpriseLocalSurvey`), GHES min-recommended reqs, billing
  (per-seat + per-core Azure Local).

### Open questions (GHEL)
1. Confirm exact GHES 3.15 min-recommended tier numbers (fetch the GitHub doc).
2. v1 scope: model just the GHES VM (+ optional failover) and leave runners as a
   separate VM add? (Recommended — keeps it shippable.)
3. Does GHEL need to participate in the homogeneous-GPU rule? No — it's a
   CPU-only VM; ensure it's treated like `vm` without GPU, not AKS-hosted.

---

## 3. Microsoft 365 Local — optional (user flagged)

M365 Local exists in the **reference-architectures** today, not the Sizer. User
indicated they may add it and will **provide two images**. M365 Local is a fixed
multi-cluster topology (Exchange / SharePoint / Skype / SQL) rather than a
free-sized workload, so it doesn't fit the per-workload "add N of these" model as
naturally as GHEL does.

Options:
- **(A)** Add as a Sizer workload with **fixed preset bundles** (Small / Medium /
  Large) mirroring the reference-architecture variants. Higher effort.
- **(B)** Add a **button that links out** to the M365 Local reference
  architecture + Learn docs (like the legacy Designer "M365 Local redirect"),
  no sizing math. Lower effort, consistent with how the Designer handled it.

Recommend **(B)** for v1 unless maintainer wants full sizing. Needs the two
images the user is adding. Decision required before coding.

---

## Rough implementation order

1. **Foundry Local content refresh** (F1–F5) — smallest, no new UI, ship first.
2. **GitHub Enterprise Local** workload — new button, modal, tier table, roll-up,
   tests. Verify GHES numbers first.
3. **M365 Local** — only after maintainer picks option A vs B and images land.
4. CHANGELOG + version bump (all the usual files: `README.md`, `CHANGELOG.md`,
   `index.html`, `sizer/index.html`; `SIZER_VERSION` only if export shape
   changes — adding GHEL workload payload **will** change export shape → bump).
5. `node scripts/run-tests.js` green + add tests for any new GHEL sizing helper +
   `npx eslint` + `npx html-validate`.

## Risks / cross-surface notes
- Adding a workload type touches the **save/load (localStorage)**, **summary**,
  **3D rack viz**, and **export** paths — mirror an existing simple type (`vm`)
  closely and add unit tests for the tier lookup.
- Keep GHEL **out** of the AKS-hosted GPU filter and homogeneous-GPU validator.
- Designer ↔ Sizer: GHEL/M365 are Sizer-only here; confirm no Designer coupling
  is implied before touching shared helpers.
