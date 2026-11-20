import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { NativeRow } from "@/components/NativeRow";
import { RowGroup } from "@/components/RowGroup";
import { colors } from "@/constants/theme";
import { bracketKinds } from "@/features/speech/brackets";
import { unsubscribeNothing, useSubscription } from "@/lib/subscription";
import { usePlayback } from "./Playback";
import { pitchLabel } from "./VoiceFields";

export function BracketVoiceList() {
  const { settings, voices, loadVoices } = usePlayback();
  const [voiceNames] = useState(() => (): (() => void) => {
    loadVoices();
    return unsubscribeNothing;
  });
  useSubscription(voiceNames);

  return (
    <View style={styles.section}>
      <Text style={styles.note}>
        カッコの中を、基本音声とは別の声で読めます。
      </Text>
      <RowGroup>
        {bracketKinds.map((kind) => {
          const own = settings.brackets[kind.id];
          const detail = own?.on
            ? `${
                own.voice === undefined
                  ? "端末標準"
                  : (voices.find((voice) => voice.identifier === own.voice)
                      ?.name ?? "選択した音声")
              } · 高さ ${pitchLabel(own.pitch)}`
            : "基本音声と同じ";
          return (
            <NativeRow
              key={kind.id}
              // WORKAROUND: 全角のカッコは字面の前に空きがあるので、名前を先に置く。カッコから始めると、タイトルが下の行より内側に入る。
              title={`${kind.label} ${kind.symbol}`}
              detail={detail}
              accessibilityLabel={`${kind.symbol} ${kind.label}の声 ${detail}`}
              onPress={() => {
                router.push({
                  pathname: "/bracket-voice",
                  params: { kind: kind.id },
                });
              }}
            />
          );
        })}
      </RowGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  note: {
    color: colors.secondary,
    fontWeight: "400",
    fontSize: 13,
    lineHeight: 20,
  },
});
