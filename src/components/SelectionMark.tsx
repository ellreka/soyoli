import { StyleSheet, View } from "react-native";

import { colors } from "@/constants/theme";

export interface SelectionMarkProps {
  selected: boolean;
}

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
