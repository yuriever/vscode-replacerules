# Replace Rules

Create search/replace rules. A "rule" is one or more search/replace patterns that can be applied to the entire document, or one or more selections of text.

Replace Rules uses JavaScript regular expressions for searching and replacing. [Click here](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions) for an overview of JavaScript RegEx.

Inspired by the Sublime Text plugin [RegReplace](https://github.com/facelessuser/RegReplace).

## Getting started

1. Set `replacerules.configPath` in `settings.json`.

2. Open the Command Palette and select **Replace Rules: Run Rule...**.

## Configuration options

### Configuration file format

The JSON file pointed to by `replacerules.configPath` contains `rules` and `rulesets`.

#### Rules

`rules` is a dictionary of objects, each of which represents a single find/replace rule. A rule consists of the following components:

- Object key - (Required) The description of the rule that will appear in the command palette.
- `find` - (Required) A sequence of regular expressions to be searched on. Can be a single string or an array of strings.
    - Note: Regular expressions need to be properly escaped for use in VSCode settings strings. If you're unsure how to do this, **Replace Rules: Stringify regular expression** from the Command Palette will do it for you.
- `replace` - (Optional) A sequence of strings used as replacements. Can be a single string or an array of strings. If this is an empty string or unspecified, each instance of `find` will be deleted.
- `flags` - (Optional) A set of RegEx flags to apply to the rule. If only one set of flags is specified, it will be applied to all `finds` in the rule. The default flags are "gm" (global, multi-line). A list of compatible flags can be found [here](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#Advanced_searching_with_flags).
- `languages` - (Optional) An array of workspace language ids that the rule is restricted to. For example, a rule with `languages` set to 'typescript' will only appear in the **Run Rule...** menu if TypeScript is the selected language for the active document.
- `literal` - (Optional) Perform a non-RegEx, literal search and replace.

#### Rulesets

`rulesets` is a dictionary of objects that run a sequence of rules defined in `rules`. The rules are run in the order they are listed in the `rules` option:

- Object key - (Required) The description of the ruleset that will appear in the command palette.
- `rules` - (Required) An array of rules to be run when the ruleset is called.

### External configuration file

`replacerules.configPath` points to a JSON file that contains `rules` and `rulesets`.

- Absolute paths are supported.
- Windows-style backslashes are passed through as written in `settings.json`.
- Paths containing spaces are supported.
- `~/` expands to the current home directory.
- Relative paths are resolved from the current workspace folder when one exists.
- If `configPath` is unset or the file cannot be loaded, no Replace Rules configuration is available.

## Example configuration

```json
"replacerules.configPath": "xxxx.json"
```

External file contents:

```json
{
    "rules": {
        "Remove trailing and leading whitespace": {
            "find": "^\\s*(.*)\\s*$",
            "replace": "$1"
        }
    },
    "rulesets": {
        "Remove lots of stuff": {
            "rules": [
                "Remove trailing and leading whitespace"
            ]
        }
    }
}
```

## Other features

### Stringify regular expression

Formats a valid regular expression in JSON string format for use in rule objects.

- Command palette: **Replace Rules: Stringify regular expression**
- Accepts either a bare pattern such as `(.*)` or a literal-style input such as `/foo/i`
- When literal-style input includes flags, the escaped pattern is still copied by itself, and the flags are shown in the message so they can be placed in the rule's `flags` field
