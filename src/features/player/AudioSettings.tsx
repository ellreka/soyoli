import { router } from "expo-router";
import { useState } from "react";
import { NativeButton } from "@/components/NativeButton";
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/Icon";
import { Pressable } from "@/components/Pressable";
import { StepSlider } from "@/components/StepSlider";

import { colors } from "@/constants/theme";
import { bracketKinds } from "@/features/speech/brackets";
import { usePlayback } from "./Playback";
import { PitchField, VoiceField } from "./VoiceFields";
import { maxRate, minRate } from "@/features/speech/voiceLimits";

const rates = [0.7, 1, 1.2, 1.5, 1.7, 2];

export function SpeedAndPitch() {
  const playback = usePlayback();
  const { settings } = playback;
  const [draggedRate, setDraggedRate] = useState<number | null>(null);
  const rate = draggedRate ?? settings.rate;

  return (
    <View style={styles.content}>
      <View style={styles.section}>
        <View style={styles.inline}>
          <Text accessibilityRole="header" style={styles.heading}>
            速度
          </Text>
          <Text style={styles.note}>{rate}×</Text>
        </View>
        <StepSlider
          accessibilityLabel="速度"
          value={settings.rate}
          min={minRate}
          max={maxRate}
          step={0.1}
          onChange={setDraggedRate}
          onCommit={(value) => {
            setDraggedRate(null);
            playback.setRate(value);
          }}
        />
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel="再生速度"
          style={styles.rates}
        >
          {rates.map((preset) => {
            const selected = settings.rate === preset;
            return (
              <View key={preset} style={styles.rate}>
                <NativeButton
                  label={`${preset}×`}
                  variant="outlined"
                  role="radio"
                  selected={selected}
                  fill
                  compact
                  onPress={() => {
                    playback.setRate(preset);
                  }}
                />
              </View>
            );
          })}
        </View>
      </View>
      <PitchField value={settings.pitch} onChange={playback.setPitch} />
    </View>
  );
}

export function voiceName(
  identifier: string | undefined,
  voices: readonly { identifier: string; name: string }[],
): string {
  return identifier === undefined
    ? "端末標準"
    : (voices.find((voice) => voice.identifier === identifier)?.name ??
        "選択した音声");
}

interface AudioSettingsProps {
  // WORKAROUND: ページを開く前にシートを閉じる。閉じないと、ページがシートの下で開く。
  onLeave: () => void;
}

export function AudioSettings({ onLeave }: AudioSettingsProps) {
  const { settings } = usePlayback();
  const ownVoices = bracketKinds.filter(
    (kind) => settings.brackets[kind.id]?.on,
  ).length;
  const brackets = ownVoices > 0 ? `${ownVoices}種類` : "オフ";
  return (
    <View style={styles.content}>
      <SpeedAndPitch />
      <BasicVoice />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`カッコ別の音声 ${brackets}`}
        onPress={() => {
          onLeave();
          router.push("/bracket-voices");
        }}
        style={styles.link}
      >
        <Text style={styles.heading}>カッコ別の音声</Text>
        <View style={styles.linkValue}>
          <Text style={styles.note}>{brackets}</Text>
          <Icon name="chevron-right" size={16} color={colors.secondary} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 28 },
  section: { gap: 10 },
  heading: { color: colors.text, fontWeight: "600", fontSize: 15 },
  note: {
    color: colors.secondary,
    fontWeight: "400",
    fontSize: 13,
    lineHeight: 20,
  },
  link: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  linkValue: { flexDirection: "row", alignItems: "center", gap: 4 },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rates: { flexDirection: "row", flexWrap: "nowrap", gap: 6, width: "100%" },
  rate: { flex: 1, minWidth: 0 },
});

export function BasicVoice() {
  const { settings, setVoice } = usePlayback();
  return (
    <VoiceField
      label="基本音声"
      value={settings.voice}
      pitch={settings.pitch}
      onChange={setVoice}
    />
  );
}
