// @ts-check

import eslintReact from "@eslint-react/eslint-plugin";
import hooksPlugin from "eslint-plugin-react-hooks";
import reactYouMightNotNeedAnEffect from "eslint-plugin-react-you-might-not-need-an-effect";

export default [
  reactYouMightNotNeedAnEffect.configs.recommended,
  eslintReact.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    settings: {
      react: {
        version: "detect",
      },
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
  {
    plugins: {
      "react-hooks": hooksPlugin,
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      ...hooksPlugin.configs.recommended.rules,
    },
  },
  { files: ["**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}"] },
  {
    rules: {
      "@eslint-react/no-leaked-conditional-rendering": "error",
      "react-hooks/exhaustive-deps": "off",
      "@eslint-react/no-context-provider": "off",
      "@eslint-react/no-unstable-default-props": "off",
      "no-restricted-imports": [
        "error",
        {
          name: "next/link",
          message: "Please import from `vitnode-frontend/navigation` instead.",
        },
        {
          name: "next/navigation",
          importNames: [
            "redirect",
            "permanentRedirect",
            "useRouter",
            "usePathname",
          ],
          message: "Please import from `vitnode-frontend/navigation` instead.",
        },
        {
          name: "next/router",
          importNames: ["useRouter"],
          message:
            "This import is from Page router. Please import from `vitnode-frontend/navigation` instead.",
        },
      ],
    },
  },
];
