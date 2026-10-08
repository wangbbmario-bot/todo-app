/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint", "react", "react-hooks", "jsx-a11y", "import"],
  settings: {
    react: { version: "detect" },
    "import/resolver": {
      typescript: true,
      node: true,
    },
  },
  rules: {
    // TypeScript
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/consistent-type-imports": [
      "warn",
      { prefer: "type-imports", fixStyle: "separate-type-imports" },
    ],

    // React
    "react/prop-types": "off",
    "react/self-closing-comp": "warn",
    "react/jsx-sort-props": ["warn", { callbacksLast: true, shorthandFirst: true }],

    // Import
    "import/order": [
      "warn",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          ["parent", "sibling", "index"],
          "type",
        ],
        "newlines-between": "always",
        alphabetize: { order: "asc", caseInsensitive: true },
      },
    ],
    "import/no-duplicates": "warn",
    "import/no-unused-modules": "warn",

    // 通用
    "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    "prefer-const": "warn",
    "no-var": "error",
    "eqeqeq": ["error", "always", { null: "ignore" }],
  },
  ignorePatterns: [
    "node_modules",
    ".next",
    "dist",
    "build",
    "coverage",
    "*.config.js",
    "*.config.ts",
    "pnpm-lock.yaml",
  ],
};
