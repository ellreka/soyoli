import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { colors } from "@/constants/theme";

interface LoadingProps {
  label?: string;
  inline?: boolean;
  color?: ColorValue;
  labelColor?: ColorValue;
  style?: StyleProp<ViewStyle>;
}

export function Loading({
  label,
  inline = false,
  color = colors.text,
  labelColor = colors.secondary,
  style,
}: LoadingProps) {
  return (
    <View style={[inline ? styles.inline : styles.fill, style]}>
      <ActivityIndicator color={color} />
      {label !== undefined && (
        <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  inline: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontWeight: "400", fontSize: 13, lineHeight: 20 },
});
