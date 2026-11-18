import { useState } from "react";
import { IconButton } from "@/components/IconButton";
import { NativeRow } from "@/components/NativeRow";
import { RowGroup } from "@/components/RowGroup";
import { NativeTextField } from "@/components/NativeTextField";
import { Image, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { Screen, Section } from "@/components/Screen";
import { colors } from "@/constants/theme";
import { useImportFiles } from "@/features/library/ImportFiles";
import { displayUrl, resolveWebAddress } from "@/features/web/browser";
import { listedSites, type ListedSite } from "@/features/web/sites";
import { openInBrowser } from "@/features/web/openBrowser";

/** アドレス欄: 入力または貼り付けた URL のページを開く。 */
function AddressBox() {
  const [text, setText] = useState("");
  // フィールドは自分で文字列を持つ。key を変えると空になる。
  const [cleared, setCleared] = useState(0);
  const [invalid, setInvalid] = useState(false);

  return (
    <View style={styles.search}>
      <View style={styles.field}>
        <Icon name="globe" size={16} color={colors.secondary} />
        <NativeTextField
          key={cleared}
          accessibilityLabel="URLを入力"
          placeholder="URLを入力"
          keyboardType="url"
          returnKeyType="go"
          onChangeText={(value) => {
            setText(value);
            setInvalid(false);
          }}
          onSubmit={(value) => {
            const url = resolveWebAddress(value);
            if (url) {
              openInBrowser(url);
            } else {
              setInvalid(value.trim() !== "");
            }
          }}
        />
        {text !== "" && (
          <IconButton
            icon="x"
            label="入力を消す"
            size={16}
            color={colors.secondary}
            onPress={() => {
              setText("");
              setInvalid(false);
              setCleared((count) => count + 1);
            }}
          />
        )}
      </View>
      {invalid && (
        <Text accessibilityRole="alert" style={styles.error}>
          URLを入力してください。
        </Text>
      )}
    </View>
  );
}

/**
 * サイト: そのアイコン、名前とアドレス、ランキングへの入口。アイコンは
 * プラットフォームの行の前に置く（行には画像を置く場所がない）。押すと
 * 行と同じようにサイトを開く。
 */
function SiteRow({ site }: { site: ListedSite }) {
  // サイトのアイコンを読み込めなければ、その場所には地球儀が残る。
  const [failed, setFailed] = useState(false);
  function open(): void {
    openInBrowser(site.url);
  }
  return (
    <NativeRow
      title={site.name}
      detail={displayUrl(site.url)}
      accessibilityLabel={`${site.name}を開く`}
      onPress={open}
      // アイコンは行の一部: そこを押しても行が押される。
      leading={
        <View
          accessible={false}
          importantForAccessibility="no"
          pointerEvents="none"
          style={styles.siteIcon}
        >
          {failed ? (
            <Icon name="globe" size={18} color={colors.secondary} />
          ) : (
            <Image
              testID={`site-icon-${displayUrl(site.url)}`}
              source={{ uri: site.iconUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() => {
                setFailed(true);
              }}
            />
          )}
        </View>
      }
      action={{
        label: "ランキング",
        accessibilityLabel: `${site.name}のランキング`,
        variant: "outlined",
        onPress: () => {
          openInBrowser(site.rankingUrl);
        },
      }}
    />
  );
}

/** ホームタブ: 作品を探す・追加するためのすべての入口。本棚の内容はない。 */
export default function HomeScreen() {
  const { importing, progress, result, start } = useImportFiles();
  // 入った作品は、ミニプレーヤーの上の知らせが伝える。ここに残すのは、
  // 読めなかったファイルとその理由: 知らせには収まらない。
  const failed = result?.failed ?? [];

  return (
    <Screen title="ホーム">
      <AddressBox />
      <Section title="対応サイト">
        <RowGroup>
          {listedSites.map((site) => (
            <SiteRow key={site.url} site={site} />
          ))}
        </RowGroup>
      </Section>
      <Section title="ファイルから追加">
        <RowGroup>
          <NativeRow
            title="ファイルを取り込む"
            detail={
              importing
                ? progress && progress.total > 1
                  ? `読み込み中…（${progress.done + 1} / ${progress.total}）`
                  : "読み込み中…"
                : "対応形式：.epub / .pdf（複数選べます）"
            }
            disabled={importing}
            onPress={start}
          />
        </RowGroup>
        {failed.map((failure) => (
          <Text
            key={`${failure.name}\n${failure.message}`}
            accessibilityRole="alert"
            style={styles.error}
          >
            {failure.name
              ? `${failure.name}: ${failure.message}`
              : failure.message}
          </Text>
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  siteIcon: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: colors.background,
  },
  search: { gap: 12 },
  field: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 14,
    // クリアボタンは自分でタップ領域を持っている。
    paddingRight: 2,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  error: { color: colors.text, fontWeight: "400", fontSize: 13 },
});
