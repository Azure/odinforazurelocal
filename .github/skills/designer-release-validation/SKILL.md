---
name: designer-release-validation
description: 'Validate ODIN Designer through the real localhost UI. Use for PRs or releases that change the Designer wizard, scenario or architecture transitions, networking, imports, Sizer handoff, reports, ARM outputs, reset behavior, responsive layout, or accessibility.'
---

# Designer Release Validation

Validate the Designer as a user experiences it. This complements ESLint,
HTML validation, and `node scripts/run-tests.js`; it does not replace them.

## Browser Contract

- Serve the repository over localhost and open `/index.html` with a unique query
  string so current assets load.
- Drive rendered cards, buttons, inputs, dialogs, and file pickers through the
  integrated browser. Do not call Designer functions or mutate state/localStorage
  from page evaluation.
- DOM evaluation may read visible state, ARIA state, browser errors, downloaded
  payloads, or navigation targets for assertions only.
- Capture `pageError` and failed same-origin requests throughout each scenario.
- After every major transition, compare selected cards, visible sections,
  summary values, progress, and enabled output actions. Treat disagreement as a
  failure even when the next screen appears usable.

## Preparation

1. Confirm the branch is `Release`, inspect `git status`, and read applicable
   plans in `docs/module-planning/`.
2. Reuse a running local server or start one from the repository root:

   ```powershell
   python -m http.server 5511
   ```

3. Open `http://localhost:5511/index.html?designer-validation=<unique-value>`.
4. Use **Start Over** and its visible confirmation. Assert the scenario cards are
   enabled, the summary is reset, and theme/font preferences remain unchanged.

Use synthetic names, domains, IP ranges, and credentials. Never test the
deployed site, authenticated pages, or real customer data.

## PR Smoke Matrix

Run the smallest relevant workflow plus its inverse transition for every
Designer PR. At minimum:

1. Start from a reset state through visible controls.
2. Complete the changed scenario far enough to exercise its derived state.
3. Change the controlling choice away and back.
4. Assert stale dependent state is cleared and user-owned values are preserved.
5. Confirm progress/readiness accurately identifies remaining sections.
6. Exercise the changed export, handoff, report, or ARM action when applicable.
7. Repeat the modified screen at 375 px width and in both themes for UI changes.

Cross-tool changes must also run the Sizer smoke path in
`.github/skills/sizer-scaling-release-validation/SKILL.md`.

## Release Scenario Matrix

Run every branch below for a release candidate.

| Scenario | Architecture / role | Required outcome |
| --- | --- | --- |
| Connected | Hyperconverged | Standard 2-16 machine workflow reaches valid report and ARM readiness |
| Connected | Disaggregated | SAN/Clos workflow keeps rack, machine, VLAN, subnet, NIC, and intent state aligned |
| Disconnected | Management | Fixed three-machine management role includes the required local services path |
| Disconnected | Workload | Valid 1-16 machine workload role remains distinct from management defaults |
| Multi-Rack | Rack-aware | Even zone assignment and confirmation remain coherent after edit/swap/back navigation |
| Microsoft 365 Local | Supported path | Minimum nine-machine requirement persists through navigation and output readiness |

For each path, use the visible summary and progress panel as independent checks
against the selected controls. A summary that reports stale or impossible state
is a failure.

## High-Risk Transitions

### Scenario And Architecture

1. Select Connected/Hyperconverged and enter enough values to populate dependent
   region, machine, storage, intent, and outbound state.
2. Change to Disaggregated. Assert incompatible HCI fields disappear or reset,
   storage is InfraOnly, and SAN fields become authoritative.
3. Return to Hyperconverged. Assert SAN-only state cannot leak into summary or
   generated outputs.
4. Repeat Connected to Disconnected and management to workload role changes.

### Rack-Aware

- Confirm machine totals and zone assignments remain even and sum correctly.
- Swap or edit zone assignment, navigate away/back, and verify confirmation is
  invalidated only when the underlying assignment changes.
- Ensure forced switched storage, management/compute intent, and rack ToR choices
  stay visible and synchronized.

