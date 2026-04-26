# src/extension.ts

## Purpose

This file is the extension entry point. It registers commands and routes command calls to the edit provider.

## Main exports

- activate(context): Registers all extension commands.
- deactivate(): Empty shutdown hook.

## Registered commands

- textReplaceRule.runRule -> runSingleRule
- textReplaceRule.runRulePipeline -> runRulePipeline

## Command routing behavior

Each command reads `vscode.window.activeTextEditor` and creates a new TextReplaceRuleEditProvider instance for that editor.

- If args include `ruleName` or `rulePipelineName`, the command executes directly.
- If args are missing, the provider shows a quick pick and lets the user choose.
- Command handlers await provider work so the command lifecycle matches edit completion.

## Maintenance notes

- The command handlers intentionally delegate business logic to editProvider.ts.
