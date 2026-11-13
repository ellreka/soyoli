import { Host, Picker } from "@expo/ui";
import { StyleSheet } from "react-native";

import type { NativeSelectProps } from "./NativeSelect";

/**
 * Android: 選ばれた選択肢を Material 3 のドロップダウンに出す。押すと
 * すべての選択肢のメニューが開く。
 */
export function NativeSelect({ value, options, onChange }: NativeSelectProps) {
  return (
    <Host colorScheme="dark" style={styles.host}>
      <Picker selectedValue={value} onValueChange={onChange} appearance="menu">
        {options.map((option) => (
          <Picker.Item
            key={option.value}
            label={option.label}
            value={option.value}
          />
        ))}
      </Picker>
    </Host>
  );
}

const styles = StyleSheet.create({
  // Material のドロップダウンは、この高さのテキストフィールド。
  host: { flex: 1, height: 56 },
});
