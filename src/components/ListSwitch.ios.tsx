import { Toggle } from "@expo/ui/swift-ui";
import { labelsHidden, tint } from "@expo/ui/swift-ui/modifiers";

import { colors } from "@/constants/theme";
import type { ListSwitchProps } from "./ListSwitch";

/** iOS: SwiftUI のトグル。システムの緑ではなく、アプリのモノクロで描く。 */
export function ListSwitch({ value, onValueChange }: ListSwitchProps) {
  return (
    <Toggle
      isOn={value}
      onIsOnChange={onValueChange}
      modifiers={[labelsHidden(), tint(colors.secondary)]}
    />
  );
}
