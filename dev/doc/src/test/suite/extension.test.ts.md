# src/test/suite/extension.test.ts

## Purpose

This file contains regression tests for command-level extension behavior.

## Test strategy

The tests execute real VS Code commands against in-memory editors and settings.
This validates integration between command registration, config parsing, and replace logic.

## Covered scenarios

1. runRule replaces the full document when there is a single empty selection.
2. runRuleset applies multiple rules in sequence.
3. Removed clipboard replace commands are no longer registered.

## Isolation helpers

- setReplaceRulesConfig(...): Writes replacerules.rules and replacerules.rulesets for each test.
- openEditor(content): Creates and shows a temporary plaintext editor.
- waitForDocumentText(...): Polls until async editor edits are visible.

## Lifecycle behavior

- suiteSetup snapshots existing global extension config.
- setup clears editors and resets config to empty objects.
- suiteTeardown restores original config snapshot.

## Maintenance notes

- Keep tests focused on externally visible command behavior.
- Add new tests whenever command contracts or config formats change.
