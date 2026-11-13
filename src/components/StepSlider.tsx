import { StyleSheet, View } from "react-native";

import { IconButton } from "./IconButton";
import { NativeSlider, type NativeSliderProps } from "./NativeSlider";

/**
 * 前にマイナス、後ろにプラスのボタンが付いたスライダー: スライダーで値の
 * 近くまで行き、ボタンで 1 刻みずつ動かす。知らせる値はどれも刻みの整数倍で、
 * 浮動小数の誤差がない（1.7000000001 ではなく 1.7）。`step` は 1 未満の
 * 小数（0.1、0.25）。
 */
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
  // ボタンは 20pt のシンボルを囲む 44pt: その差だけ外へ出すと、シンボルが
  // 行の上下の文字と揃い、その分の幅をスライダーが使える。
  row: { flexDirection: "row", alignItems: "center", marginHorizontal: -12 },
  slider: { flex: 1, minWidth: 0 },
});
