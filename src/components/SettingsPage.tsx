import { Host } from "@expo/ui";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IconButton } from "@/components/IconButton";
import { colors, gutter } from "@/constants/theme";

/** Android: 行は Material のサーフェスではなく、アプリの背景に載る。 */
export const rowColors = {
  containerColor: colors.background,
  contentColor: colors.text,
  supportingContentColor: colors.secondary,
  trailingContentColor: colors.secondary,
};

interface SettingsPageProps {
  title: string;
  /** タイトルの上に戻るボタンを出す。一覧から開いたページ用。 */
  onBack?: () => void;
  /** Expo UI の中身: `ListItem` の入った `List`。 */
  children: ReactNode;
}

/**
 * プラットフォーム自身のリスト（Expo UI: iOS は SwiftUI、Android は
 * Material 3）で作る設定ページ。行の見た目もタッチへの反応もシステムのものと
 * 同じになる。タイトルは、その上にある React Native のビューのまま。
 */
export function SettingsPage({ title, onBack, children }: SettingsPageProps) {
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        {onBack && (
          <View style={styles.back}>
            <IconButton icon="chevron-left" label="戻る" onPress={onBack} />
          </View>
        )}
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      </View>
      <Host colorScheme="dark" style={styles.host}>
        {children}
      </Host>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: gutter, paddingTop: 12, paddingBottom: 12 },
  // アイコンのタップ領域を外へ出して、字形がタイトルと揃うようにする。
  back: { marginLeft: -12 },
  title: { color: colors.text, fontWeight: "700", fontSize: 28 },
  host: { flex: 1 },
});
