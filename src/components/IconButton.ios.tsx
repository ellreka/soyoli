import { Host, Row } from "@expo/ui";
import { Button } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  contentShape,
  disabled as disabledModifier,
  frame,
  shapes,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import { colors, iconColor } from "@/constants/theme";
import { IconGlyph } from "./Icon";
import type { IconButtonProps } from "./IconButton";

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
    <Host matchContents>
      <Button
        onPress={onPress}
        modifiers={[
          ...(filled === undefined
            ? [
                buttonStyle("borderless"),
                tint(color),
                frame({ width: 44, height: 44 }),
                contentShape(shapes.rectangle()),
              ]
            : [
                buttonStyle("borderedProminent"),
                buttonBorderShape("circle"),
                tint(colors.text),
              ]),
          accessibilityLabel(label),
          disabledModifier(disabled),
        ]}
      >
        {filled === undefined ? (
          <IconGlyph
            name={icon}
            size={size}
            color={iconColor(color, disabled)}
          />
        ) : (
          <Row
            alignment="center"
            modifiers={[frame({ width: filled - 28, height: filled - 14 })]}
          >
            <IconGlyph name={icon} size={size} color={colors.background} />
          </Row>
        )}
      </Button>
    </Host>
  );
}
