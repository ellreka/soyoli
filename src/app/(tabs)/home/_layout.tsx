import { Stack } from "expo-router";

// ブラウザを直接開いても、閉じて戻る先のホームが下にある。
export const unstable_settings = { anchor: "index" };

/**
 * ホームタブ: 作品を探す場所と、それを見つけるアプリ内ブラウザ。ブラウザは
 * アプリ全体を覆う画面ではなくこのタブの画面なので、タブバーに手が届き、
 * 読者が別のタブにいる間もページは開いたままになる。
 */
export default function HomeLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
