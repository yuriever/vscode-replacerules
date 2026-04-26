# Development Notes

## Layout

- `src/extension.ts`: extension entrypoint, registers commands
- `src/editProvider.ts`: config loading, quick pick UI, replace engine
- `src/test/suite/extension.test.ts`: command-level regression tests
- `README.md`: user-facing behavior and config format
- `CHANGELOG.md`: release notes

## Local loop

1. Edit code in `src/`.
2. Run `npm run compile`.
3. Run `npm test`.
4. Update `README.md` or `CHANGELOG.md` if behavior changed.

For interactive debugging:

- `npm run watch`
- launch `Run Extension` from VS Code

## Config model

- Extension setting: `text-replace-rule.configPath`
- External config root:

```json
{
  "rules": {},
  "rulePipelines": {}
}
```

- Rule types:
    - `regexReplace`
    - `literalMap`

## Practical rules

- Do not edit `out/` manually.
- Treat `src/test/suite/extension.test.ts` as the main safety net.
- Keep one external namespace everywhere:
    - package name
    - command ids
    - setting key
- If config semantics change, update tests and README in the same patch.

## Packaging

- Build: `npm run compile`
- Test: `npm test`
- Package: `npx @vscode/vsce package`

Generated artifacts such as `out/`, `node_modules/`, `.vscode-test/`, and `*.vsix` should not be committed.
