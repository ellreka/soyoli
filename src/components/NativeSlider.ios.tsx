import { Host, Slider } from "@expo/ui";
import { useState } from "react";

import { colors } from "@/constants/theme";
import type { NativeSliderProps } from "./NativeSlider";
import { useSubscription } from "@/lib/subscription";

const vertical = { vertical: true };
const stretch = { alignSelf: "stretch" } as const;

const settleMs = 250;

function createSettle() {
  const pending: { timer?: ReturnType<typeof setTimeout> } = {};
  return {
    after: (ms: number, run: () => void): void => {
      clearTimeout(pending.timer);
      pending.timer = setTimeout(run, ms);
    },
    cancelOnLeave: (): (() => void) => () => {
      clearTimeout(pending.timer);
    },
  };
}

// WORKAROUND: SwiftUI のスライダーは一刻みごとに知らせ、ドラッグの終わりは知らせない。値はしばらく止まってから反映する。
export function NativeSlider({
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
}: NativeSliderProps) {
  const [dragged, setDragged] = useState<number | null>(null);
  const [settle] = useState(createSettle);
  useSubscription(settle.cancelOnLeave);
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
          settle.after(settleMs, () => {
            setDragged(null);
            onCommit(next);
          });
        }}
      />
    </Host>
  );
}
