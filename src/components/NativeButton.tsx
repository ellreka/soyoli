import { StyleSheet, Text } from "react-native";

import { colors } from "@/constants/theme";
import { Icon, type IconName } from "./Icon";
import { Pressable } from "./Pressable";

export interface NativeButtonProps {
  label: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  icon?: IconName;
  variant?: "filled" | "outlined" | "text";
  role?: "button" | "tab" | "radio";
  selected?: boolean;
  disabled?: boolean;
  fill?: boolean;
  compact?: boolean;
  onPress?: () => void;
}

export function NativeButton({
  label,
  accessibilityLabel,
  accessibilityHint,
  icon,
  variant = "filled",
  role = "button",
  selected,
  disabled = false,
  fill = false,
  onPress,
}: NativeButtonProps) {
  const filled = selected ?? variant === "filled";
  const state =
    role === "radio"
      ? { checked: Boolean(selected), disabled }
      : role === "tab"
        ? { selected: Boolean(selected), disabled }
        : { disabled };
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={state}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        variant !== "text" && styles.bordered,
        filled && styles.filled,
        fill && styles.fill,
        disabled && styles.disabled,
      ]}
    >
      {icon && (
        <Icon
          name={icon}
          size={15}
          color={filled ? colors.background : colors.text}
        />
      )}
      {label !== "" && (
        <Text style={[styles.label, filled && styles.filledLabel]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  bordered: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  filled: { backgroundColor: colors.text, borderColor: colors.text },
  fill: { alignSelf: "stretch" },
  disabled: { opacity: 0.3 },
  label: { color: colors.text, fontSize: 14 },
  filledLabel: { color: colors.background, fontWeight: "600" },
});
