import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
  js.configs.recommended,
  {
    files: ["**/*.{ts,mts,cts}"],
    extends: tseslint.configs.recommended,
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: globals.node,
    },
  },
  globalIgnores([
    ".faas_debug_tmp/**",
    ".midway-run/**",
    ".midway-serverless/**",
    "coverage/**",
    "data/**",
    "dist/**",
    "logs/**",
    "run/**",
  ]),
]);
