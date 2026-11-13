import { router } from "expo-router";
import { useEffect, useState } from "react";
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

/** 1 回のタップで選べる速度。その間の値はスライダーと ± で届く。 */
const rates = [0.7, 1, 1.2, 1.5, 1.7, 2];

/**
 * 速度と高さ: いちばんよく、耳で聞きながら変えるもの。リーダーのシートと、
 * 設定タブのページに出る。
 */
export function SpeedAndPitch() {
  const playback = usePlayback();
  const { settings } = playback;
  // スライダーをドラッグしている間に表示する速度。それ以外は null。
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
          // 下のボタンに追従する: ボタンを押すとつまみが動く。
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

/** 声が一覧に出るときの名前。端末の既定の声には、固有の名前がない。 */
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
  /**
   * 行がページを開く前に呼ばれる: この設定が入っているシートを閉じる。
   * そうしないと、ページがシートの下で開く。
   */
  onLeave: () => void;
}

/**
 * リーダーの音声シート: 速度、高さ、基本の声をその場で変えられ、カッコの
 * 声の行はそのページを開く。ここにあるものは、すべて設定タブにもある。
 */
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
      {/* 上の見出しと同じ組み方にして、位置を揃える。末尾の値と
      シェブロンが、ページを開く行であることを示す。 */}
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
  // 6 つすべてが、行の幅を等分する。
  rate: { flex: 1, minWidth: 0 },
});

/**
 * 本文を読む声。端末の日本語の声から選ぶ。声を読み込み、離れるときに
 * まだ鳴っている試聴を止める。
 */
export function BasicVoice() {
  const { settings, loadVoices, stopPreview, setVoice } = usePlayback();
  useEffect(() => {
    loadVoices();
    return stopPreview;
  }, [loadVoices, stopPreview]);
  return (
    <VoiceField
      label="基本音声"
      value={settings.voice}
      pitch={settings.pitch}
      onChange={setVoice}
    />
  );
}
