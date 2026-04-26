# src/test/suite/extension.test.ts

Integration tests for the public extension behavior.

## What it covers

- command registration
- config loading from `text-replace-rule.configPath`
- `runRule` and `runRulePipeline`
- selection behavior
- CRLF preservation
- language filtering
- config validation failures
- quick pick display metadata
- manifest baseline checks

## Test style

- Drive the extension through real VS Code commands.
- Assert visible outcomes: document text, errors, manifest metadata.
- Prefer adding coverage here over testing private helpers.

## Useful helpers

- `setTextReplaceRuleConfig(...)`
- `writeConfigFile(...)`
- `captureErrorMessages(...)`
- `openEditor(...)`
- `waitForDocumentText(...)`
