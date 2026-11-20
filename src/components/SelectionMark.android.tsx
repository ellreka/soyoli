import { RadioButton } from "@expo/ui/jetpack-compose";

import { colors } from "@/constants/theme";
import type { SelectionMarkProps } from "./SelectionMark";

const markColors = {
  selectedColor: colors.text,
  unselectedColor: colors.secondary,
};

export function SelectionMark({ selected }: SelectionMarkProps) {
  return <RadioButton selected={selected} colors={markColors} />;
}
