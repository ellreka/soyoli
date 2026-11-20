import { useRef } from "react";
import {
  StyleSheet,
  TextInput,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
} from "react-native";

import { colors } from "@/constants/theme";

export interface NativeTextFieldProps {
  accessibilityLabel: string;
  defaultValue?: string;
  placeholder?: string;
  autoFocus?: boolean;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
  onChangeText?: (text: string) => void;
  onSubmit?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

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
  const text = useRef(defaultValue ?? "");
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      defaultValue={defaultValue}
      placeholder={placeholder}
      autoFocus={autoFocus}
      placeholderTextColor={colors.secondary}
      selectionColor={colors.secondary}
      multiline={multiline}
      keyboardType={keyboardType}
      returnKeyType={returnKeyType}
      autoCapitalize="none"
      autoCorrect={false}
      onChangeText={(value) => {
        text.current = value;
        onChangeText?.(value);
      }}
      onSubmitEditing={() => {
        onSubmit?.(text.current);
      }}
      onFocus={onFocus}
      onBlur={onBlur}
      style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  input: { flex: 1, minHeight: 44, color: colors.text, fontSize: 15 },
});
