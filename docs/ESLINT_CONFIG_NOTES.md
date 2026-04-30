# ESLint Configuration Notes

JSON does not support comments, so this file documents intentional choices
in [`.eslintrc.json`](.eslintrc.json).

## `no-empty: ["error", { "allowEmptyCatch": true }]`

Empty `catch` blocks are sometimes legitimate (e.g. `URL.revokeObjectURL()`
on an already-revoked blob URL, `localStorage.getItem()` in private-browsing
mode, optional cleanup of best-effort resources).

**Convention for new code**: every empty catch MUST include a brief inline
comment explaining why the error is safe to swallow.

```js
// ✅ ok — explains why
try { URL.revokeObjectURL(url); } catch (e) { /* URL may already be revoked */ }

// ❌ not ok — silent swallow with no rationale
try { URL.revokeObjectURL(url); } catch (e) { }
```

If you cannot articulate why the error is safe to swallow, the catch is
probably hiding a real bug — log with `console.warn(...)` instead.

## `overrides[0]` — legacy global-pattern files

The nine files listed in the override (`js/utils.js`, `js/notifications.js`,
`js/analytics.js`, `js/theme.js`, `js/formatting.js`, `js/validation.js`,
`js/dns.js`, `js/script.js`, `js/disaggregated.js`) predate the rest of the
codebase and intentionally share globals via legacy `var` declarations and
cross-file redeclarations.

`no-unused-vars` and `no-redeclare` are disabled for those files because the
warnings are structural (state and helper functions exist on the global
scope by design and may be redeclared as a fallback safety net), not bugs.

**Do NOT add new files to this override.** Newer code (`arm/`, `report/`,
`sizer/`, `switch-config/`) follows stricter conventions and lints clean.

## Rule severity philosophy

- `error` — fails CI. Reserved for correctness bugs (`no-undef`,
  `no-empty` without `allowEmptyCatch`).
- `warn` — surfaces in lint output but does not fail CI. Used for
  stylistic preferences (`no-var`, `prefer-const`, `quotes`, `semi`,
  `indent`) so that legacy code can ship without an enormous churn diff.

New code should aim for zero warnings. Use `--fix` to auto-resolve most
stylistic warnings before opening a PR.
