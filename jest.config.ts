import type { Config } from "jest";

const config: Config = {
  projects: [
    {
      displayName: "unit",
      testEnvironment: "jsdom",
      testMatch: ["<rootDir>/tests/unit/**/*.test.ts?(x)"],
      setupFilesAfterEnv: ["<rootDir>/jest.setup.unit.ts"],
      transform: {
        "^.+\\.(ts|tsx)$": [
          "ts-jest",
          { tsconfig: "<rootDir>/tsconfig.json", isolatedModules: true },
        ],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
      },
    },
    {
      displayName: "integration",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
      transform: {
        "^.+\\.ts$": [
          "ts-jest",
          { tsconfig: "<rootDir>/tsconfig.json", isolatedModules: true },
        ],
      },
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
      },
    },
  ],
};

export default config;
