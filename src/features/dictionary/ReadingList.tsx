import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { NativeSwitch } from "@/components/NativeSwitch";
import { Pressable } from "@/components/Pressable";
import { colors } from "@/constants/theme";
import { dictionaryParams } from "./DictionaryEditScreen";
import type { DictionaryEntry, DictionaryScope } from "./entries";

export function readingOf(entry: DictionaryEntry): string {
  return entry.reading === "" ? "読まない" : entry.reading;
}

export interface ReadingRow {
  key: string;
  name: string;
  input: string;
  reading: string;
  description?: string;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  edit?: () => void;
}

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
