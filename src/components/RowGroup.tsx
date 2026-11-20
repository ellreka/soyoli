import { Children, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { colors } from "@/constants/theme";

export function RowGroup({ children }: { children: ReactNode }) {
  return (
    <View style={styles.group}>
      {Children.toArray(children).map((child, index) => (
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
