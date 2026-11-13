import { Host, Row, Text } from "@expo/ui";
import { Button, OutlinedButton, TextButton } from "@expo/ui/jetpack-compose";
import { fillMaxWidth, semantics } from "@expo/ui/jetpack-compose/modifiers";

import { colors } from "@/constants/theme";
import { IconGlyph } from "./Icon";
import type { NativeButtonProps } from "./NativeButton";

const fullWidth = { vertical: true };

/**
 * Material 3 のボタンそのもの。Compose ホストの中で使う: `NativeButton` の
 * 中や、別のネイティブ部品の一部（行のアクション）として。
 */
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
      // Material の既定（左右 24dp ずつ）は、チップを並べた行には広すぎる。
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
            // ラベルはボタンの中で折り返さない。
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

/**
 * Android: Material 3 のボタン — 主要なアクションと選択中のチップは filled、
 * それ以外は outlined か text — で、リップルが付く。
 */
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
