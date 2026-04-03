import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["src/context/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["src/test/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: [
      "src/lib/aiLearningEngine.ts",
      "src/lib/autoBugFixer.ts",
      "src/lib/gamificationSystem.ts",
      "src/lib/toolConfigTest.ts",
      "src/lib/toolConfigValidation.ts",
      "src/lib/zorvixAI.ts",
      "src/pages/OsintPage.tsx",
      "src/pages/OsintSharePage.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: [
      "src/components/ZorvixEnhanced.tsx",
      "src/context/MissionSystemContext.tsx",
      "src/pages/ProgramLabPage.tsx",
    ],
    rules: {
      "react-hooks/exhaustive-deps": "off",
    },
  }
);
