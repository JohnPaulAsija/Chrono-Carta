import type { Config } from "jest";

// Each project's `roots` scopes test discovery to its own directory
// under `tests/`. This sidesteps two cross-cutting issues with the
// previous `<rootDir>/tests/...` testMatch pattern:
//   1. On Windows, `<rootDir>` substitution inside a glob produces a
//      mixed-slash path that Jest's glob layer fails to resolve when
//      run from a worktree under .worktrees/. Result: zero tests.
//   2. From the main checkout, a `**/tests/...` testMatch would also
//      walk into .worktrees/<phase>/tests/ and double-count tests that
//      live inside a worktree.
// Combined with `modulePathIgnorePatterns` for the haste map (so
// duplicate package.json entries from worktrees don't collide), this
// keeps each checkout's discovery scoped to its own tests/.
const config: Config = {
  modulePathIgnorePatterns: ["<rootDir>/.worktrees/"],
  projects: [
    {
      displayName: "unit",
      testEnvironment: "jsdom",
      roots: ["<rootDir>/tests/unit"],
      testMatch: ["**/*.test.ts?(x)"],
      setupFilesAfterEnv: ["<rootDir>/jest.setup.unit.ts"],
      transform: {
        "^.+\\.(ts|tsx)$": [
          "ts-jest",
          { tsconfig: "<rootDir>/tsconfig.json" },
        ],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
      },
    },
    {
      displayName: "integration",
      testEnvironment: "node",
      roots: ["<rootDir>/tests/integration"],
      testMatch: ["**/*.test.ts"],
      transform: {
        "^.+\\.ts$": [
          "ts-jest",
          { tsconfig: "<rootDir>/tsconfig.json" },
        ],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
      },
    },
  ],
};

export default config;
