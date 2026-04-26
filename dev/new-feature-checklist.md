# Feature Checklist

## Before coding

- Define the user-visible behavior.
- Decide whether the change affects:
    - config schema
    - command surface
    - quick pick display
    - replace semantics

## Implementation

- Register command changes in `package.json` and `src/extension.ts`.
- Keep replace logic in `src/editProvider.ts` unless a new module is justified.
- Reject invalid config explicitly; do not add quiet compatibility paths by accident.

## Tests

- Add or update integration coverage in `src/test/suite/extension.test.ts`.
- Cover at least:
    - happy path
    - invalid config
    - selection behavior
    - language filtering if relevant

## Docs

- Update `README.md` for user-facing changes.
- Update `CHANGELOG.md` for release-facing changes.
- Update `dev/` docs only if the internal workflow or code structure changed.

## Final check

- `npm run compile`
- `npm test`
- inspect `git diff --stat`
