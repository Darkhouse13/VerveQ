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
    },
  },
  {
    files: [
      "src/test/**/*.ts",
      "src/test/**/*.tsx",
      "eslint-fixtures/**/*.ts",
      "eslint-fixtures/**/*.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          "selector": "TSTypeReference[typeName.name='Parameters']",
          "message": "Prefer explicit named testing seams (exported interfaces/types) over brittle 'Parameters<typeof ...>' inference in test code. See curatedParityFixtures.ts for a reference example."
        },
        {
          "selector": "TSTypeReference[typeName.name='ReturnType']",
          "message": "Prefer explicit named testing seams (exported interfaces/types) over brittle 'ReturnType<typeof ...>' inference in test code. See curatedParityFixtures.ts for a reference example."
        }
      ]
    }
  }
);
