# Future Work

This file records possible changes that are not part of the current behavior.

## Config refresh

- Add an explicit refresh command if reloading the VS Code window becomes too heavy for config editing.
- Consider live reload by checking file `mtime` or using `FileSystemWatcher`.
- Keep the current session-level cache unless user workflows show that live reload is worth the added complexity.

## Diagnostics

- Add a command that validates the config file without running a rule.
- Report richer locations for invalid JSONC and invalid rule fields.

## Structure

- Split config parsing and command execution into separate modules if `src/editProvider.ts` keeps growing.

## Performance

- Benchmark replacement performance on large documents and many selections.
