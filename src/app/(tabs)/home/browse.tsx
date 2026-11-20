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
    router.replace("/home");
  }
}

export default function BrowseScreen() {
  const params = useLocalSearchParams<{ url?: string; at?: string }>();
  const url = urlFromParam(params.url);
  const unavailable = Platform.OS === "web";
  if (!unavailable && url) {
    return (
      <BrowserView
        key={`${params.at ?? ""} ${url}`}
        startUrl={url}
        onClose={close}
      />
    );
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
