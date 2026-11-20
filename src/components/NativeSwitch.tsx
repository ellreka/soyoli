import { Switch } from "react-native";

import { colors } from "@/constants/theme";

export interface NativeSwitchProps {
  accessibilityLabel: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export function NativeSwitch({
  accessibilityLabel,
  value,
  onValueChange,
}: NativeSwitchProps) {
  return (
    <Switch
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: colors.border, true: colors.secondary }}
      thumbColor={colors.text}
    />
  );
}
