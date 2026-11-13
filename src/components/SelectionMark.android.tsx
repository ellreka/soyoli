import { RadioButton } from "@expo/ui/jetpack-compose";

import { colors } from "@/constants/theme";
import type { SelectionMarkProps } from "./SelectionMark";

const markColors = {
  selectedColor: colors.text,
  unselectedColor: colors.secondary,
};

/**
 * Android: Material のラジオボタンを印としてだけ使う — 自分では押下を
 * 受けないので、それを含む行が丸ごと押される（リップルも行に出る）。
 */
export function SelectionMark({ selected }: SelectionMarkProps) {
  return <RadioButton selected={selected} colors={markColors} />;
}
