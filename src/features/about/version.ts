import Constants from "expo-constants";

export function appVersion(): string {
  return Constants.expoConfig?.version ?? "";
}
