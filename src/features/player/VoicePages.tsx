import { router } from "expo-router";
import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { IconButton } from "@/components/IconButton";
import { colors, gutter } from "@/constants/theme";
import { BracketVoiceList } from "./BracketVoiceList";

function close() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/settings");
  }
}

/**
 * 音声設定のページを、リーダー（それ自体がモーダル）の上に全画面で出す:
 * 中身は設定タブのページと同じで、閉じるボタンが付く。
 */
function ModalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    // 全画面モーダルは独立したネイティブのウィンドウ: セーフエリアは下の
    // 画面から受け継がず、ここで計測する。
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <IconButton icon="x" label="閉じる" onPress={close} />
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {children}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

/** カッコの声。リーダーから開く。 */
export function BracketVoicesModal() {
  return (
    <ModalPage title="カッコ別の音声">
      <BracketVoiceList />
    </ModalPage>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 52,
    paddingHorizontal: 8,
  },
  title: { color: colors.text, fontWeight: "600", fontSize: 17 },
  content: { gap: 28, paddingHorizontal: gutter, paddingVertical: 16 },
});
