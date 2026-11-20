import { StyleSheet, type ColorValue } from "react-native";
import { Pressable } from "@/components/Pressable";

import { colors } from "@/constants/theme";
import { Icon, type IconName } from "./Icon";

export interface IconButtonProps {
  icon: IconName;
  label: string;
  size?: number;
  color?: ColorValue;
  disabled?: boolean;
  filled?: number;
  onPress?: () => void;
}

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
