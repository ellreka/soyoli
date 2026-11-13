import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

import { NativeRow } from "@/components/NativeRow";
import { RowGroup } from "@/components/RowGroup";
import { colors } from "@/constants/theme";
import { bracketKinds } from "@/features/speech/brackets";
import { usePlayback } from "./Playback";
import { pitchLabel } from "./VoiceFields";

/**
 * カッコの種類と、それぞれを読む声。行を押すとその種類のエディタが開く。
 */
export function BracketVoiceList() {
  const { settings, voices, loadVoices } = usePlayback();
  // これまでに選んだ声の名前。
  useEffect(() => {
    loadVoices();
  }, [loadVoices]);

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
              // 名前を先に: 全角のカッコは空白から始まるので、先に置くとタイトルが
              // 下の行より内側に入ってしまう。
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
