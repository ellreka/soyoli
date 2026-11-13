import { Image } from "@expo/ui/swift-ui";

import { colors } from "@/constants/theme";
import type { SelectionMarkProps } from "./SelectionMark";

/** iOS: システムのリングのシンボル。選ばれたものは塗りつぶされる。 */
export function SelectionMark({ selected }: SelectionMarkProps) {
  return (
    <Image
      systemName={selected ? "largecircle.fill.circle" : "circle"}
      size={20}
      color={selected ? colors.text : colors.secondary}
    />
  );
}
