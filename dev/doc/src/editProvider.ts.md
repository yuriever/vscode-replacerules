# src/editProvider.ts

## Purpose

This file contains the core replace engine used by all extension commands.

## Main class

ReplaceRulesEditProvider

### Constructor

- Accepts the active TextEditor.
- Reads configuration values from:
    - replacerules.rules
    - replacerules.rulesets

### User-facing entry methods

- pickRuleAndRun()
- pickRulesetAndRun()
- pickRuleAndPaste()
- pickRulesetAndPaste()
- runSingleRule(ruleName)
- runRuleset(rulesetName)
- pasteReplace(ruleName)
- pasteReplaceRuleset(rulesetName)

## Selection and menu helpers

- getQPRules(): Builds quick pick items for rules, with optional language filtering.
- getQPRulesets(): Builds quick pick items for rulesets.

## Replace execution model

There are two execution paths:

- doReplace(rule): Runs replacements on the active document or selections.
- doPasteReplace(rule): Runs replacements on clipboard text, then inserts result into selections.

### Full-document behavior

If there is exactly one selection and it is empty, the entire document is targeted.

### Multi-step behavior

A rule can contain multiple find and replace steps. Steps are executed in order.
Rulesets append steps from multiple rules into one sequence and then execute.

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
- stripCR(str): Normalizes CRLF to LF before matching.
- escapeRegExp(str): Escapes literal patterns.

## Maintenance notes

- A new provider is created for each command invocation, so config is re-read each run.
- Errors in parsing or execution are surfaced via VS Code error notifications.
