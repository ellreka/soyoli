import { defineConfig } from "oxlint";
import native from "oxlint-config-universe/native";
import typescriptAnalysis from "oxlint-config-universe/typescript-analysis";

// 土台: Expo の oxlint プリセット（React Native + 型情報を使う TypeScript
// ルール）。下の上書きは、eslint-config-expo が有効にしていたのに universe
// プリセットが外したり弱めたりしているものを戻す。
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
    // 層は一方向（AGENTS.md）: どのモジュールも import をたどって自分に
    // 戻ってこない。
    "import/no-cycle": "error",

    // eslint-plugin-react `recommended`
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

    // eslint-plugin-react-hooks `recommended`
    "react/rules-of-hooks": "error",
    "react/exhaustive-deps": "warn",

    // React Compiler rules (app.json enables experiments.reactCompiler)
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
  },
});
