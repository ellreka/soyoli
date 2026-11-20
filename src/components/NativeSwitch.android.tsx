import { Host } from "@expo/ui";
import { Switch } from "@expo/ui/jetpack-compose";
import { semantics } from "@expo/ui/jetpack-compose/modifiers";

import { colors } from "@/constants/theme";
import type { NativeSwitchProps } from "./NativeSwitch";

export function NativeSwitch({
  accessibilityLabel,
  value,
  onValueChange,
}: NativeSwitchProps) {
  return (
    <Host matchContents colorScheme="dark">
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
        modifiers={[semantics({ contentDescription: accessibilityLabel })]}
      />
    </Host>
  );
}
