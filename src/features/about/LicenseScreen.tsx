import { router, useLocalSearchParams } from "expo-router";
import { Linking, StyleSheet, Text } from "react-native";

import { Pressable } from "@/components/Pressable";
import { EmptyState, Screen } from "@/components/Screen";
import { colors } from "@/constants/theme";
import { findPackage } from "./licenses";

function back(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/settings/licenses");
  }
}

/**
 * 設定 › オープンソースライセンス › ライブラリ: そのライブラリの
 * ライセンスの本文。本文を同梱していないライブラリは、ライセンスの名前と
 * ページだけを出す。
 */
export default function LicenseScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const item = id ? findPackage(id) : undefined;
  if (!item) {
    return (
      <Screen title="ライセンス" onBack={back}>
        <EmptyState
          icon="file"
          title="見つかりません"
          description="このライブラリは一覧にありません。"
        />
      </Screen>
    );
  }
  const { homepage } = item;
  return (
    <Screen
      title={item.name}
      subtitle={[item.version, item.license].filter(Boolean).join(" · ")}
      onBack={back}
    >
      {homepage !== undefined && (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${item.name}のページを開く`}
          onPress={() => {
            // 開けなくても、ここですることはない: アドレスは見えている。
            Linking.openURL(homepage).catch(() => undefined);
          }}
        >
          <Text style={styles.link}>{homepage}</Text>
        </Pressable>
      )}
      <Text testID="license-text" style={styles.text} selectable>
        {item.text ??
          `このライブラリはライセンスの本文を同梱していません。ライセンスは ${item.license} です。`}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: {
    color: colors.text,
    fontSize: 13,
    textDecorationLine: "underline",
  },
  // 本文は桁をそろえて書かれていることが多い: 折り返しても読める大きさにする。
  text: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
});
