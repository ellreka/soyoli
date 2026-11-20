import { StyleSheet, View } from "react-native";

import { IconButton } from "./IconButton";
import { NativeSlider, type NativeSliderProps } from "./NativeSlider";

export function StepSlider({
  accessibilityLabel,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
}: NativeSliderProps) {
  const perUnit = Math.round(1 / step);
  const snap = (raw: number) => Math.round(raw * perUnit) / perUnit;
  const stepTo = (next: number) => {
    onCommit(Math.min(max, Math.max(min, snap(next))));
  };
  return (
    <View style={styles.row}>
      <IconButton
        icon="minus"
        label={`${accessibilityLabel}を下げる`}
        disabled={value <= min}
        onPress={() => {
          stepTo(value - step);
        }}
      />
      <View style={styles.slider}>
        <NativeSlider
          accessibilityLabel={accessibilityLabel}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={
            onChange &&
            ((next) => {
              onChange(snap(next));
            })
          }
          onCommit={(next) => {
            onCommit(snap(next));
          }}
        />
      </View>
      <IconButton
        icon="plus"
        label={`${accessibilityLabel}を上げる`}
        disabled={value >= max}
        onPress={() => {
          stepTo(value + step);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginHorizontal: -12 },
  slider: { flex: 1, minWidth: 0 },
});
