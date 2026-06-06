import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // setState in effects is valid for Firestore onSnapshot subscriptions
      "react-hooks/set-state-in-effect": "off",
      // React compiler false positives for `let` in useMemo and Array.from in render
      "react-hooks/immutability": "off",
      "react-hooks/purity": "off",
      // Unused vars: warn only, prefix with _ to silence
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Project additions:
    "coverage/**",
    "playwright-report/**",
    ".lighthouseci/**",
    "**/*.cjs",
    "**/*.config.cjs",
  ]),
]);

export default eslintConfig;
