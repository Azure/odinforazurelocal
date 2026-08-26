---
name: sizer-scaling-release-validation
description: 'Stress-test ODIN Sizer scaling through the real localhost UI in the integrated browser. Use when validating a release, changing Sizer workload sizing, machine or rack auto-scaling, deployment topology transitions, GPU capacity, future growth, reset behavior, or Multi-Instance Scale-Out.'
---

# Sizer Scaling Release Validation

Validate Sizer as a user experiences it. Drive rendered controls and dialogs in
the integrated browser; do not seed workloads or invoke sizing functions from
page JavaScript.

## Browser Contract

- Serve the repository over localhost. Reuse a running server when available.
- Open `/sizer/` with a unique query string so the browser loads current assets.
- Use browser clicks, selections, typing, Add/Update/Delete actions, and the
  visible Reset confirmation dialog.
- Use DOM evaluation only to read results or diagnostics. Do not mutate state,
  call Sizer functions, or write local storage from evaluation code.
- Record the visible deployment, machine option text, rack count,
  recommendation, capacity values, and notices after each meaningful action.
- Treat any browser `pageError`, recursive overflow, stuck modal, mismatched
  recommendation/dropdown, or disabled control after Reset as a failure.

## Preparation

1. Confirm the branch is `Release` and inspect `git status`.
2. Read applicable files in `docs/module-planning/`.
3. Start a static server from the repository root if one is not already running:

   ```powershell
   python -m http.server 5511
   ```

4. Open `http://localhost:5511/sizer/?release-scaling=<unique-value>` in the
   integrated browser.
5. Click **Reset**, then confirm **Reset Sizer**. Assert Hyperconverged, two
   machines, no workloads, and enabled workload cards.

If port 5511 is occupied, use another localhost port. Do not test the deployed
site or any authenticated page.

## Workload Matrix

On Hyperconverged, add each default workload through its visible card and dialog.
Record the recommendation, then delete it before the next scenario.

| Workload | Required observation |
| --- | --- |
| Azure Local VMs | Add and delete return a coherent machine recommendation |
| AKS Arc Clusters | Included cluster nodes appear in the workload summary |
| Azure Virtual Desktop | User, profile, and concurrency summary is visible |
| Foundry Local | Included AKS Arc infrastructure is visible |
| Agentic Retrieval | Default production GPU satisfies its VRAM floor and matches Hardware Configuration |
| AI Video Indexer | Recommended worker and cluster-wide capacity appear |
| GitHub Enterprise Local | Appliance VM tier and base resources appear |

The default dialog must be addable without first correcting a self-invalid
selection. If validation blocks a default, capture the alert and selected values.

## Deployment Matrix

Exercise every deployment type through the visible Deployment Type selector.

1. **Single Node**
   - Add a default VM and assert one disabled machine option.
   - Confirm the first Sizing Note is the workload high-availability Advisory.
2. **Hyperconverged**
   - Add a Total VM workload at 4,000 vCPUs, 16,000 GB memory, and 100 GB storage.
   - Confirm automatic sizing remains within the 16-machine HCI limit.
3. **Rack-Aware Cluster**
   - Add a Total VM workload at 1,000 vCPUs, 4,000 GB memory, and 10,000 GB storage.
   - Assert machine options are only `2, 4, 6, 8` and the result is even.
   - Edit to 100 vCPUs, 400 GB memory, and 1,000 GB storage; assert scale-down
     remains in the valid even set.
4. **Disaggregated Storage**
   - From AUTO Hyperconverged, edit a Total VM workload to 10,000 vCPUs and
     40,000 GB memory.
   - Assert automatic conversion to Disaggregated, enough racks for N+1,
     matching dropdown/recommendation totals, and no page error.
   - Edit back to 100 vCPUs and 400 GB memory. Assert automatic return to
     Hyperconverged without rack/topology oscillation.
5. **ALDO Management Cluster**
   - Select ALDO and assert three fixed machines plus the IRVM1 workload.
   - Reset and confirm Hyperconverged/two machines, no IRVM1, and all workload
     cards enabled.

## Aggregate And Scale-Down

1. Reset to defaults.
2. Add all seven default workload types sequentially through their dialogs.
3. After every Add, record workload count, topology, machines, and bottleneck.
4. Assert the final Agentic GPU model matches Hardware Configuration.
5. Delete the only GPU workload. If GPU count was AUTO, assert it returns to
   zero; if the user manually selected inventory, assert it is preserved.

## GPU And Growth Boundary

Use VM **Total Requirements**, DDA, and a four-GPU-per-machine model.

1. Enter the N-1 ceiling of 252 GPUs with automatic 10% growth.
2. Assert growth resets to 0% with an explanatory notice and sizing reaches 64
   physical machines / 63 effective machines.
3. Repeat after manually selecting 10% growth. Assert growth is preserved and
   an actionable over-capacity warning appears.
4. Confirm machine/rack reduction never violates GPU capacity.

## Multi-Instance Scale-Out

1. Reset and add a default VM workload.
2. Select four instances.
3. Assert total machines equal per-instance machines multiplied by four and the
   summary labels the estimate as four independent instances.
4. Return to one instance and assert the summary hides without changing the
   per-instance machine recommendation.

## Invariants

- Single Node: exactly one machine.
- Hyperconverged: 2-16 machines.
- Rack-aware: one of 2, 4, 6, or 8 machines.
- Disaggregated: selected total is a valid rack multiple and no more than 64.
- ALDO: exactly three machines and fixed IRVM1 only.
- The recommendation total must be selectable in the current machine dropdown.
- AUTO controls may change; MANUAL controls must not be silently overwritten.
- N+1 compute, memory, and GPU capacity must cover displayed demand.
- Adding demand must not reduce capacity unless another visible setting changes;
  removing demand must not leave auto-managed capacity stranded.
- A single user action must settle without requiring a second no-change edit.
- No calculation may alternate recursively between topologies or rack counts.

## Failure Workflow

1. Preserve the failing browser state and capture visible values or a screenshot.
2. Repeat the smallest Add/Edit/Delete sequence that reproduces it.
3. Identify the controlling calculation path and one falsifiable hypothesis.
4. Add focused regression coverage with the smallest root-cause fix.
5. Reload localhost with a new query string and repeat the exact UI path.
6. Run the inverse path, such as scale-up followed by scale-down.

Do not weaken validation to make an invalid default pass. Correct the default or
synchronize related controls while preserving explicit user choices.

## Release Validation

After browser scenarios pass, run:

```powershell
npm run lint:js
npm run lint:html
npm run lint:css
node scripts/run-tests.js
git diff --check
```

For modified public planning notes, run the privacy scan documented in
`.github/copilot-instructions.md` before staging.

Report scenario coverage, defects found, fixes, browser outcomes, automated test
total, lint status, residual risk, and the localhost URL used for visual review.