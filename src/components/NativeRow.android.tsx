import { Host, ListItem, RNHostView, Row } from "@expo/ui";

import { colors } from "@/constants/theme";
import { ComposeButton } from "./NativeButton.android";
import { rowModifiers } from "./NativeList";
import type { NativeRowProps } from "./NativeRow";
import { SelectionMark } from "./SelectionMark.android";

const rowColors = {
  containerColor: colors.surface,
  contentColor: colors.text,
  supportingContentColor: colors.secondary,
};
const disabledColors = {
  ...rowColors,
  contentColor: `${colors.text}66`,
  supportingContentColor: `${colors.secondary}66`,
};
function ignore() {}
const stretch = { flex: 1 };
const vertical = { vertical: true };

export function NativeRow({
  title,
  detail,
  disabled,
  selected,
  leading,
  action,
  onPress,
}: NativeRowProps) {
  const picture = leading && <RNHostView matchContents>{leading}</RNHostView>;
  return (
    <Host matchContents={vertical} colorScheme="dark" style={stretch}>
      <ListItem
        supportingText={detail}
        // WORKAROUND: Compose は一度外したスロットを戻さない。選択肢の行は最初からリングを持つ。
        leading={
          selected === undefined ? (
            picture
          ) : (
            <SelectionMark selected={selected} />
          )
        }
        trailing={
          action ? (
            <Row alignment="center" spacing={4}>
              <ComposeButton
                label={action.label}
                accessibilityLabel={action.accessibilityLabel}
                variant={action.variant ?? "text"}
                onPress={action.onPress}
              />
            </Row>
          ) : undefined
        }
        colors={disabled ? disabledColors : rowColors}
        modifiers={rowModifiers}
        // WORKAROUND: ハンドラを外すと modifiers が「なし」に変わり、ネイティブ側が適用できない（"Cannot set prop 'modifiers'"）。無効な行も何もしないハンドラを持つ。
        onPress={disabled ? ignore : (onPress ?? ignore)}
      >
        {title}
      </ListItem>
    </Host>
  );
}
