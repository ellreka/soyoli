import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { IconButton } from "@/components/IconButton";
import { NativeButton } from "@/components/NativeButton";
import { colors, gutter } from "@/constants/theme";
import { useImportFiles } from "./ImportFiles";

/**
 * ファイルの取り込みの知らせ。ミニプレーヤーの上に出るので、どのタブに
 * いても見える。作品が入っただけなら少し経つと自分で消え、いつでも
 * 閉じられる。
 */
export function ImportNotice() {
  const { notice, dismiss } = useImportFiles();
  if (!notice) {
    return null;
  }
  const { added, failed } = notice;
  const only = added.length === 1 ? added[0] : undefined;
  const lines = [
    ...(only ? [`「${only.title}」を本棚に追加しました`] : []),
    ...(added.length > 1 ? [`${added.length}冊を本棚に追加しました`] : []),
    ...(failed.length > 0
      ? [
          added.length > 0
            ? `${failed.length}件は読み込めませんでした`
            : failed.length === 1
              ? failed[0].message
              : `${failed.length}件のファイルを読み込めませんでした`,
        ]
      : []),
  ];
  return (
    <View testID="import-notice" accessibilityRole="alert" style={styles.bar}>
      <View style={styles.lines}>
        {lines.map((line) => (
          <Text key={line} style={styles.line} numberOfLines={2}>
            {line}
          </Text>
        ))}
      </View>
      {added.length > 0 && (
        <NativeButton
          // 1 冊ならその作品を、何冊もあれば本棚を開く。
          label={only ? "開く" : "本棚"}
          accessibilityLabel={only ? `${only.title}を開く` : "本棚を開く"}
          variant="outlined"
          onPress={() => {
            dismiss();
            if (only) {
              router.push({ pathname: "/reader", params: { id: only.id } });
            } else {
              router.navigate("/");
            }
          }}
        />
      )}
      <IconButton
        icon="x"
        label="知らせを閉じる"
        size={18}
        color={colors.secondary}
        onPress={dismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: gutter,
    paddingRight: 2,
    paddingVertical: 4,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  lines: { flex: 1, gap: 2 },
  line: { color: colors.text, fontWeight: "400", fontSize: 13, lineHeight: 18 },
});
