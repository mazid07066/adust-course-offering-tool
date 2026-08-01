import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,

  globalIgnores([
    ".next/**",
    "node_modules/**",
    "dist/**",
    "build/**",
    "coverage/**",
    "out/**",

    /*
     * Development and maintenance scripts intentionally use Node CommonJS
     * require() style. They are not part of the Next.js runtime bundle.
     */
    "scripts/**",

    /*
     * Generated files, diagnostics, and project dumps must not participate
     * in application lint checks.
     */
    "*.dump.*",
    "*_dump.*",
    "project_full_dump*.txt",
    "reporting_scheduling_upgrade_dump.txt",
    "git_project_history_dump.txt",
    "env_structure_safe_dump.txt",
  ]),

  {
    files: ["**/*.{ts,tsx,js,jsx}"],

    rules: {
      /*
       * The existing application contains Prisma dynamic queries, legacy API
       * payloads, and report mappers where `any` remains intentional.
       */
      "@typescript-eslint/no-explicit-any": "off",

      /*
       * Existing client pages intentionally load data through effects.
       */
      "react-hooks/set-state-in-effect": "off",

      /*
       * API download endpoints are intentionally addressed through URLs.
       */
      "@next/next/no-html-link-for-pages": "off",

      /*
       * Preserve existing development behavior while reporting old unused
       * variables without failing the entire lint command.
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
]);

export default eslintConfig;
