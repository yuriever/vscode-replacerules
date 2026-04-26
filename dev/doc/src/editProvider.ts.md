# src/editProvider.ts

## Purpose

This file contains the core replace engine used by all extension commands.

## Main class

ReplaceRulesEditProvider

### Constructor

- Accepts the active TextEditor.
- Reads configuration from `replacerules.configPath`.
- If `configPath` is set, loads external JSON from disk and uses `rules` / `rulesets` from that file.
- If `configPath` is unset or the file fails to load, the provider works with empty config.

### User-facing entry methods

- pickRuleAndRun()
- pickRulesetAndRun()
- runSingleRule(ruleName)
- runRuleset(rulesetName)

## Selection and menu helpers

- getQPRules(): Builds quick pick items for rules, with optional language filtering.
- getQPRulesets(): Builds quick pick items for rulesets.

## Replace execution model

There is one execution path:

- doReplace(rule): Runs replacements on the active document or selections.
- The replace path preserves CRLF line endings when writing back to the document.

### Full-document behavior

If there is exactly one selection and it is empty, the entire document is targeted.

### Multi-step behavior

A rule can contain multiple find and replace steps. Steps are executed in order.
Rulesets append steps from multiple rules into one sequence and then execute.
If a ruleset resolves to zero applicable rules, no edit is attempted.

## Internal rule model

- Replacement class
    - Builds a RegExp from find, flags, and literal mode.
    - Ensures global matching by adding g when missing.
- ReplaceRule class
    - Normalizes scalar and array config values into ordered Replacement steps.
    - Supports appendRule for ruleset composition.

## Utility functions

- objToArray(obj): Normalizes config field values.
- rangeUpdate(editor, document, index): Computes effective replace range.
- normalizeLineEndings(str): Normalizes CRLF to LF for matching only.
- loadExternalConfig(path, documentUri): Reads and parses external JSON config.
- resolveConfigPath(path, documentUri): Expands `~/` and resolves workspace-relative paths.
- applyReplacement(text, replacement): Applies normalized matching while preserving CRLF line endings in output.
- escapeRegExp(str): Escapes literal patterns.

## Maintenance notes

- A new provider is created for each command invocation, so config is re-read each run.
- Errors in parsing or execution are surfaced via VS Code error notifications.
