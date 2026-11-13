import { Host, Row, Text } from "@expo/ui";
import { Button } from "@expo/ui/swift-ui";
import {
  accessibilityAddTraits,
  accessibilityHint as hintModifier,
  accessibilityLabel as labelModifier,
  buttonBorderShape,
  buttonStyle,
  disabled as disabledModifier,
  frame,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import { colors } from "@/constants/theme";
import { IconGlyph } from "./Icon";
import type { NativeButtonProps } from "./NativeButton";

const fullWidth = { vertical: true };

/**
 * iOS: システムのカプセル型スタイルの SwiftUI ボタン — 主要なアクションと
 * 選択中のチップは prominent、それ以外は bordered — で、押下時の見た目は
 * システムのもの。
 */
export function NativeButton({
  label,
  accessibilityLabel,
  accessibilityHint,
  icon,
  variant = "filled",
  selected,
  disabled = false,
  fill = false,
  onPress,
}: NativeButtonProps) {
  const filled = selected ?? variant === "filled";
  const ink = filled ? colors.background : colors.text;
  return (
    <Host
      matchContents={fill ? fullWidth : true}
      colorScheme="dark"
      style={fill ? { alignSelf: "stretch" } : undefined}
    >
      <Button
        onPress={onPress}
        modifiers={[
          buttonStyle(
            filled
              ? "borderedProminent"
              : variant === "text"
                ? "borderless"
                : "bordered",
          ),
          buttonBorderShape("capsule"),
          tint(colors.text),
          labelModifier(accessibilityLabel ?? label),
          ...(accessibilityHint ? [hintModifier(accessibilityHint)] : []),
          ...(selected ? [accessibilityAddTraits(["isSelected"])] : []),
          disabledModifier(disabled),
        ]}
      >
        <Row
          alignment="center"
          spacing={6}
          modifiers={fill ? [frame({ maxWidth: Infinity })] : undefined}
        >
          {icon ? <IconGlyph name={icon} size={15} color={ink} /> : null}
          {label !== "" ? (
            <Text
              textStyle={{
                color: ink,
                fontSize: 14,
                fontWeight: filled ? "600" : "400",
              }}
            >
              {label}
            </Text>
          ) : null}
        </Row>
      </Button>
    </Host>
  );
}
