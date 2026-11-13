import { List, type ListItemProps, type ListProps } from "@expo/ui";
import { HorizontalDivider, Text } from "@expo/ui/jetpack-compose";
import { padding } from "@expo/ui/jetpack-compose/modifiers";

import { colors } from "@/constants/theme";
import type { NativeListGroupProps } from "./NativeList";

type ModifierConfig = NonNullable<ListItemProps["modifiers"]>[number];

/** 行に足す modifier。必要なのは iOS だけ。 */
export const rowModifiers: ModifierConfig[] | undefined = undefined;

/** 読者がいる行の modifier。iOS はこれで行を塗る。 */
export const selectedRowModifiers: ModifierConfig[] | undefined = undefined;

/** シートのヘッダー行の余白。modifier が必要なのは iOS だけ。 */
export const sheetHeaderModifiers: ModifierConfig[] | undefined = undefined;

/** Android: 区切り線が、行のグループを前のグループから分ける。 */
export function NativeListGroup({
  title,
  first,
  children,
}: NativeListGroupProps) {
  return (
    <>
      {!first && <HorizontalDivider color={colors.border} />}
      {title !== undefined && (
        <Text
          color={colors.secondary}
          style={{ fontSize: 13, fontWeight: "600" }}
          // 行の文字と位置を揃え、前のグループよりも行のほうに寄せる。
          modifiers={[padding(16, 20, 16, 4)]}
        >
          {title}
        </Text>
      )}
      {children}
    </>
  );
}

/** Android: 設定ページ用の Material 3 のリスト。 */
export function NativeList(props: ListProps) {
  return <List {...props} />;
}
