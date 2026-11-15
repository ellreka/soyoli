import Constants from "expo-constants";

/** アプリのバージョン（`app.json` の `version`）。ビルドに埋め込まれている。 */
export function appVersion(): string {
  return Constants.expoConfig?.version ?? "";
}
