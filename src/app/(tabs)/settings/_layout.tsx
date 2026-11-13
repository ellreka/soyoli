import { Stack } from "expo-router";

// 設定のページを直接開いても、戻る先の一覧が下にある。
export const unstable_settings = { anchor: "index" };

/** 設定タブ: 項目の一覧で、それぞれが自分のページを開く。 */
export default function SettingsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
