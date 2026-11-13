import { useRef, type ReactNode } from "react";
import { useScrollToTop } from "expo-router";
import {
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, gutter } from "@/constants/theme";
import { Icon, type IconName } from "./Icon";
import { IconButton } from "./IconButton";

interface ScreenProps {
  title: string;
  /** 内容についての事実（件数）。ページの説明ではない。 */
  subtitle?: string;
  /** タイトルの上に戻るボタンを出す。別のページから開いたページ用。 */
  onBack?: () => void;
  /** タイトルの右に出すアイコンボタン。 */
  actions?: ReactNode;
  /** 引き下げてページを読み込み直せるようにする。 */
  onRefresh?: () => void;
  /** 読み込み直しの最中かどうか。スピナーを出したままにする。 */
  refreshing?: boolean;
  children: ReactNode;
}

/** 内容と一緒にスクロールして消える、大きなタイトルのあるページ。 */
export function Screen({
  title,
  subtitle,
  onBack,
  actions,
  onRefresh,
  refreshing = false,
  children,
}: ScreenProps) {
  // このページのあるタブを押すと、先頭までスクロールして戻る。
  const scroll = useRef<ScrollViewInstance>(null);
  useScrollToTop(scroll);
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        testID={onRefresh ? "refreshable" : undefined}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.secondary}
              colors={[colors.text]}
              progressBackgroundColor={colors.surface}
            />
          ) : undefined
        }
      >
        {onBack && (
          <View style={styles.back}>
            <IconButton icon="chevron-left" label="戻る" onPress={onBack} />
          </View>
        )}
        <View style={styles.header}>
          <View style={styles.titles}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

interface SectionProps {
  title: string;
  children: ReactNode;
}

/** 画面の中の、ラベルの付いた内容のまとまり。 */
export function Section({ title, children }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

interface EmptyStateProps {
  icon: IconName;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={28} color={colors.secondary} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    gap: 28,
    paddingHorizontal: gutter,
    paddingTop: 12,
    paddingBottom: 32,
  },
  // アイコンのタップ領域を外へ出して、字形がタイトルと揃うようにする。
  back: { marginLeft: -12, marginBottom: -20 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  titles: { flex: 1, gap: 4 },
  title: { color: colors.text, fontWeight: "700", fontSize: 28 },
  subtitle: {
    color: colors.secondary,
    fontWeight: "400",
    fontSize: 13,
  },
  actions: { flexDirection: "row", marginRight: -10 },
  section: { gap: 12 },
  sectionTitle: {
    color: colors.secondary,
    fontWeight: "500",
    fontSize: 13,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 48,
  },
  emptyTitle: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 16,
    textAlign: "center",
  },
  emptyDescription: {
    color: colors.secondary,
    fontWeight: "400",
    fontSize: 13,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 300,
  },
});
