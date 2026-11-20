import { ListItem, RNHostView } from "@expo/ui";
import { useState } from "react";
import { Platform, StyleSheet, TextInput, View } from "react-native";

import { NativeList, rowModifiers } from "@/components/NativeList";
import { colors } from "@/constants/theme";

interface ParagraphMenuProps {
  text: string;
  onPlay: () => void;
  onCopy: (text: string) => void;
  onRegister: () => void;
  onClose: () => void;
}

interface Range {
  start: number;
  end: number;
}

const rowColors = {
  containerColor: colors.surface,
  contentColor: colors.text,
};

export function ParagraphMenu({
  text,
  onPlay,
  onCopy,
  onRegister,
  onClose,
}: ParagraphMenuProps) {
  const [selection, setSelection] = useState<Range>({ start: 0, end: 0 });
  const selected = text.slice(selection.start, selection.end);
  const actions = [
    { key: "play", label: "ここから読み上げ", onPress: onPlay },
    { key: "register", label: "辞書登録", onPress: onRegister },
    {
      key: "copy",
      label: "コピー",
      onPress: () => {
        onCopy(selected || text);
      },
    },
  ];
  return (
    <>
      <RNHostView matchContents={{ vertical: true }}>
        <View testID="paragraph-menu" style={styles.area}>
          <TextInput
            accessibilityLabel="選択した段落"
            accessibilityHint="一部を選択すると、その部分だけをコピーできます"
            testID="paragraph-menu-text"
            multiline
            value={text}
            // WORKAROUND: Android は編集可能なフィールドしか選択させない。キーボードを出さず、制御された値で編集を元に戻す。
            editable={Platform.OS !== "ios"}
            showSoftInputOnFocus={false}
            onSelectionChange={({ nativeEvent }) => {
              setSelection(nativeEvent.selection);
            }}
            selectionColor={colors.secondary}
            style={styles.text}
          />
        </View>
      </RNHostView>
      <NativeList testID="paragraph-menu-actions">
        {actions.map((action) => (
          <ListItem
            key={action.key}
            testID={`paragraph-menu-${action.key}`}
            modifiers={rowModifiers}
            colors={rowColors}
            onPress={() => {
              onClose();
              action.onPress();
            }}
          >
            {action.label}
          </ListItem>
        ))}
      </NativeList>
    </>
  );
}

const styles = StyleSheet.create({
  area: { paddingHorizontal: 16, paddingBottom: 4 },
  text: {
    maxHeight: 160,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
    color: colors.text,
    fontWeight: "400",
    fontSize: 15,
    lineHeight: 24,
  },
});
