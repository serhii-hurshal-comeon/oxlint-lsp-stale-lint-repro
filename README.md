# oxlint LSP: lints for outdated document versions are never cancelled

Reproduction for an [oxc](https://github.com/oxc-project/oxc) issue: with `typeAware: true`, `oxlint --lsp` lints every version of a document while you type, one full `tsgolint` run per keystroke, and ignores `$/cancelRequest`. Diagnostics for the current text arrive only after all outdated runs finish.

## Run

macOS or Linux, Node 22+.

```sh
pnpm install            # or npm install
pnpm generate           # 15,000 generated TS modules in ./synthetic (no third-party code)
pnpm repro              # LSP: open last module, 15 edits 100 ms apart
pnpm repro:single       # LSP: 1 edit
pnpm repro:no-type-aware
pnpm repro:cli          # CLI on the same final content, for comparison
```

## What it does

- `gen.mjs`: generates the project. Each module imports the previous three. `.oxlintrc.json` enables `typeAware`, `no-debugger` and `typescript/no-floating-promises`.
- `client.mjs`: minimal LSP client in pull-diagnostics mode, behaving like VS Code / Zed. After every `textDocument/didChange` it sends `textDocument/diagnostic` and a `$/cancelRequest` for the previous, now-outdated pull.
- `tsgolint-wrapper.sh`: set as `OXLINT_TSGOLINT_PATH`; logs start and end of every `tsgolint` launch.
- `run.mjs`: runs the client and reports launches, maximum concurrent `tsgolint` processes, cancelled responses, and how long after the last edit the diagnostics for the final text arrive.

## Results

oxlint 1.91.0, oxlint-tsgolint 7.0.2005, macOS, Apple M4 Pro (14 cores), Node 26.13.0:

| Scenario                   | `tsgolint` launches | max concurrent | diagnostics for the final text     |
| -------------------------- | ------------------- | -------------- | ---------------------------------- |
| `pnpm repro:cli`           | 1                   | 1              | 1.3 s total                        |
| `pnpm repro:single`        | 1                   | 1              | 1.3–1.7 s after the edit           |
| `pnpm repro`               | **15**              | 1              | **17.6–18.0 s** after typing stops |
| `pnpm repro:no-type-aware` | 0                   | 0              | immediately                        |

All pulls are answered with full results; none returns `RequestCancelled` (-32800).

---

The scripts were written with AI assistance (Claude) and reviewed by the author.
