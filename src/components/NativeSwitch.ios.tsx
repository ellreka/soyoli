import { Host } from "@expo/ui";
import { Toggle } from "@expo/ui/swift-ui";
import { labelsHidden, tint } from "@expo/ui/swift-ui/modifiers";
import { Pressable, View } from "react-native";

import { colors } from "@/constants/theme";
import type { NativeSwitchProps } from "./NativeSwitch";

/**
 * iOS: SwiftUI のトグル。システムの緑ではなく、アプリのモノクロで描く。
 * トグルは状態を描くだけ: スクロールビューの中では素早いタップを取りこぼした
 * （少し押し続けるか、ドラッグしないと反応しなかった）ので、タップは周りの
 * pressable が受ける。VoiceOver が読むのもそちら。
 */
export function NativeSwitch({
  accessibilityLabel,
  value,
  onValueChange,
}: NativeSwitchProps) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      hitSlop={8}
      onPress={() => {
        onValueChange(!value);
      }}
    >
      <View pointerEvents="none">
        <Host matchContents colorScheme="dark">
          <Toggle
            isOn={value}
            modifiers={[labelsHidden(), tint(colors.secondary)]}
          />
        </Host>
      </View>
    </Pressable>
  );
}
