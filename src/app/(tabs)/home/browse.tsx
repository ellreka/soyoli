import { router, useLocalSearchParams } from "expo-router";
import { NativeButton } from "@/components/NativeButton";
import { Platform } from "react-native";

import { EmptyState, Screen } from "@/components/Screen";
import { BrowserView } from "@/features/browser/BrowserView";
import { urlFromParam } from "@/features/web/browser";

function close(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    // 直リンクで開かれ、下に何もない: ホームへ戻す。
    router.replace("/home");
  }
}

/**
 * 1 回分のブラウジング。表示するページ（`?url=`）を付けて開く。ホームタブの
 * 画面: タブバーとミニプレーヤーはその下に残る。
 */
export default function BrowseScreen() {
  const params = useLocalSearchParams<{ url?: string }>();
  const url = urlFromParam(params.url);
  const unavailable = Platform.OS === "web";
  if (!unavailable && url) {
    return <BrowserView key={url} startUrl={url} onClose={close} />;
  }
  return (
    <Screen title="ブラウザ">
      {unavailable ? (
        <EmptyState
          icon="globe"
          title="アプリ内ブラウザは使えません"
          description="Web版では対応サイトを表示できません。iOS・Androidのアプリで開いてください。"
        />
      ) : (
        <EmptyState
          icon="globe"
          title="ページを開けません"
          description="開くページが指定されていないか、Webページではありません。"
        />
      )}
      <NativeButton label="閉じる" onPress={close} />
    </Screen>
  );
}
