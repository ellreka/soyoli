import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { NativeButton } from "@/components/NativeButton";
import { NativeRow } from "@/components/NativeRow";
import { NativeSwitch } from "@/components/NativeSwitch";
import { NativeTextField } from "@/components/NativeTextField";
import { colors } from "@/constants/theme";
import { patternError, type DictionaryEntry } from "./entries";

/** 読みを登録できる辞書。 */
export interface DictionaryTarget {
  key: string;
  label: string;
  detail?: string;
}

interface DictionaryFormProps {
  /** フォームの最初の文字。読者がそこから単語まで削る。 */
  initialSurface: string;
  initialReading?: string;
  /** 入力は正規表現。 */
  initialRegex?: boolean;
  /** 入力は段落をまたいで照合される。 */
  initialMultiline?: boolean;
  initialDescription?: string;
  /** 読みを入れられる場所と、最初に選ばれているもの。 */
  targets: DictionaryTarget[];
  initialTarget: string;
  /** 保存するボタンのラベル。 */
  submitLabel: string;
  onSave: (target: string, entry: DictionaryEntry) => void;
  /** 削除ボタンを出す。すでに登録されている読み用。 */
  onDelete?: () => void;
}

const kinds = [
  { regex: false, label: "文字列" },
  { regex: true, label: "正規表現" },
] as const;

/**
 * 読みの入力欄: 書かれたとおりの文字（またはそれを見つける正規表現）、
 * 読み上げ方、登録先の辞書。新しい読みの登録にも、編集にも使う —
 * 登録先は後から変えられる。
 */
export function DictionaryForm({
  initialSurface,
  initialReading = "",
  initialRegex = false,
  initialMultiline = false,
  initialDescription = "",
  targets,
  initialTarget,
  submitLabel,
  onSave,
  onDelete,
}: DictionaryFormProps) {
  const [surface, setSurface] = useState(initialSurface);
  const [reading, setReading] = useState(initialReading);
  const [regex, setRegex] = useState(initialRegex);
  const [multiline, setMultiline] = useState(initialMultiline);
  const [description, setDescription] = useState(initialDescription);
  const [target, setTarget] = useState(initialTarget);
  const entry: DictionaryEntry = {
    surface: surface.trim(),
    reading: reading.trim(),
    ...(regex && { regex }),
    ...(multiline && { multiline: true as const }),
    ...(description.trim() && { description: description.trim() }),
  };
  const error = regex && entry.surface ? patternError(entry.surface) : null;
  // 読みは空のままでもよい: その文字は読まれなくなる。
  const ready = entry.surface.length > 0 && error === null;

  return (
    <View testID="dictionary-form" style={styles.form}>
      <View style={styles.field}>
        <Text style={styles.caption}>入力の種類</Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="入力の種類"
          style={styles.targets}
        >
          {kinds.map((kind) => (
            <View key={kind.label} style={styles.target}>
              <NativeRow
                title={kind.label}
                accessibilityLabel={`入力の種類 ${kind.label}`}
                selected={kind.regex === regex}
                onPress={() => {
                  setRegex(kind.regex);
                }}
              />
            </View>
          ))}
        </View>
      </View>
      <View style={styles.field}>
        <Text style={styles.caption}>入力</Text>
        <View style={styles.input}>
          <NativeTextField
            accessibilityLabel="入力"
            defaultValue={initialSurface}
            placeholder={regex ? "https?://\\S+" : "読みを登録する語"}
            multiline
            onChangeText={setSurface}
          />
        </View>
        {error !== null && (
          <Text accessibilityRole="alert" style={styles.error}>
            正しい正規表現ではありません：{error}
          </Text>
        )}
      </View>
      <View style={styles.field}>
        <Text style={styles.caption}>読み</Text>
        <View style={styles.input}>
          <NativeTextField
            accessibilityLabel="読み"
            defaultValue={initialReading}
            placeholder={regex ? "URL省略" : "たかなし"}
            onChangeText={setReading}
          />
        </View>
        {regex && (
          <Text style={styles.hint}>
            読みの中の $1、$2… は括弧で囲んだ部分、$&
            は一致した全体に置き換わります。
          </Text>
        )}
        {/* 両方の欄の下に置く。文字とその読みが離れないようにするため。 */}
        <View style={styles.option}>
          <Text style={styles.optionLabel}>段落をまたいで一致</Text>
          <NativeSwitch
            accessibilityLabel="段落をまたいで一致"
            value={multiline}
            onValueChange={setMultiline}
          />
        </View>
        {multiline && regex && (
          <Text style={styles.hint}>
            ^ と $ は各段落の先頭と末尾に一致します。段落をまたぐ部分は [\s\S]
            で書きます。
          </Text>
        )}
      </View>
      <View style={styles.field}>
        <Text style={styles.caption}>説明（任意）</Text>
        <View style={styles.input}>
          <NativeTextField
            accessibilityLabel="説明"
            defaultValue={initialDescription}
            placeholder="一覧に表示する説明"
            onChangeText={setDescription}
          />
        </View>
      </View>
      <View style={styles.field}>
        <Text style={styles.caption}>登録先の辞書</Text>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="登録先の辞書"
          style={styles.targets}
        >
          {targets.map((item) => (
            <View key={item.key} style={styles.target}>
              <NativeRow
                title={item.label}
                detail={item.detail}
                accessibilityLabel={`登録先 ${item.label}`}
                selected={item.key === target}
                onPress={() => {
                  setTarget(item.key);
                }}
              />
            </View>
          ))}
        </View>
      </View>
      <NativeButton
        label={submitLabel}
        fill
        disabled={!ready}
        onPress={() => {
          onSave(target, entry);
        }}
      />
      {onDelete && (
        <NativeButton
          label="削除"
          accessibilityLabel="この読みを削除"
          variant="text"
          fill
          onPress={onDelete}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 20 },
  field: { gap: 6 },
  caption: { color: colors.secondary, fontWeight: "500", fontSize: 12 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  optionLabel: { color: colors.text, fontSize: 15 },
  hint: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  error: { color: colors.text, fontSize: 12, lineHeight: 18 },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  targets: {
    borderRadius: 10,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  target: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
