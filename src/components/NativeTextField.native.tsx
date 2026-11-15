import { Host, TextInput } from "@expo/ui";

import { colors } from "@/constants/theme";
import type { NativeTextFieldProps } from "./NativeTextField";

const stretch = { flex: 1 };
const vertical = { vertical: true };

/** iOS と Android: プラットフォームのテキストフィールド（SwiftUI / Material 3）。 */
export function NativeTextField({
  accessibilityLabel,
  defaultValue,
  placeholder,
  autoFocus,
  multiline,
  keyboardType,
  returnKeyType,
  onChangeText,
  onSubmit,
  onFocus,
  onBlur,
}: NativeTextFieldProps) {
  return (
    <Host matchContents={vertical} colorScheme="dark" style={stretch}>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoFocus={autoFocus}
        placeholderTextColor={colors.secondary}
        cursorColor={colors.text}
        multiline={multiline}
        keyboardType={keyboardType}
        returnKeyType={returnKeyType}
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </Host>
  );
}
