# src/editProvider.ts

Core engine for the extension.

## Responsibilities

- load external config from `text-replace-rule.configPath`
- parse `rules` and `rulePipelines`
- build quick pick items for rules and pipelines
- resolve target ranges from the active editor
- apply ordered replace steps in memory
- commit all edits through one `TextEditor.edit(...)`

## Public entrypoints

- `pickRuleAndRun()`
- `pickRulePipelineAndRun()`
- `runSingleRule(ruleName)`
- `runRulePipeline(rulePipelineName)`

## Execution model

- One empty selection means whole-document replace.
- Non-empty selections are processed independently.
- `regexReplace` may contain multiple ordered steps.
- `post` runs once after each rule finishes all of its steps.
- `rulePipelines` preserve rule boundaries, so each rule keeps its own final `post`.
- Line endings are normalized for matching and restored before writing.

## Rule model

- `regexReplace`
    - `find`, `replace`, `flag`, optional `language`, optional `post`
- `literalMap`
    - `map`, optional `language`, optional `post`
- `post` supports `"expandTab"`, `"removeBlankLine"`, and `indentLine(mode)` processors, in listed order

## Post-process context

- `tabSize` comes from the active editor options
- `block` uses the exact selection-start prefix only when it is whitespace-only
- `inline` preserves whitespace and replaces non-whitespace characters before the selection with spaces
- `auto` chooses `block` for whitespace-only prefixes and `inline` otherwise
- Context is computed per replace target, so separate selections can align differently in one command run

## Notes

- External config is cached by resolved path after first successful load.
- External config file edits require a VS Code window reload.
- Errors are surfaced through VS Code error messages.
- This file owns behavior. `src/extension.ts` should stay thin.
