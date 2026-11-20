import { Host } from "@expo/ui";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { IconButton } from "@/components/IconButton";
import { colors, gutter } from "@/constants/theme";

export const rowColors = {
  containerColor: colors.background,
  contentColor: colors.text,
  supportingContentColor: colors.secondary,
  trailingContentColor: colors.secondary,
};

interface SettingsPageProps {
  title: string;
  onBack?: () => void;
  children: ReactNode;
}

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
  back: { marginLeft: -12 },
  title: { color: colors.text, fontWeight: "700", fontSize: 28 },
  host: { flex: 1 },
});
