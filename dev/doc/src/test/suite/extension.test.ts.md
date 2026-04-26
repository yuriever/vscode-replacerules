# src/test/suite/extension.test.ts

## Purpose

This file contains regression tests for command-level extension behavior.

## Test strategy

The tests execute real VS Code commands against in-memory editors and settings.
This validates integration between command registration, config parsing, and replace logic.

## Covered scenarios

1. runRule replaces the full document when there is a single empty selection.
2. runRule command completion waits for document edits to finish.
3. runRulePipeline applies multiple rules in sequence.
4. runRule only updates explicit non-empty selections in a multi-selection editor.
5. runRule preserves CRLF line endings both with and without replacements.
6. runRule skips rules whose `language` filter does not match the active document.
7. Removed clipboard replace commands are no longer registered.
8. runRulePipeline loads external config from `textReplaceRule.configPath`, including paths with spaces.
9. runRulePipeline loads external JSONC config from `textReplaceRule.configPath`, including comments and trailing commas.
10. runRule reports invalid typed-rule config errors without modifying the document.
11. runRule reports missing `configPath` file errors without modifying the document.
12. runRule reports invalid JSONC config parse errors without modifying the document.
13. Quick Pick rendering prefers optional `name`, shows optional `description`, and falls back to object keys.
14. package metadata keeps `engines.vscode` aligned with `@types/vscode` baseline and includes `jsonc-parser`.

## Isolation helpers

- setTextReplaceRuleConfig(...): Updates textReplaceRule.configPath for each test.
- writeConfigFile(...): Writes temporary external JSON config files for test cases.
- captureErrorMessages(...): Temporarily intercepts VS Code error notifications for assertions.
- openEditor(content): Creates and shows a temporary plaintext editor.
- waitForDocumentText(...): Polls until async editor edits are visible.

## Lifecycle behavior

- suiteSetup snapshots existing global extension config.
- setup clears editors and resets configPath.
- suiteTeardown restores original config snapshot.

## Maintenance notes

- Keep tests focused on externally visible command behavior.
- Add new tests whenever command contracts or config formats change.
