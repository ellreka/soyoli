import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/theme";
import { Icon } from "./Icon";
import { NativeButton } from "./NativeButton";
import { Pressable } from "./Pressable";
import { SelectionMark } from "./SelectionMark";

/** 行末に置く 2 つ目の操作部品。 */
export interface RowAction {
  label: string;
  /** ラベルより詳しく言えるとき、スクリーンリーダーが代わりに読む。 */
  accessibilityLabel?: string;
  /** text: 控えめ（既定）。outlined: 行の文字から区別する。 */
  variant?: "text" | "outlined";
  onPress: () => void;
}

export interface NativeRowProps {
  title: string;
  /** タイトルの下の、控えめな 2 行目。 */
  detail?: string;
  /** タイトルより詳しく言えるとき、スクリーンリーダーが代わりに読む。 */
  accessibilityLabel?: string;
  disabled?: boolean;
  /**
   * いくつかの選択肢の 1 つである行用: 行頭にリングが付き、選ばれた行では
   * 塗りつぶされる。
   */
  selected?: boolean;
  /**
   * 行末の、行の中にあるボタン: 行は 1 つの面のまま（リップルはボタンの下を
   * 走る）で、ボタンを押しても行は押されない。
   */
  action?: RowAction;
  onPress?: () => void;
}

/**
 * タップできる行。このファイルは React Native 版で、Web とテスト用。iOS と
 * Android は、隣のファイルでプラットフォーム自身のリスト行（Expo UI）を描く。
 */
export function NativeRow({
  title,
  detail,
  accessibilityLabel,
  disabled = false,
  selected,
  action,
  onPress,
}: NativeRowProps) {
  return (
    <Pressable
      accessibilityRole={selected === undefined ? "button" : "radio"}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={
        selected === undefined ? { disabled } : { checked: selected, disabled }
      }
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, disabled && styles.disabled]}
    >
      {selected !== undefined && <SelectionMark selected={selected} />}
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {detail !== undefined && <Text style={styles.detail}>{detail}</Text>}
      </View>
      {selected === undefined && !action && (
        <Icon name="chevron-right" size={14} color={colors.secondary} />
      )}
      {action && (
        <NativeButton
          label={action.label}
          accessibilityLabel={action.accessibilityLabel}
          variant={action.variant ?? "text"}
          onPress={action.onPress}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  text: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 15, fontWeight: "500" },
  detail: { color: colors.secondary, fontSize: 12 },
  disabled: { opacity: 0.4 },
});
