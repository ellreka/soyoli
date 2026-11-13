import { Children, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { colors } from "@/constants/theme";

/**
 * ひとまとまりの行を 1 枚のカードにする: 角丸の面が行（とそのリップル）を
 * 角で切り抜き、行の間に細い線を引く。余白は行が自分で持ち、カードは
 * 足さない。
 */
export function RowGroup({ children }: { children: ReactNode }) {
  return (
    <View style={styles.group}>
      {Children.toArray(children).map((child, index) => (
        // 行は横方向に伸びる（そのホストが flex: 1）。
        <View key={index} style={[styles.row, index > 0 && styles.divided]}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  row: { flexDirection: "row" },
  divided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
