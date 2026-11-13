import type { ListProps } from "@expo/ui";

import type { NativeListGroupProps } from "./NativeList";
import { List, Section } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  listRowBackground,
  padding,
  scrollContentBackground,
  tint,
} from "@expo/ui/swift-ui/modifiers";

import { colors } from "@/constants/theme";

/**
 * 行は SwiftUI のボタン。ライブラリが付ける plain スタイルは、押している間
 * 何も見せない。リスト自身のスタイルなら、システムの設定と同じように行全体が
 * ハイライトされる。そのスタイルはラベルを tint で色付けするので、tint を
 * 文字色にしている。
 */
/**
 * シートのヘッダー行（タイトルと 完了）の余白: SwiftUI は素の行に余白を
 * 付けないので、タイトルがグラバーに、ボタンが端に触れてしまう。
 */
export const sheetHeaderModifiers = [
  padding({ leading: 24, trailing: 24, top: 18, bottom: 6 }),
];

export const rowModifiers = [buttonStyle("automatic"), tint(colors.text)];

/** 読者がいる行（今の章）は、一段明るく塗る。 */
export const selectedRowModifiers = [
  ...rowModifiers,
  listRowBackground(colors.selected),
];

/** iOS: grouped リストのセクション。1 枚のカードとして描かれる。 */
export function NativeListGroup({ title, children }: NativeListGroupProps) {
  return <Section title={title}>{children}</Section>;
}

/**
 * SwiftUI の grouped リストは自前の背景を塗る（ダークモードでは真っ黒）。
 * それを隠すと、行の周りにアプリの背景が見える。
 */
export function NativeList({ children, testID }: ListProps) {
  return (
    <List testID={testID} modifiers={[scrollContentBackground("hidden")]}>
      {children}
    </List>
  );
}
