# Private Path GA

## Current state

- Designer exposes Private Path for connected hyperconverged and disaggregated deployments and already forces Arc Gateway plus Azure Firewall Explicit Proxy.
- Private Path is still labelled Coming Soon in Designer and the outbound-connectivity guide.
- Proxy/TLS-inspection and bypass guidance exists, but GA version prerequisites and current deployment links are incomplete.
- Azure Government disables Arc Gateway, while a later Private Path rule can restore it and create contradictory state.

## Proposed change

- Promote Private Path to GA without changing the persisted `outbound: "private"` contract.
- Keep Private Path available for both hyperconverged and disaggregated deployments.
- Require Azure Local 2608+, Arc Gateway, Azure Firewall Explicit Proxy, and ExpressRoute or site-to-site VPN in UI/report guidance.
- Prevent Private Path selection where the Designer disables Arc Gateway, including stale imported or restored state.
- Remove preview-only markup/styles and update links to the 2608 Private Path documentation.
- Add regression coverage for both supported architectures and cloud constraints.

## Files touched

- `index.html`, `css/style.css`, `js/script.js`
- `docs/outbound-connectivity/index.html`, `docs/outbound-connectivity/styles.css`
- `report/report.js`, `report/pptx-export.js`
- `docs/json-schema/odin-design.schema.json`, `tests/index.html`
- Release/version documentation

## Open questions

- Public Learn currently labels the Private Path article as applying to hyperconverged deployments; implementation follows the confirmed product support for both hyperconverged and disaggregated deployments.
- Azure Government remains unavailable while the Designer's Arc Gateway support rule disables that service.

## Implementation order

1. Remove preview markers and add GA prerequisite guidance.
2. Make Private Path and Arc Gateway cloud constraints settle consistently.
3. Update report/PPTX guidance, schemas, tests, and release notes.
4. Run static validation and real-UI smoke paths for both architectures and the inverse cloud transition.