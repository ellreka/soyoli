import { Host, ListItem, Row } from "@expo/ui";

import { colors } from "@/constants/theme";
import { ComposeButton } from "./NativeButton.android";
import { rowModifiers } from "./NativeList";
import type { NativeRowProps } from "./NativeRow";
import { SelectionMark } from "./SelectionMark.android";

/** Android: 行は Material 自身のサーフェスではなく、カードの面に載る。 */
const rowColors = {
  containerColor: colors.surface,
  contentColor: colors.text,
  supportingContentColor: colors.secondary,
};
// 無効状態は別の色ではなく不透明度で表す（theme を参照）。
const disabledColors = {
  ...rowColors,
  contentColor: `${colors.text}66`,
  supportingContentColor: `${colors.secondary}66`,
};
function ignore() {}
const stretch = { flex: 1 };
const vertical = { vertical: true };

/**
 * iOS と Android: プラットフォームのリスト行（SwiftUI / Material 3）。
 * システムの行と同じように、指の下でハイライトやリップルが出る。
 */
export function NativeRow({
  title,
  detail,
  disabled,
  selected,
  action,
  onPress,
}: NativeRowProps) {
  return (
    <Host matchContents={vertical} colorScheme="dark" style={stretch}>
      <ListItem
        supportingText={detail}
        // 選択肢の行は最初からリングを持つ: Compose は一度外したスロットを
        // 戻さない。
        leading={
          selected === undefined ? undefined : (
            <SelectionMark selected={selected} />
          )
        }
        // アクションは行の中の独立したボタン: 行のリップルはその下を走り、
        // 押しても行は押されない。
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
        // 無効な行は、何もしないハンドラを持ち続ける: ハンドラを外すと行の
        // modifiers がリストから「なし」に変わり、ネイティブ側がそれを適用
        // できない（"Cannot set prop 'modifiers'"）。
        onPress={disabled ? ignore : (onPress ?? ignore)}
      >
        {title}
      </ListItem>
    </Host>
  );
}
