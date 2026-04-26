# src/test/suite/index.ts

## Purpose

This file discovers compiled test files and runs them through Mocha.

## Main function

- run(): Promise<void>

## Execution flow

1. Create a Mocha instance with TDD UI and color output.
2. Resolve testsRoot to out/test.
3. Use glob to find compiled test files matching **/**.test.js.
4. Add each file to the Mocha runner.
5. Execute mocha.run and resolve or reject based on failure count.

## Why this file exists

- Keeps test discovery logic separate from test cases.
- Provides a single async entry point for runTest.ts.

## Maintenance notes

- This file operates on compiled JavaScript output, not TypeScript source files.
- If the test naming convention changes, update the glob pattern here.
