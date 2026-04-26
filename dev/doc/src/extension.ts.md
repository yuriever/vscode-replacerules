# src/extension.ts

Extension entrypoint.

## Responsibilities

- register `text-replace-rule.runRule`
- register `text-replace-rule.runRulePipeline`
- read the active editor
- forward work to `TextReplaceRuleEditProvider`

## Behavior

- If command args include `ruleName` or `rulePipelineName`, run directly.
- Otherwise open the corresponding quick pick.
- No replace logic should live here.
