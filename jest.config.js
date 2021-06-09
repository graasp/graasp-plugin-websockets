module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ["/node_modules/", "/dist/", "/test/"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  verbose: true,
  moduleNameMapper: {
    "graasp": "<rootDir>/node_modules/@types/graasp/index.d.ts"
  },
  transformIgnorePatterns: [
    "node_modules/@types/(?!graasp)"
  ],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    }
  }
};