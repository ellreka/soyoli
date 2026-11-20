import type { ReactElement } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/theme";
import { Icon } from "./Icon";
import { NativeButton } from "./NativeButton";
import { Pressable } from "./Pressable";
import { SelectionMark } from "./SelectionMark";

export interface RowAction {
  label: string;
  accessibilityLabel?: string;
  variant?: "text" | "outlined";
  onPress: () => void;
}

export interface NativeRowProps {
  title: string;
  detail?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  selected?: boolean;
  leading?: ReactElement;
  action?: RowAction;
  onPress?: () => void;
}

export function NativeRow({
  title,
  detail,
  accessibilityLabel,
  disabled = false,
  selected,
  leading,
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
      {leading}
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
