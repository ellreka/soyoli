import Slider from "@react-native-community/slider";
import { useRef } from "react";

import { colors } from "@/constants/theme";

export interface NativeSliderProps {
  accessibilityLabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** ドラッグ中に指の下にある値。その場で表示するため。 */
  onChange?: (value: number) => void;
  /** 反映する値: ドラッグが終わったとき（または値が落ち着いたとき）。 */
  onCommit: (value: number) => void;
}

/**
 * スライダー。このファイルは React Native 版で、Web とテスト用。iOS と
 * Android は、隣のファイルでプラットフォーム自身のスライダー（Expo UI）を描く。
 */
export function NativeSlider({
  accessibilityLabel,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
}: NativeSliderProps) {
  const dragging = useRef(false);
  return (
    <Slider
      accessible
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value }}
      minimumValue={min}
      maximumValue={max}
      step={step}
      value={value}
      onSlidingStart={() => {
        dragging.current = true;
      }}
      onValueChange={(next) => {
        onChange?.(next);
        // アクセシビリティの調整操作では、指を離すイベントが出るとは限らない。
        if (!dragging.current) {
          onCommit(next);
        }
      }}
      onSlidingComplete={(next) => {
        dragging.current = false;
        onCommit(next);
      }}
      minimumTrackTintColor={colors.text}
      maximumTrackTintColor={colors.border}
      thumbTintColor={colors.text}
      style={{ height: 44 }}
    />
  );
}
