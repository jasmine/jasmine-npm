import { defineConfig, globalIgnores } from "eslint/config";
import jasmine from 'eslint-plugin-jasmine';
import globals from 'globals';

export default defineConfig([globalIgnores([
    "spec/fixtures/cjs-syntax-error/syntax_error.js",
    "spec/fixtures/esm-importing-commonjs-syntax-error/syntax_error.js",
    "spec/fixtures/js-loader-import/*.js",
    "spec/fixtures/js-loader-default/*.js",
    "spec/fixtures/esm-reporter-packagejson/customReporter.js",
]), {
    languageOptions: {
        globals: {
            ...globals.commonjs,
            ...globals.node,
            Atomics: 'readonly',
            SharedArrayBuffer: 'readonly',
            expectAsync: 'readonly',
        },

        ecmaVersion: 2022,
        sourceType: 'commonjs',
    },

    plugins: {
        jasmine,
    },

    rules: {
        "no-unused-vars": ["error", {
            args: "none",
        }],
        eqeqeq: 'error',
        "func-call-spacing": ["error", "never"],
        "key-spacing": "error",
        "no-tabs": "error",
        "no-whitespace-before-property": "error",
        semi: ["error", "always"],
        "space-before-blocks": "error",
        'no-var': 'error',
    },
}]);
