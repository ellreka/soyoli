import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { NativeButton } from "@/components/NativeButton";
import { NativeSelect } from "@/components/NativeSelect";
import { StepSlider } from "@/components/StepSlider";
import { colors } from "@/constants/theme";
import { useSubscription } from "@/lib/subscription";
import { usePlayback } from "./Playback";
import { maxPitch, minPitch } from "@/features/speech/voiceLimits";

export function pitchLabel(pitch: number): string {
  return pitch === 1 ? "標準" : pitch.toFixed(1);
}

interface PitchFieldProps {
  value: number;
  onChange: (pitch: number) => void;
}

export function PitchField({ value, onChange }: PitchFieldProps) {
  const [dragged, setDragged] = useState<number | null>(null);
  return (
    <View style={styles.section}>
      <View style={styles.inline}>
        <Text accessibilityRole="header" style={styles.heading}>
          声の高さ
        </Text>
        <Text style={styles.note}>{pitchLabel(dragged ?? value)}</Text>
      </View>
      <StepSlider
        accessibilityLabel="声の高さ"
        value={value}
        min={minPitch}
        max={maxPitch}
        step={0.1}
        onChange={setDragged}
        onCommit={(pitch) => {
          setDragged(null);
          onChange(pitch);
        }}
      />
      <View style={styles.reset}>
        <NativeButton
          label="標準に戻す"
          variant="text"
          onPress={() => {
            setDragged(null);
            onChange(1);
          }}
        />
      </View>
    </View>
  );
}

interface VoiceFieldProps {
  label: string;
  value: string | undefined;
  pitch: number;
  onChange: (voice: string | undefined) => void;
}

export function VoiceField({ label, value, pitch, onChange }: VoiceFieldProps) {
  const {
    voices,
    voiceLoading,
    voiceError,
    preview,
    previewError,
    loadVoices,
    previewVoice,
    stopPreview,
  } = usePlayback();
  const [pickingVoice] = useState(() => (): (() => void) => {
    loadVoices();
    return stopPreview;
  });
  useSubscription(pickingVoice);
  const options = [
    { value: "", label: "端末標準" },
    ...voices.map((voice) => ({
      value: voice.identifier,
      label:
        voice.quality === "Enhanced" ? `${voice.name}（拡張）` : voice.name,
    })),
  ];
  // WORKAROUND: 今の値を含まないメニューは、別の値を表示し、設定してしまうことがある。選ばれた声は必ず選択肢に入れる。
  if (
    value !== undefined &&
    !options.some((option) => option.value === value)
  ) {
    options.push({ value, label: "選択した音声" });
  }
  const listening = preview !== null && preview.voice === value;
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {label}
      </Text>
      <View style={styles.choice}>
        <NativeSelect
          accessibilityLabel={label}
          value={value ?? ""}
          options={options}
          onChange={(identifier) => {
            stopPreview();
            onChange(identifier || undefined);
          }}
        />
        <NativeButton
          label={listening ? "停止" : "試聴"}
          accessibilityLabel={
            listening ? `${label}の試聴を停止` : `${label}の試聴`
          }
          variant="outlined"
          onPress={() => {
            if (listening) {
              stopPreview();
            } else {
              previewVoice(value, pitch);
            }
          }}
        />
      </View>
      <Text style={styles.note}>試聴すると本文の再生は一時停止します。</Text>
      {voiceLoading && (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.note}>音声を読み込み中…</Text>
        </View>
      )}
      {voiceError && (
        <Text accessibilityRole="alert" style={styles.note}>
          {voiceError}
        </Text>
      )}
      {!voiceLoading && !voiceError && voices.length === 0 && (
        <Text style={styles.note}>
          日本語音声が見つかりません。端末標準の音声を利用できます。
        </Text>
      )}
      {previewError && (
        <Text accessibilityRole="alert" style={styles.note}>
          {previewError}
        </Text>
      )}
      <NativeButton
        label="音声一覧を再取得"
        variant="outlined"
        disabled={voiceLoading}
        onPress={loadVoices}
      />
      <Text style={styles.note}>
        音声の追加は、端末の読み上げ設定で行ってください。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  heading: { color: colors.text, fontWeight: "600", fontSize: 15 },
  note: {
    color: colors.secondary,
    fontWeight: "400",
    fontSize: 13,
    lineHeight: 20,
  },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reset: { alignItems: "center" },
  loading: { flexDirection: "row", alignItems: "center", gap: 8 },
  choice: { flexDirection: "row", alignItems: "center", gap: 12 },
});
