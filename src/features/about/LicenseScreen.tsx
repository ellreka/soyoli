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
  text: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
});