### Port, RDMA, And Storage Networking

- Change port count after confirming intent and adapter mapping. Assert dependent
  confirmations clear instead of silently retaining incompatible mappings.
- Exercise switched and switchless storage. For three/four-machine switchless,
  assert Storage Auto IP is disabled and all required custom subnets are present.
- Remove required RDMA or introduce a duplicate/invalid subnet. Assert visible
  validation blocks readiness and identifies the controlling field.
- Restore valid values and confirm the workflow recovers in one action.

### Names And IP Addressing

- Enter the first machine name and verify automatic sequential names.
- Manually edit a later name, then change the first name; the manual override
  must remain unchanged while auto-generated names follow the new base.
- Enter a valid Infrastructure Pool start and assert the minimum six-address end
  is filled. A manual end must survive later start changes.
- Check invalid CIDR, gateway, overlap, reserved range, and duplicate addresses
  through visible errors and output readiness.

## Import, Handoff, And Reset

- Export a completed Designer JSON file, Start Over, and import it through the
  visible file picker. Assert scenario, architecture, derived state, progress,
  Sizer metadata, and output readiness round-trip.
- Import a supported older Designer payload and verify visible migration.
- Attempt a Sizer export through Designer Import and require clear reciprocal
  guidance without changing current state.
- Open Designer from Sizer **Configure in Designer** and verify topology,
  machine count, hardware, workloads, and Sizing Notes arrive once without
  clobbering later user edits.
- Start Over after each complex path. Assert every workflow field resets while
  theme and font-size preferences persist.

## Outputs And Cross-Tool Handoffs

- Before completion, Report and ARM buttons must be disabled and missing sections
  must be visible and accurate.
- When complete, open the Cluster Design Document and assert title, scenario,
  architecture, machine count, networking, workloads, and diagrams match Designer.
- Generate ARM output and assert the selected branch is correct: default,
  rack-aware, disaggregated SAN, disconnected/AD-less, or government where
  applicable. Placeholder warnings must remain explicit.
- Exercise ToR Switch and Sizer handoffs. Assert topology and machine/network
  values transfer without stale values from a previous scenario.

## Responsive And Accessibility Pass

For any changed UI and once per release candidate:

- Check 375 x 667, 768 x 1024, and a desktop viewport in light and dark themes.
- Confirm cards, forms, summary, dialogs, and output buttons do not overlap or
  overflow and the next relevant section remains reachable.
- Tab through the modified workflow. Cards, controls, dialogs, and actions must
  receive visible focus in a sensible order and activate with Enter/Space.
- Confirm dialogs trap focus while open and return it to their trigger on close.
- Verify progress `aria-valuenow`, selected `aria-pressed` state, labels, and
  validation messaging follow the visible workflow.

## Invariants

- A single user action must settle without a second no-change edit.
- Hidden or incompatible state must not appear in the summary or outputs.
- Scenario and architecture constraints must override stale imported state.
- Derived values may update automatically; explicit manual overrides must not be
  silently overwritten.
- Machine, rack, zone, NIC, VLAN, subnet, and intent totals must agree everywhere.
- Output readiness must never enable while required visible sections are invalid.
- Reset must clear the entire workflow state, including newly added fields.
- No transition may throw, loop recursively, leave a modal stuck, or disable an
  unrelated workflow permanently.

## Failure Workflow

1. Preserve the failing page and record selected controls, summary, progress,
   errors, and the smallest transition that exposed it.
2. Repeat from Start Over using only visible UI actions.
3. Identify the controlling mutation/readiness path and one falsifiable cause.
4. Add focused static regression coverage with the smallest root-cause fix.
5. Reload with a new query string and repeat the exact UI path plus its inverse.
6. Run the full related scenario before declaring the defect fixed.

## Release Validation

After browser scenarios pass, run:

```powershell
npm run lint:js
npm run lint:html
npm run lint:css
node scripts/run-tests.js
git diff --check
```

Report scenarios exercised, transitions, viewports/themes, output/handoff checks,
page errors, defects found, fixes, static test total, lint status, residual risk,
and the localhost URL used for review.