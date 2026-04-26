# TextReplaceRule

**Originally forked from [bhughes339/vscode-replacerules](https://github.com/bhughes339/vscode-replacerules). TextReplaceRule is now an independent extension.**

TextReplaceRule runs named text-transformation rules from an external JSON or JSONC file. Rules can use either regular expressions or literal lookup maps, and rule pipelines can chain multiple rules in order.

## Getting started

1. Set `text-replace-rule.configPath` in `settings.json`.
2. Open the Command Palette and select **TextReplaceRule: Run Rule...** or **TextReplaceRule: Run Rule Pipeline...**.

## Configuration file

`text-replace-rule.configPath` points to a JSON or JSONC file with this top-level shape:

```json
{
  "rules": {},
  "rulePipelines": {}
}
```

- Absolute paths, workspace-relative paths, paths with spaces, and `~/` are supported.
- JSONC comments and trailing commas are supported.
- If `configPath` is unset or cannot be loaded, no TextReplaceRule configuration is available.

## Rule identity and display

Each entry in `rules` and `rulePipelines` is keyed by a stable object key. That key is used for references inside configuration.

- `name` is optional and controls the label shown in the Quick Pick UI.
    - If `name` is omitted, the object key is shown.
    - If `name` differs from the object key, the Quick Pick detail line shows the underlying key.
- `description` is optional and is shown as secondary text in the Quick Pick UI.

## Rule types

Every rule must declare `type`. Only two rule types are supported.

### `regexReplace`

Use `regexReplace` for one or more ordered regex replacement steps.

```json
{
  "type": "regexReplace",
  "name": "Wrap Block",
  "description": "Turn a single-line block into an indented multi-line block",
  "find": "^(\\s*)\\[(.*)\\](\\s*)$",
  "replace": "$1begin {\\n$1\\t$2\\n$1} end$3",
  "flag": "g",
  "post": ["expandTab"]
}
```

Supported fields:

- `type`: required, must be `regexReplace`
- `name`: optional display label
- `description`: optional display description
- `find`: required string or non-empty string array
- `replace`: optional string or string array aligned with `find`
- `flag`: optional string or string array aligned with `find`
- `language`: optional array of VS Code language ids
- `post`: optional array of post processors

Behavior:

- If `find` is an array, steps run sequentially.
- If `replace` is omitted, matches are deleted.
- If `flag` is omitted, the default is `gm`.
- Global matching is always enabled even if `g` is omitted.
- Replacement strings keep normal JavaScript replacement semantics such as `$1`, `$&`, and `$$`.

### `literalMap`

Use `literalMap` for bulk literal lookup-and-replace.

```json
{
  "type": "literalMap",
  "name": "Status Keywords",
  "language": ["markdown"],
  "map": {
    ":ok:": "[done]",
    ":warn:": "[needs-review]"
  }
}
```

Supported fields:

- `type`: required, must be `literalMap`
- `name`: optional display label
- `description`: optional display description
- `map`: required object from literal source string to literal replacement string
- `language`: optional array of VS Code language ids
- `post`: optional array of post processors

Behavior:

- `map` keys must be non-empty.
- `map` keys may not overlap by prefix. For example, `a` and `ab` in the same rule are rejected.
- `map` values are inserted literally. Tokens such as `$1` or `$&` are not expanded.

## Rule pipelines

`rulePipelines` runs named rules in order.

```json
{
  "name": "Cleanup Pipeline",
  "description": "Whitespace cleanup followed by block normalization",
  "rules": [
    "trim-whitespace",
    "wrap-block"
  ]
}
```

Supported fields:

- `name`: optional display label
- `description`: optional display description
- `rules`: required array of rule object keys

Behavior:

- Pipelines are sequential.
- Later rules see the output of earlier rules.
- Missing rule references are rejected during config load.

## Post-processing

`post` is a per-replacement post-processing stage. Values run in the order listed:

```json
{
  "post": ["removeBlankLine", "expandTab"]
}
```

- `expandTab` replaces `\t` in each replacement result with spaces using the active editor `tabSize`.
- `removeBlankLine` removes blank lines from each replacement result.

## Selection behavior

- If there is exactly one empty selection, the entire document is processed.
- Otherwise, each non-empty selection is processed independently.
- All rule steps run in memory first, and the extension commits the final changes through one editor edit operation.
- CRLF line endings are preserved.

## Complete example

```json
{
  "rules": {
    "trim-whitespace": {
      "type": "regexReplace",
      "name": "Trim Whitespace",
      "find": "^\\s*(.*)\\s*$",
      "replace": "$1"
    },
    "wrap-block": {
      "type": "regexReplace",
      "name": "Wrap Block",
      "description": "Turn a single-line block into an indented multi-line block",
      "find": "^(\\s*)\\[(.*)\\](\\s*)$",
      "replace": "$1begin {\\n$1\\t$2\\n$1} end$3",
      "flag": "g",
      "post": ["removeBlankLine", "expandTab"]
    },
    "status-keywords": {
      "type": "literalMap",
      "name": "Status Keywords",
      "description": "Normalize short status markers",
      "language": ["markdown"],
      "map": {
        ":ok:": "[done]",
        ":warn:": "[needs-review]"
      }
    }
  },
  "rulePipelines": {
    "cleanup": {
      "name": "Cleanup Pipeline",
      "description": "Whitespace cleanup followed by block normalization",
      "rules": [
        "trim-whitespace",
        "wrap-block"
      ]
    }
  }
}
```
