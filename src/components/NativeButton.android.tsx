import { Host, Row, Text } from "@expo/ui";
import { Button, OutlinedButton, TextButton } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, semantics } from "@expo/ui/jetpack-compose/modifiers";

import { colors } from "@/constants/theme";
import { IconGlyph } from "./Icon";
import type { NativeButtonProps } from "./NativeButton";

const fullWidth = { vertical: true };

export function ComposeButton({
  label,
  accessibilityLabel,
  icon,
  variant = "filled",
  selected,
  disabled = false,
  fill = false,
  compact = false,
  onPress,
}: NativeButtonProps) {
  const filled = selected ?? variant === "filled";
  const ink = filled ? colors.background : colors.text;
  const Component = filled
    ? Button
    : variant === "text"
      ? TextButton
      : OutlinedButton;
  return (
    <Component
      onClick={onPress}
      enabled={!disabled}
      contentPadding={
        compact
          ? { start: 2, end: 2, top: 6, bottom: 6 }
          : { start: 14, end: 14, top: 6, bottom: 6 }
      }
      colors={{
        containerColor: filled ? colors.text : "transparent",
        contentColor: ink,
      }}
      modifiers={[
        ...(fill ? [fillMaxWidth()] : []),
        ...(accessibilityLabel
          ? [semantics({ contentDescription: accessibilityLabel })]
          : []),
      ]}
    >
      <Row alignment="center" spacing={6}>
        {icon ? <IconGlyph name={icon} size={15} color={ink} /> : null}
        {label !== "" ? (
          <Text
            numberOfLines={1}
            textStyle={{
              color: ink,
              fontSize: compact ? 13 : 14,
              fontWeight: filled ? "600" : "400",
            }}
          >
            {label}
          </Text>
        ) : null}
      </Row>
    </Component>
  );
}

export function NativeButton(props: NativeButtonProps) {
  const fill = props.fill ?? false;
  return (
    <Host
      matchContents={fill ? fullWidth : true}
      colorScheme="dark"
      style={fill ? { alignSelf: "stretch" } : undefined}
    >
      <ComposeButton {...props} />
    </Host>
  );
}
