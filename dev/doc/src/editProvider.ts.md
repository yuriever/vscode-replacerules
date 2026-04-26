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
- `rulePipelines` flatten multiple rules into one ordered step list.
- Line endings are normalized for matching and restored before writing.

## Rule model

- `regexReplace`
    - `find`, `replace`, `flag`, optional `language`, optional `post`
- `literalMap`
    - `map`, optional `language`, optional `post`
- `post` currently supports only `["expandTab"]`

## Notes

- Config is reloaded on each command invocation.
- Errors are surfaced through VS Code error messages.
- This file owns behavior. `src/extension.ts` should stay thin.
