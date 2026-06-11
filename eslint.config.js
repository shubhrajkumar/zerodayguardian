// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import caseSensitiveImports from "./eslint/rules/case-sensitive-imports.js";

// Cyber Rationale: Last matching config wins in flat config format.
// The storybook recommended config enables no-renderer-packages, but Meta/StoryObj
// types live in @storybook/react (not the framework package). We must override AFTER.
export default [
  ...tseslint.config(
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
        "case-sensitive-imports": { rules: { "case-sensitive-imports": caseSensitiveImports } },
      },
      rules: {
        ...reactHooks.configs.recommended.rules,
        "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/no-explicit-any": "warn",
        "case-sensitive-imports/case-sensitive-imports": "error",
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
    },
  ),

  // Storybook recommended config (sets no-renderer-packages to error)
  ...storybook.configs["flat/recommended"],

  // Cyber Rationale: Override AFTER storybook config — in flat config, last match wins.
  // Storybook types (Meta, StoryObj) must be imported from @storybook/react for TypeScript,
  // but the no-renderer-packages rule forbids that. Disable for story files.
  {
    files: ["**/*.stories.tsx", "**/*.stories.ts"],
    rules: {
      "storybook/no-renderer-packages": "off",
    },
  },
];
