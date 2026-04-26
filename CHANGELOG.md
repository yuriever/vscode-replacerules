# Change Log

TextReplaceRule started as a fork of `bhughes339/vscode-replacerules`, but `1.0.0` marks the start of an independent product line. Entries from `1.0.0` onward describe TextReplaceRule itself. Older `0.x` entries are kept below as legacy fork history and do not define the new configuration model or naming scheme.

## Unreleased

- Add `post: ["removeBlankLine"]` to remove blank lines from replacement results, including whitespace-only lines.
- Allow multiple supported `post` processors to run in listed order.

## 1.0.0

- Establish TextReplaceRule as an independently versioned extension
- Rename the extension namespace from `replacerules` to `text-replace-rule`
    - Rename commands to `text-replace-rule.runRule` and `text-replace-rule.runRulePipeline`
    - Rename configuration key to `text-replace-rule.configPath`
- Replace `rulesets` with `rulePipelines`
    - Rename command arguments and user-facing terminology to "rule pipeline"
- Replace ad hoc rule shapes with explicit rule types
    - Support only `regexReplace` and `literalMap`
    - Remove `literal`, `flags`, `languages`, and `rulesets`
    - Rename `flags` to `flag` and `languages` to `language`
- Remove `replacerules.stringifyRegex`
- Add `literalMap` for bulk literal lookup-and-replace
- Add optional `name` and `description` metadata for rules and rule pipelines
- Support `post: ["expandTab"]` for per-replacement tab expansion
- Execute rule chains in memory and commit changes through a single editor edit
- Support JSONC external config parsing for `text-replace-rule.configPath`
    - Parse config files with `jsonc-parser`
    - Accept comments and trailing commas in config files
- Upgrade the toolchain and test baseline for current VS Code versions
    - Update the VS Code engine baseline to `^1.116.0`
    - Update TypeScript, ESLint, Mocha, Glob, Node/VS Code type packages, and the VS Code test runner
    - Modernize the test suite loader for current `mocha` and `glob` APIs

## Legacy Fork History

The entries below summarize the older `0.x` line inherited from the original extension family. They are preserved for historical reference only.

## 0.4.2

- New feature: Run ruleset on clipboard and paste into document (replacerules.pasteAndReplaceRuleset)
    - Thanks to @dpfeil for the implementation

## 0.4.1

- New feature: Stringify regular expression
    - Details in the new "Other Features" section in README

## 0.4.0

- New feature: Run rule on clipboard and paste into document (replacerules.pasteAndReplace)
    - Details in the new "Other Features" section in README
- Retire rules object conversion code and add github.io page for additional conversions
- Change code for improved readability and efficiency

## 0.3.1

- Fix literal search/replace breaking certain find patterns

## 0.3.0

- Add support for literal search/replace

## 0.2.7

- Fix selection changing between ruleset edits

## 0.2.6

- Combine vscode commands
    - This fixes the keybinding linter not recognizing the `runRule` and `runRuleset` commands

## 0.2.5

- Replace all instances of "ruleSet" to "ruleset"

## 0.2.4

- Fix keybinding support for rules

## 0.2.3

- Add per-rule language filter support

## 0.2.2

- Add an extension icon

## 0.2.1

- Remove default `replacerules.rules` setting

## 0.2.0

- New format for `replacerules.rules` configuration setting
    - Any existing `replacerules.rules` will be automatically converted to the new format.
    - The old format will be backed up to `replacerules.oldrules` in case there is any data loss during the conversion. This can be safely removed from your configurations at any time.
- Add support for rulesets (`replacerules.rulesets`) which run multiple rules in sequence. See README for format
- Allow specific rules and rulesets to be bound to keyboard shortcuts
    - Rules - `{command: 'text-replace-rule.runRule', args: ruleName: { <name of rule> }}`
    - Rulesets - `{command: 'text-replace-rule.runRuleSet', args: ruleSet: { <name of ruleset> }}`

## 0.1.7

- Improve support for newlines in rules
- Better find/replace logic

## 0.1.6

- Add per-language support for rules

## 0.1.5

- Code rewrite
- Restrict rules to be applied line-by-line
- Fix cursor being shifted after rules were executed

## 0.1.4

- Bugfix and change config to array

## 0.1.3

- Add support for regex flags per-rule (default: gm)

## 0.1.2

- Use settings object instead of separate json file

## 0.1.1

- Package data improvements
- Added keyboard shortcut (<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>R</kbd>)

## 0.1.0

- Initial release
