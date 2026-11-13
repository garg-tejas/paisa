// Flat ESLint config for Next.js 16 (the old `next lint` command was removed).
// Run with: npm run lint  (eslint .)
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", "public/**"],
  },
];

export default eslintConfig;
