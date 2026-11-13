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
  /** フィールドの最初の文字列。その後はフィールドが自分の文字列を持つ。 */
  defaultValue?: string;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  returnKeyType?: ReturnKeyTypeOptions;
  onChangeText?: (text: string) => void;
  /** return キーが押された。`text` はフィールドに入っている文字列。 */
  onSubmit?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

/**
 * 自分で文字列を持つテキストフィールド: 初期値を渡し、変更を受け取る。
 * このファイルは React Native 版で、Web とテスト用。iOS と Android は、
 * 隣のファイルでプラットフォーム自身のフィールド（Expo UI）を描く。
 */
export function NativeTextField({
  accessibilityLabel,
  defaultValue,
  placeholder,
  multiline,
  keyboardType,
  returnKeyType,
  onChangeText,
  onSubmit,
  onFocus,
  onBlur,
}: NativeTextFieldProps) {
  // 文字列はフィールドが持つ。ここでは return キーのために覚えておく。
  const text = useRef(defaultValue ?? "");
  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      defaultValue={defaultValue}
      placeholder={placeholder}
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
