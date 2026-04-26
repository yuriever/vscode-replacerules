# Agent Operating Rules

- Do not run any deletion commands or variants. When cleanup is needed, provide a list of candidate paths and let the user delete them.
- Running npm scripts is allowed for build and test verification.
- Downloading test dependencies, including VS Code test builds used by `@vscode/test-electron`, is allowed when needed to run the test suite.
