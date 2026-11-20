import { Host } from "@expo/ui";
import { Slider } from "@expo/ui/jetpack-compose";
import { useRef, useState } from "react";

import { colors } from "@/constants/theme";
import type { NativeSliderProps } from "./NativeSlider";

const vertical = { vertical: true };
const stretch = { alignSelf: "stretch" } as const;

// WORKAROUND: Material のスライダーは steps を使うと刻みごとに目盛りを描く。なめらかに動かし、値はここで刻みに丸める。
export function NativeSlider({
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
}: NativeSliderProps) {
  const [dragged, setDragged] = useState<number | null>(null);
  const latest = useRef(value);
  const snap = (raw: number) => Math.round(raw / step) * step;
  return (
    <Host matchContents={vertical} colorScheme="dark" style={stretch}>
      <Slider
        value={dragged ?? value}
        min={min}
        max={max}
        colors={{
          thumbColor: colors.text,
          activeTrackColor: colors.text,
          inactiveTrackColor: colors.border,
        }}
        onValueChange={(raw) => {
          latest.current = snap(raw);
          setDragged(raw);
          onChange?.(latest.current);
        }}
        onValueChangeFinished={() => {
          setDragged(null);
          onCommit(latest.current);
        }}
      />
    </Host>
  );
}
