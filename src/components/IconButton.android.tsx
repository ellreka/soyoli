import { Host } from "@expo/ui";
import {
  FilledIconButton,
  IconButton as ComposeIconButton,
} from "@expo/ui/jetpack-compose";
import { size as sizeModifier } from "@expo/ui/jetpack-compose/modifiers";

import { colors, iconColor } from "@/constants/theme";
import { IconGlyph } from "./Icon";
import type { IconButtonProps } from "./IconButton";

/** Android: Material 3 のアイコンボタン。丸いリップルが付く。 */
export function IconButton({
  icon,
  label,
  size = 20,
  color = colors.text,
  disabled = false,
  filled,
  onPress,
}: IconButtonProps) {
  return (
    <Host matchContents colorScheme="dark">
      {filled === undefined ? (
        <ComposeIconButton
          onClick={onPress}
          enabled={!disabled}
          colors={{ contentColor: color, disabledContentColor: colors.border }}
        >
          <IconGlyph
            name={icon}
            size={size}
            color={iconColor(color, disabled)}
            label={label}
          />
        </ComposeIconButton>
      ) : (
        <FilledIconButton
          onClick={onPress}
          enabled={!disabled}
          colors={{
            containerColor: colors.text,
            contentColor: colors.background,
            disabledContainerColor: colors.border,
          }}
          modifiers={[sizeModifier(filled, filled)]}
        >
          <IconGlyph
            name={icon}
            size={size}
            color={colors.background}
            label={label}
          />
        </FilledIconButton>
      )}
    </Host>
  );
}
