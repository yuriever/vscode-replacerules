# src/editProvider.ts

## Purpose

This file contains the core replace engine used by all extension commands.

## Main class

TextReplaceRuleEditProvider

### Constructor

- Accepts the active TextEditor.
- Reads configuration from `textReplaceRule.configPath`.
- If `configPath` is set, loads external JSON or JSONC from disk (via `jsonc-parser`) and uses `rules` / `rulePipelines` from that file.
- If `configPath` is unset or the file fails to load, the provider works with empty config.

### User-facing entry methods

- pickRuleAndRun()
- pickRulePipelineAndRun()
- runSingleRule(ruleName)
- runRulePipeline(rulePipelineName)

## Selection and menu helpers

- getQPRules(): Builds quick pick items for rules, with optional language filtering and optional `name` / `description` display metadata.
- getQPRulePipelines(): Builds quick pick items for rule pipelines, with optional `name` / `description` display metadata.

## Replace execution model

There is one execution path:

- doReplace(rule): Runs replacements on the active document or selections.
- doReplace(steps): Runs replacements on the active document or selections.
- The replace path preserves CRLF line endings when writing back to the document.
- The replace path computes all changes in memory first and applies them through one `TextEditor.edit(...)` call.

### Full-document behavior

If there is exactly one selection and it is empty, the entire document is targeted.

### Multi-step behavior

A `regexReplace` rule can contain multiple find/replace steps. Steps are executed in order.
`rulePipelines` append steps from multiple rules into one sequence and then execute.
If a rule pipeline resolves to zero applicable rules, no edit is attempted.

## Internal rule model

- RuleDefinition union
    - Supports `regexReplace` and `literalMap`.
    - Carries optional `name` and `description` metadata for Quick Pick display.
- RegexReplaceStep
    - Builds a RegExp from `find` and `flag`.
    - Ensures global matching by adding `g` when missing.
- LiteralMapStep
    - Compiles one literal matcher and replacement table.

## Utility functions

- getReplaceTargets(editor, document): Computes immutable replace ranges before edits.
- normalizeLineEndings(str): Normalizes CRLF to LF for matching only.
- getPostProcessContext(editor): Reads effective editor tab settings for post processors.
- applySteps(text, steps, context): Applies ordered in-memory replacement steps.
- loadExternalConfig(path, documentUri): Reads and parses external JSON/JSONC config.
- parseExternalConfig(rawText, resolvedPath): Parses JSONC text, validates typed rules, and reports file-scoped config errors.
- resolveConfigPath(path, documentUri): Expands `~/` and resolves workspace-relative paths.
- applyRegexReplaceStep(...): Expands standard replacement string tokens and runs `expandTab`.
- applyLiteralMapStep(...): Performs literal lookup replacement and runs `expandTab`.
- escapeRegExp(str): Escapes literal patterns and literal-map entries.

## Maintenance notes

- A new provider is created for each command invocation, so config is re-read each run.
- Errors in parsing or execution are surfaced via VS Code error notifications.
