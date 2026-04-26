# [TextReplaceRule](https://github.com/yuriever/vscode-replacerules.git)

**Originally forked from [bhughes339/vscode-replacerules](https://github.com/bhughes339/vscode-replacerules). TextReplaceRule is now an independent extension.**

TextReplaceRule runs text replacement rules in VS Code from an external JSON file.

Supported rule types:

- `regexReplace`
- `literalMap`
- `rulePipelines` (ordered rule chains)

## Setup

1. Create config file and set `text-replace-rule.configPath` in `settings.json`.

2. Run command from the Command Palette:
    - **TextReplaceRule: Run Rule...**
    - **TextReplaceRule: Run Rule Pipeline...**

## Config File

- Root shape:

    ```jsonc
    {
        "rules": {},
        "rulePipelines": {}
    }
    ```

- `configPath` supports absolute paths, workspace-relative paths, paths with spaces, and `~/`.
- JSONC comments and trailing commas are supported.
- Changing `text-replace-rule.configPath` is picked up automatically.
- Editing the external config file itself requires **Developer: Reload Window**.
- If `configPath` is unset or invalid, no rules are available.

## Selection Scope

- One empty selection processes the whole document.
- Non-empty selections are processed independently.
- One command run is applied as one VS Code edit operation.
- CRLF line endings are preserved.

## Rules

Optional fields supported by both rules and pipelines:

- `name`: Quick Pick label
- `description`: Quick Pick secondary text

### `regexReplace`

Required:

- `type`: `"regexReplace"`
- `find`: string or non-empty string array

Optional:

- `replace`: string or string array aligned with `find`
- `flag`: string or string array aligned with `find`
- `language`: array of VS Code language ids
- `post`: array of post processors

Behavior:

- Array `find` values run as ordered steps.
- Missing `replace` deletes matches.
- Missing `flag` defaults to `g`; multiline anchors such as `^` and `$` require explicit `m`.
- Replacement strings use normal JavaScript replacement tokens such as `$1`, `$&`, and `$$`.

### `literalMap`

Required:

- `type`: `"literalMap"`
- `map`: object from literal source text to literal replacement text

Optional:

- `language`: array of VS Code language ids
- `post`: array of post processors

Behavior:

- Map keys must be non-empty.
- Keys may not overlap by prefix. For example, `a` and `ab` in the same map are rejected.
- Values are inserted literally. `$1` and `$&` are not expanded.

## Rule Pipelines

Required:

- `rules`: array of rule keys

Behavior:

- Rules run in listed order.
- Missing rule references are rejected when the config loads.
- Language-restricted rules are skipped when the active document language does not match.

## Post-Processing

`post` runs on each replacement result in listed order.

Available processors:

- `indentLine`/`alignLine`: derive prefix from the original document line at the selection start:
    - `indentLine` uses the exact text from line start to selection start only when that text is all whitespace. Otherwise it adds nothing.
    - `alignLine` keeps whitespace characters as-is and replaces every non-whitespace character before the selection with a plain space, so later lines align to the selection column even for inline replacements.

- `expandTab`: replace tabs with spaces using the active editor `tabSize`

- `removeBlankLine`: remove blank lines, including whitespace-only lines

Recommended order for multiline formatting is `["indentLine"/"alignLine", "expandTab", "removeBlankLine"]`.

## Example

```jsonc
{
  "rules": {
    "trim-trailing-space": {
      "type": "regexReplace",
      "name": "Trim Trailing Space",
      "find": "[ \\t]+$",
      "replace": "",
      "flag": "gm"
    },
    "status-keywords": {
      "type": "literalMap",
      "name": "Status Keywords",
      "language": ["markdown"],
      "map": {
        ":ok:": "[done]",
        ":warn:": "[needs-review]"
      }
    },
    "wrap-block": {
      "type": "regexReplace",
      "name": "Wrap Block",
      "find": "^(\\s*)\\[(.*)\\](\\s*)$",
      "replace": "$1begin {\\n$1\\t$2\\n$1} end$3",
      "flag": "g",
      "post": ["expandTab"]
    },
    "latex-inline-lr": {
      "type": "regexReplace",
      "name": "LaTeX Inline LR",
      "find": "^\\((.*)\\)$",
      "replace": "\\LR{\\n\\t$1\\n}",
      "post": ["alignLine", "expandTab"]
    },
    "latex-wrap-equation": {
      "type": "regexReplace",
      "name": "LaTeX Wrap Equation",
      "find": "^(.*)$",
      "replace": "\\begin{equation}\\n\\t$1\\n\\end{equation}",
      "post": ["indentLine", "expandTab"]
    }
  },
  "rulePipelines": {
    "markdown-cleanup": {
      "name": "Markdown Cleanup",
      "description": "Trim trailing spaces and normalize status markers",
      "rules": ["trim-trailing-space", "status-keywords"]
    }
  }
}
```
