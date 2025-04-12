import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([globalIgnores([
    "spec/fixtures/cjs-syntax-error/syntax_error.js",
    "spec/fixtures/esm-importing-commonjs-syntax-error/syntax_error.js",
    "spec/fixtures/js-loader-import/*.js",
    "spec/fixtures/js-loader-default/*.js",
    "spec/fixtures/esm-reporter-packagejson/customReporter.js",
]), {
    languageOptions: {
        ecmaVersion: 11,
        sourceType: "script",
    },

    rules: {
        "no-unused-vars": ["error", {
            args: "none",
        }],

        "block-spacing": "error",
        "func-call-spacing": ["error", "never"],
        "key-spacing": "error",
        "no-tabs": "error",
        "no-whitespace-before-property": "error",
        semi: ["error", "always"],
        "space-before-blocks": "error",
    },
}]);