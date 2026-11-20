import type { ReactNode } from "react";
import { NativeButton } from "@/components/NativeButton";
import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "@/components/Pressable";

import { colors } from "@/constants/theme";
import {
  themes,
  useDisplay,
  type FontSize,
  type LineHeight,
  type PlayGesture,
  type Theme,
} from "./Display";

const fontSizeLabels: Record<FontSize, string> = {
  small: "小",
  medium: "中",
  large: "大",
  xlarge: "特大",
};
const lineHeightLabels: Record<LineHeight, string> = {
  tight: "狭い",
  normal: "標準",
  loose: "広い",
};
const themeLabels: Record<Theme, string> = {
  black: "黒",
  sepia: "セピア",
  white: "白",
};
const playGestureLabels: Record<PlayGesture, string> = {
  doubleTap: "ダブルタップ",
  tap: "タップ",
};
const playGestureNotes: Record<PlayGesture, string> = {
  doubleTap:
    "本文のタップは読み上げ位置の移動だけです。ダブルタップで、その段落から再生します。",
  tap: "本文をタップすると、その段落から再生します。",
};

function keys<Key extends string>(labels: Record<Key, string>): Key[] {
  return Object.keys(labels) as Key[];
}

interface RowProps {
  title: string;
  children: ReactNode;
}

function Row({ title, children }: RowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={title}
        style={styles.choices}
      >
        {children}
      </View>
    </View>
  );
}

interface ChoiceRowProps<Key extends string> {
  title: string;
  labels: Record<Key, string>;
  value: Key;
  onChange: (value: Key) => void;
}

function ChoiceRow<Key extends string>({
  title,
  labels,
  value,
  onChange,
}: ChoiceRowProps<Key>) {
  return (
    <Row title={title}>
      {keys(labels).map((key) => {
        const selected = key === value;
        return (
          <View key={key} style={styles.cell}>
            <NativeButton
              label={labels[key]}
              accessibilityLabel={`${title} ${labels[key]}`}
              variant="outlined"
              role="radio"
              selected={selected}
              fill
              onPress={() => {
                onChange(key);
              }}
            />
          </View>
        );
      })}
    </Row>
  );
}

export function DisplaySettings() {
  const { settings, update } = useDisplay();

  return (
    <View style={styles.content}>
      <ChoiceRow
        title="文字サイズ"
        labels={fontSizeLabels}
        value={settings.fontSize}
        onChange={(fontSize) => {
          update({ fontSize });
        }}
      />
      <ChoiceRow
        title="行間"
        labels={lineHeightLabels}
        value={settings.lineHeight}
        onChange={(lineHeight) => {
          update({ lineHeight });
        }}
      />
      <Row title="テーマカラー">
        {keys(themeLabels).map((key) => {
          const selected = key === settings.theme;
          const palette = themes[key];
          return (
            <Pressable
              key={key}
              accessibilityRole="radio"
              accessibilityLabel={`テーマカラー ${themeLabels[key]}`}
              accessibilityState={{ checked: selected }}
              onPress={() => {
                update({ theme: key });
              }}
              style={[styles.ring, selected && styles.ringSelected]}
            >
              <View
                style={[styles.swatch, { backgroundColor: palette.background }]}
              >
                <Text style={[styles.label, { color: palette.text }]}>
                  {themeLabels[key]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </Row>
      <ChoiceRow
        title="本文から再生"
        labels={playGestureLabels}
        value={settings.playOn}
        onChange={(playOn) => {
          update({ playOn });
        }}
      />
      <Text style={styles.note}>{playGestureNotes[settings.playOn]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { flex: 1, minWidth: 0 },
  content: { gap: 18 },
  row: { gap: 8 },
  title: { color: colors.secondary, fontWeight: "500", fontSize: 13 },
  choices: { flexDirection: "row", gap: 8 },
  label: { color: colors.text, fontWeight: "400", fontSize: 13 },
  ring: {
    flex: 1,
    height: 40,
    padding: 2,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "transparent",
  },
  ringSelected: { borderColor: colors.text },
  swatch: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  note: {
    color: colors.secondary,
    fontWeight: "400",
    fontSize: 12,
    lineHeight: 18,
  },
});
