import { ListItem, RNHostView } from "@expo/ui";
import { useState } from "react";
import { Platform, StyleSheet, TextInput, View } from "react-native";

import { NativeList, rowModifiers } from "@/components/NativeList";
import { colors } from "@/constants/theme";

interface ParagraphMenuProps {
  /** 長押しされた段落。 */
  text: string;
  /** その段落から読み上げを始める。 */
  onPlay: () => void;
  /** 選択した部分をコピーする。選択がなければ段落全体。 */
  onCopy: (text: string) => void;
  /** 段落を初期値にして、読みを登録するフォームを開く。 */
  onRegister: () => void;
  onClose: () => void;
}

interface Range {
  start: number;
  end: number;
}

/** Android: 行は Material 自身のサーフェスではなく、シートの面に載る。 */
const rowColors = {
  containerColor: colors.surface,
  contentColor: colors.text,
};

/**
 * 1 つの段落に対するアクション。本文の長押しで出るボトムシートに表示する。
 * シートのネイティブ（Expo UI）のツリーに描画する: 段落は React Native の
 * テキストエリアに入れて一部を選択・コピーできるようにし、アクションは
 * プラットフォーム自身の行にする。アクションを選ぶとシートが閉じる。
 */
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
            // 読み取り専用だが、選択はできる。Android は編集可能なフィールドしか
            // 選択させないので、そこでは代わりにキーボードを出さないようにし、
            // 制御された値がどんな編集も元に戻す。
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
