# Designer Infrastructure Pool Auto-End

## Current state

- Designer Step 15 requires at least six consecutive Infrastructure Network IP
  Pool addresses.
- Entering a Starting IP does not populate Ending IP, although the existing
  Auto-fill from Node IPs action creates a six-address pool.

## Proposed change

- When Starting IP becomes a valid IPv4 address, calculate the minimum Ending
  IP as five addresses later.
- Populate Ending IP only when it is empty or was previously auto-generated;
  never overwrite a manually entered ending address.
- Keep the existing CIDR, reserved-range, node-IP, gateway, and range validation
  as the final authority.

## Files touched

- `index.html`
- `js/script.js`
- `tests/index.html`
- `CHANGELOG.md`
- `README.md`
- `js/changelog.js`

## Open questions

- None. The existing minimum pool size remains six addresses.

## Implementation order

1. Add the pure minimum-ending-IP calculator and focused tests.
2. Connect Starting IP input without overwriting a manual Ending IP.
3. Update the current release notes and run the complete validation suite.