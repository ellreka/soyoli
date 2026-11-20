import { Host } from "@expo/ui";
import { Picker, Text } from "@expo/ui/swift-ui";
import { pickerStyle, tag, tint } from "@expo/ui/swift-ui/modifiers";
import { StyleSheet, View } from "react-native";

import { colors } from "@/constants/theme";
import type { NativeSelectProps } from "./NativeSelect";

export function NativeSelect({ value, options, onChange }: NativeSelectProps) {
  return (
    <View style={styles.row}>
      <Host matchContents colorScheme="dark">
        <Picker
          selection={value}
          onSelectionChange={(selected) => {
            onChange(String(selected));
          }}
          modifiers={[pickerStyle("menu"), tint(colors.text)]}
        >
          {options.map((option) => (
            <Text key={option.value} modifiers={[tag(option.value)]}>
              {option.label}
            </Text>
          ))}
        </Picker>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: "row", minHeight: 44, alignItems: "center" },
});
