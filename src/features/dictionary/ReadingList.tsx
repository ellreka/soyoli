import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { NativeSwitch } from "@/components/NativeSwitch";
import { Pressable } from "@/components/Pressable";
import { colors } from "@/constants/theme";
import { dictionaryParams } from "./DictionaryEditScreen";
import type { DictionaryEntry, DictionaryScope } from "./entries";

/** 項目について読まれるもの。辞書の一覧に出る形で。 */
export function readingOf(entry: DictionaryEntry): string {
  return entry.reading === "" ? "読まない" : entry.reading;
}

/** ページの一覧に出る形の読み。どの辞書のものでも同じ。 */
export interface ReadingRow {
  key: string;
  /** 入力。スクリーンリーダー用: 長いパターンのこともある。 */
  name: string;
  input: string;
  reading: string;
  /** その読みが何のためのものか。書いてある場合。 */
  description?: string;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  /** 読みのエディタを開く。アプリ自身の読みにはない。 */
  edit?: () => void;
}

/**
 * 1 つの辞書（`scope`）の読みを行にする: それぞれがエディタを開き、
 * オン／オフのスイッチを持つ。
 */
export function entryRows(
  entries: readonly DictionaryEntry[],
  scope: DictionaryScope,
  setEnabled: (
    scope: DictionaryScope,
    surface: string,
    enabled: boolean,
  ) => void,
): ReadingRow[] {
  const set = scope === "common" ? "common" : scope.setId;
  return entries.map((entry) => ({
    key: entry.surface,
    name: entry.surface,
    input: entry.surface,
    reading: readingOf(entry),
    description: entry.description,
    enabled: !entry.off,
    setEnabled: (enabled) => {
      setEnabled(scope, entry.surface, enabled);
    },
    edit: () => {
      router.push({
        pathname: "/dictionary",
        params: dictionaryParams({ surface: entry.surface, set, edit: true }),
      });
    },
  }));
}

/**
 * 読みを 入力 → 読み の形で出し、説明があればその下に出す。矢印は必ず
 * 見える: 左右それぞれが、2 行を超えたところで別々に切られる。読みは幅の
 * 45% までを保つので、長い入力（パターンは長くなりうる）に押し出されない。
 */
function ReadingText({ row }: { row: ReadingRow }) {
  return (
    <>
      <View style={styles.pair}>
        <Text style={[styles.title, styles.written]} numberOfLines={2}>
          {row.input}
        </Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={[styles.title, styles.spoken]} numberOfLines={2}>
          {row.reading}
        </Text>
      </View>
      {row.description !== undefined && (
        <Text style={styles.detail} numberOfLines={1}>
          {row.description}
        </Text>
      )}
    </>
  );
}

/** 読みを 1 枚のカードに並べる。1 件もなければ何も描かない。 */
export function ReadingList({ rows }: { rows: readonly ReadingRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <View style={styles.card}>
      {rows.map((row) => (
        <View key={row.key} style={styles.entry}>
          {row.edit ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${row.name}の読みを編集`}
              onPress={row.edit}
              style={styles.reading}
            >
              <ReadingText row={row} />
            </Pressable>
          ) : (
            <View style={styles.reading}>
              <ReadingText row={row} />
            </View>
          )}
          <View style={styles.toggle}>
            <NativeSwitch
              accessibilityLabel={`${row.name}を適用`}
              value={row.enabled}
              onValueChange={row.setEnabled}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  reading: {
    flex: 1,
    justifyContent: "center",
    gap: 2,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pair: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: colors.text, fontSize: 15, fontWeight: "500" },
  written: { flexShrink: 1 },
  arrow: { color: colors.secondary, fontSize: 15 },
  spoken: { flexShrink: 0, maxWidth: "45%" },
  detail: { color: colors.secondary, fontSize: 12 },
  toggle: { justifyContent: "center", paddingRight: 12 },
  entry: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
