import { Switch } from "@expo/ui/jetpack-compose";

import { colors } from "@/constants/theme";
import type { ListSwitchProps } from "./ListSwitch";

export function ListSwitch({ value, onValueChange }: ListSwitchProps) {
  return (
    <Switch
      value={value}
      onCheckedChange={onValueChange}
      colors={{
        checkedThumbColor: colors.background,
        checkedTrackColor: colors.text,
        uncheckedThumbColor: colors.secondary,
        uncheckedTrackColor: colors.surface,
        uncheckedBorderColor: colors.border,
      }}
    />
  );
}
