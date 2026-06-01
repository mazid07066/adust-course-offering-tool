import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "out/**",

      /*
       * Development/maintenance scripts intentionally use Node CommonJS
       * require() style. They are not part of the Next.js runtime bundle.
       */
      "scripts/**",

      /*
       * Generated and dump files should never participate in lint checks.
       */
      "*.dump.*",
      "*_dump.*",
      "project_full_dump*.txt",
      "reporting_scheduling_upgrade_dump.txt",
      "git_project_history_dump.txt",
      "env_structure_safe_dump.txt",
    ],
  },

  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    rules: {
      /*
       * This codebase has many Prisma dynamic queries, legacy route payloads,
       * and report mappers where `any` was already used before S1-B.
       * Keep builds stable while later refactors can tighten individual files.
       */
      "@typescript-eslint/no-explicit-any": "off",

      /*
       * Next/React 19 lint now warns against common data-loading effects.
       * Existing pages use useEffect-based data loading intentionally.
       */
      "react-hooks/set-state-in-effect": "off",

      /*
       * API download endpoints are intentionally linked by URL.
       */
      "@next/next/no-html-link-for-pages": "off",

      /*
       * Keep these as warnings so development is not blocked by old unused
       * variables while major ERP expansion packages are being added.
       */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "react-hooks/exhaustive-deps": "warn",
    },
  },
];

export default eslintConfig;