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

// WORKAROUND: SwiftUI は素の行に余白を付けず、タイトルがグラバーに、ボタンが端に触れる。
export const sheetHeaderModifiers = [
  padding({ leading: 24, trailing: 24, top: 18, bottom: 6 }),
];

// WORKAROUND: ライブラリが付ける plain スタイルは押下を見せない。リストのスタイルはラベルを tint で塗るので、tint を文字色にする。
export const rowModifiers = [buttonStyle("automatic"), tint(colors.text)];

export const selectedRowModifiers = [
  ...rowModifiers,
  listRowBackground(colors.selected),
];

export function NativeListGroup({ title, children }: NativeListGroupProps) {
  return <Section title={title}>{children}</Section>;
}

// WORKAROUND: SwiftUI の grouped リストは自前の背景を塗る（ダークモードでは真っ黒）。
export function NativeList({ children, testID }: ListProps) {
  return (
    <List testID={testID} modifiers={[scrollContentBackground("hidden")]}>
      {children}
    </List>
  );
}
