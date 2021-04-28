module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: [
        '@typescript-eslint',
        'jest',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:jest/recommended'
    ],
    env: {
        "node": true,
    },
    rules: {
        // force semi-colons: disable semi and enable TS semi
        "semi": "off",
        "@typescript-eslint/semi": ["error"],
        // do not consider unused function parameters, as it may change semantics
        "@typescript-eslint/no-unused-vars": ["error", { "args": "none" }],
        // allow explicit types even if inferrable
        "@typescript-eslint/no-inferrable-types": "off",
    }
};