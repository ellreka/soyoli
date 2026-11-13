import { StyleSheet, type ColorValue } from "react-native";
import { Pressable } from "@/components/Pressable";

import { colors } from "@/constants/theme";
import { Icon, type IconName } from "./Icon";

export interface IconButtonProps {
  icon: IconName;
  /** スクリーンリーダーが読む。ボタンには見える文字がない。 */
  label: string;
  size?: number;
  color?: ColorValue;
  disabled?: boolean;
  /** この直径の、丸く塗りつぶしたボタン: 主要なアクション（再生）。 */
  filled?: number;
  onPress?: () => void;
}

/**
 * 44pt のアイコンだけのボタン。このファイルは React Native 版で、Web と
 * テスト用。iOS と Android は、隣のファイルでプラットフォーム自身のボタン
 * （Expo UI）を描く。
 */
export function IconButton({
  icon,
  label,
  size = 20,
  color = colors.text,
  disabled = false,
  filled,
  onPress,
}: IconButtonProps) {
  return (
    <Pressable
      borderless
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        filled !== undefined && {
          width: filled,
          height: filled,
          borderRadius: filled / 2,
          backgroundColor: colors.text,
        },
        disabled && styles.disabled,
      ]}
    >
      <Icon
        name={icon}
        size={size}
        color={filled === undefined ? color : colors.background}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  disabled: { opacity: 0.3 },
});
