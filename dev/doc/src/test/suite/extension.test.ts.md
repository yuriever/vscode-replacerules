# src/test/suite/extension.test.ts

## Purpose

This file contains regression tests for command-level extension behavior.

## Test strategy

The tests execute real VS Code commands against in-memory editors and settings.
This validates integration between command registration, config parsing, and replace logic.

## Covered scenarios

1. runRule replaces the full document when there is a single empty selection.
2. runRuleset applies multiple rules in sequence.
3. runRule only updates explicit non-empty selections in a multi-selection editor.
4. runRule skips rules whose `languages` filter does not match the active document.
5. Removed clipboard replace commands are no longer registered.
6. runRuleset loads external config from `replacerules.configPath`, including paths with spaces.
7. runRule reports invalid regex config errors without modifying the document.
8. runRule reports missing `configPath` file errors without modifying the document.

## Isolation helpers

- setReplaceRulesConfig(...): Updates replacerules.configPath for each test.
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
