import { defineConfig } from "oxlint";
import native from "oxlint-config-universe/native";
import typescriptAnalysis from "oxlint-config-universe/typescript-analysis";

export default defineConfig({
  extends: [native, typescriptAnalysis],
  ignorePatterns: [
    "dist/**",
    "coverage/**",
    ".expo/**",
    "android/**",
    "ios/**",
  ],
  rules: {
    "import/no-cycle": "error",

    "react/display-name": "error",
    "react/jsx-key": "error",
    "react/jsx-no-comment-textnodes": "error",
    "react/jsx-no-duplicate-props": "error",
    "react/jsx-no-undef": "error",
    "react/no-children-prop": "error",
    "react/no-danger-with-children": "error",
    "react/no-direct-mutation-state": "error",
    "react/no-find-dom-node": "error",
    "react/no-is-mounted": "error",
    "react/no-render-return-value": "error",
    "react/no-string-refs": "error",
    "react/no-unescaped-entities": "error",
    "react/require-render-return": "error",

    "react/rules-of-hooks": "error",
    "react/exhaustive-deps": "error",

    "react/error-boundaries": "error",
    "react/globals": "error",
    "react/immutability": "error",
    "react/incompatible-library": "error",
    "react/preserve-manual-memoization": "error",
    "react/purity": "error",
    "react/refs": "error",
    "react/set-state-in-effect": "error",
    "react/set-state-in-render": "error",
    "react/static-components": "error",
    "react/unsupported-syntax": "error",
    "react/use-memo": "error",

    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "react",
            importNames: ["useEffect", "useLayoutEffect", "useInsertionEffect"],
            message:
              "useEffect は使わない（AGENTS.md）。操作の続きはイベントハンドラーで、外のものとの同期は useSubscription（@/lib/subscription）かストア（@/lib/store）で、要素に結びつくものは ref コールバックで書く。",
          },
          {
            name: "expo-router",
            importNames: ["useFocusEffect"],
            message:
              "useFocusEffect も effect。useIsFocused と useSubscription で書く。",
          },
          {
            name: "@react-navigation/native",
            importNames: ["useFocusEffect"],
            message:
              "useFocusEffect も effect。useIsFocused と useSubscription で書く。",
          },
        ],
      },
    ],
    "typescript/no-unsafe-type-assertion": "warn",
    "typescript/consistent-type-assertions": [
      "warn",
      { assertionStyle: "as", objectLiteralTypeAssertions: "never" },
    ],
    "no-empty": "warn",
    "no-nested-ternary": "warn",
    "no-magic-numbers": [
      "warn",
      {
        ignore: [-1, 0, 1, 2],
        ignoreArrayIndexes: true,
        ignoreDefaultValues: true,
        ignoreTypeIndexes: true,
        ignoreEnums: true,
        ignoreNumericLiteralTypes: true,
        ignoreReadonlyClassProperties: true,
      },
    ],
    "max-depth": ["warn", 4],
    "max-lines-per-function": [
      "warn",
      { max: 50, skipBlankLines: true, skipComments: true },
    ],
    "max-lines": [
      "warn",
      { max: 800, skipBlankLines: true, skipComments: true },
    ],
  },
  overrides: [
    {
      files: [
        "src/__tests__/**",
        "src/testing/**",
        "__mocks__/**",
        "*.config.{ts,mts,js}",
      ],
      rules: {
        "no-magic-numbers": "off",
        "max-lines-per-function": "off",
        "typescript/no-unsafe-type-assertion": "off",
      },
    },
  ],
});
