# tsx ≥ 4.21.1: dynamic `import()` of a `.ts` sibling silently returns an empty namespace when any async loader hook is registered

## Reproduce

```sh
pnpm install && pnpm repro
```

(or `npm install && npm run repro`)

Both `tsx@4.21.0` (working) and `tsx@4.22.2` (broken) are installed side by
side via npm aliases. The `repro` script runs both, prints their outputs,
and **exits with status 1 if the bug is present** so CI runs go red.

## Output today

```
--- tsx 4.21.0 (expected: works) ---
[child] module body executed
keys:     [ 'value' ]
m.value:  42

--- tsx 4.22.2 (expected: broken) ---
keys:     []
m.value:  undefined

❌ TSX BUG CONFIRMED: tsx 4.22.2 returned an empty namespace instead of `{ value: 42 }`.
```

On `4.22.2` (and `4.21.1`, `4.22.0`, `4.22.1`) `[child] module body executed`
is **never printed** — the target module is never actually evaluated. Yet the
dynamic-import promise resolves successfully with an empty namespace.

When the bug is fixed upstream, `pnpm repro` will print `✅` and exit 0
instead — so this repo doubles as a regression detector.

## Files

- `entry.mjs` — registers a no-op async `module.register()` hook, then
  `await import('./child.ts')`.
- `hook.mjs` — pass-through async load hook that just calls `nextLoad`.
- `child.ts` — exports `value = 42` and logs from its module body.
- `repro.mjs` — runs both tsx versions, prints outputs, asserts the bug,
  exits non-zero if confirmed.
- `package.json` — both tsx versions as aliases (`tsx-working`, `tsx-broken`).

## Cause (summary)

`tsx@4.21.1` added a sync `module.registerHooks()` code path for Node ≥ 24.11.1
([`src/esm/hook/load.ts:349`](https://github.com/privatenumber/tsx/blob/v4.21.1/src/esm/hook/load.ts#L349)).
The new code calls `loaded.source.toString()` to decode source bytes.

When tsx's sync hook coexists with an async `module.register()` hook (which is
how most observability tooling — Sentry, OpenTelemetry, datadog-trace, etc. —
installs itself via `import-in-the-middle`), dynamic-import loads route
through the async-hook worker thread. Results return to the main thread via
`postMessage` + structured clone, which **strips the `Buffer` prototype**.
What was a `Buffer` becomes a plain `Uint8Array`.

`Buffer.prototype.toString()` decodes UTF-8. `Uint8Array.prototype.toString()`
returns the byte values joined by commas — e.g. `"99,111,110,115,..."`.
esbuild parses that as a chain of integer literals via the comma operator
(syntactically valid JS, semantically a no-op). tsx returns it as
`format: 'module'`, Node evaluates it, the resulting module has no body
side effects, no imports, no exports. The dynamic import resolves with an
empty namespace.

## Suggested fix

Replace `loaded.source.toString()` with a `TextDecoder`-based decode that
handles both `Buffer` and plain `Uint8Array`:

```diff
- const code = loaded.source.toString();
+ const code = typeof loaded.source === 'string'
+   ? loaded.source
+   : new TextDecoder().decode(loaded.source);
```

(Same pattern applies at every other call site that does `.toString()` on a
possibly-`Uint8Array` source in `createLoadSync` / `createLoad`.)

## Versions confirmed

- Node.js: 24.14.1 (macOS arm64)
- tsx broken: 4.21.1, 4.22.0, 4.22.1, 4.22.2
- tsx works:  4.21.0
