/** Auto-managed by 0xstack baseline — PRD architecture boundary (no-restricted-imports). */
export default [
  {
    files: ["app/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/lib/repos", "@/lib/repos/*"],
              message: "Use server actions or loaders — do not import repos from app/.",
            },
            {
              group: ["@/lib/db", "@/lib/db/*"],
              message: "Do not import Drizzle/db from app/; use repos via server layers.",
            },
          ],
        },
      ],
    },
  },
];
