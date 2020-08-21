module.exports = {
    roots: [
      "<rootDir>/src"
    ],
    collectCoverageFrom: [
      "src/**/*.{js,ts}",
      "!src/**/*.d.ts"
    ],
    setupFiles: [],
    setupFilesAfterEnv: [
      "<rootDir>/test/setupTests.ts"
    ],
    testMatch: [
      "<rootDir>/src/**/__tests__/**/*.{js,ts}",
      "<rootDir>/src/**/*.{spec,test}.{js,ts}"
    ],
    transform: {
      "^.+\\.(js|ts)$": "<rootDir>/node_modules/babel-jest",
      "^(?!.*\\.(js|ts|json)$)": "<rootDir>/test/jest/fileTransform.js"
    },
    transformIgnorePatterns: [
      "[/\\\\]node_modules[/\\\\].+\\.(js|ts)$"
    ],
    "modulePaths": [],
    "moduleFileExtensions": [
      "js",
      "ts",
      "json",
      "node"
    ],
    "watchPlugins": [
      "jest-watch-typeahead/filename",
      "jest-watch-typeahead/testname"
    ]
};