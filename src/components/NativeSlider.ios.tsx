import { Host, Slider } from "@expo/ui";
import { useEffect, useRef, useState } from "react";

import { colors } from "@/constants/theme";
import type { NativeSliderProps } from "./NativeSlider";

const vertical = { vertical: true };
const stretch = { alignSelf: "stretch" } as const;

/** 値が反映されるまでに、止まっていなければならない時間。 */
const settleMs = 250;

/**
 * iOS: SwiftUI のスライダー。ドラッグの一刻みごとに知らせてくるが、終わりは
 * 知らせないので、値はしばらく止まってから反映する — 一刻みごとに
 * 読み上げをやり直さないため。
 */
export function NativeSlider({
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
}: NativeSliderProps) {
  // つまみはすぐ指に付いていく。`value` は確定したときに追いつく。
  const [dragged, setDragged] = useState<number | null>(null);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(pending.current);
    },
    [],
  );
  return (
    <Host
      matchContents={vertical}
      colorScheme="dark"
      seedColor={colors.text}
      style={stretch}
    >
      <Slider
        value={dragged ?? value}
        min={min}
        max={max}
        step={step}
        onValueChange={(next) => {
          setDragged(next);
          onChange?.(next);
          clearTimeout(pending.current);
          pending.current = setTimeout(() => {
            setDragged(null);
            onCommit(next);
          }, settleMs);
        }}
      />
    </Host>
  );
}
