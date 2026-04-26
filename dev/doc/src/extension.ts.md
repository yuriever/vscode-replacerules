# src/extension.ts

## Purpose

This file is the extension entry point. It registers commands and routes command calls to the edit provider.

## Main exports

- activate(context): Registers all extension commands.
- deactivate(): Empty shutdown hook.

## Registered commands

- replacerules.runRule -> runSingleRule
- replacerules.runRuleset -> runRuleset
- replacerules.stringifyRegex -> stringifyRegex

## Command routing behavior

Each command reads `vscode.window.activeTextEditor` and creates a new ReplaceRulesEditProvider instance for that editor.

- If args include ruleName or rulesetName, the command executes directly.
- If args are missing, the provider shows a quick pick and lets the user choose.
- Command handlers await provider work so the command lifecycle matches edit completion.

## stringifyRegex flow

1. Prompt the user for a regular expression text.
2. Accept either a bare pattern or `/pattern/flags` input.
3. Validate by constructing a RegExp instance.
4. Convert the pattern portion to JSON-safe string form via JSON.stringify.
5. If flags were present, include them in the message for later use in the rule config.
6. Offer an action to copy the escaped string to clipboard.

## Maintenance notes

- The command handlers intentionally delegate business logic to editProvider.ts.
- Errors from invalid regex input are shown as VS Code error messages.
