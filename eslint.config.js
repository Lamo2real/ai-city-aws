import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/node_modules/**", "**/.venv/**", "**/.pytest_cache/**", "**/.mypy_cache/**", "**/.ruff_cache/**", "**/dist/**", "**/.terraform/**", "web/src/city/*.js", "ios/AICity/CityWeb/**", "web/test-results/**", "web/playwright-report/**", "coverage/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { process: "readonly", console: "readonly", URL: "readonly", setTimeout: "readonly", clearTimeout: "readonly", fetch: "readonly", Buffer: "readonly", AbortController: "readonly", TextEncoder: "readonly", TextDecoder: "readonly", structuredClone: "readonly" } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": ["error", { allow: ["error", "warn"] }],
    },
  },
  {
    files: ["scripts/**/*.mjs", "tests/**/*.ts"],
    rules: { "no-console": "off" },
  },
);
