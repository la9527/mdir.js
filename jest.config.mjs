/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  roots: [
    "<rootDir>/src"
  ],
  collectCoverageFrom: [
    "src/**/*.{ts,mts,js,mjs}",
    "!src/**/*.d.ts"
  ],
  setupFilesAfterEnv: [
    "<rootDir>/test/setupTests.ts"
  ],
  extensionsToTreatAsEsm: [".ts", ".mts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.mjs$": "$1.mts"
  },
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.{ts,mts,js,mjs}",
    "<rootDir>/src/**/__test__/**/*.{ts,mts,js,mjs}",
    "<rootDir>/src/**/*.{spec,test}.{ts,mts,js,mjs}"
  ],
  transform: {
    "^.+\\.(ts|mts)$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "<rootDir>/tsconfig.json"
      }
    ],
    "^.+\\.(js|mjs)$": "<rootDir>/node_modules/babel-jest",
    "^(?!.*\\.(ts|mts|js|mjs|json)$)": "<rootDir>/test/jest/fileTransform.mjs"
  },
  transformIgnorePatterns: [
    "[/\\\\]node_modules[/\\\\]"
  ],
  moduleFileExtensions: [
    "ts",
    "mts",
    "js",
    "mjs",
    "json",
    "node"
  ],
  watchPlugins: [
    "jest-watch-typeahead/filename",
    "jest-watch-typeahead/testname"
  ]
};

export default config;
