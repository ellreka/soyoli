import { StyleSheet, View } from "react-native";

import { colors } from "@/constants/theme";

export interface SelectionMarkProps {
  selected: boolean;
}

/**
 * いくつかの選択肢の 1 つである行の、行頭の印: リングで、選ばれたものは
 * 塗りつぶされる。このファイルは React Native 版で、Web とテスト用。iOS と
 * Android は、隣のファイルでプラットフォーム自身のもの（SF Symbol /
 * Material のラジオボタン）を描く。ネイティブのホストの中で使うためのもの。
 */
export function SelectionMark({ selected }: SelectionMarkProps) {
  return (
    <View style={[styles.ring, selected && styles.chosen]}>
      {selected && <View style={styles.dot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  chosen: { borderColor: colors.text },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.text,
  },
});
