import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { IconButton } from "@/components/IconButton";
import { NativeSwitch } from "@/components/NativeSwitch";
import { colors, gutter } from "@/constants/theme";
import { bracketKinds, type BracketVoice } from "@/features/speech/brackets";
import { usePlayback } from "./Playback";
import { PitchField, VoiceField } from "./VoiceFields";

function close() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/settings/brackets");
  }
}

export default function BracketVoiceScreen() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const { settings, setBracketVoice } = usePlayback();
  const kind = bracketKinds.find((item) => item.id === params.kind);

  const own: BracketVoice = (kind && settings.brackets[kind.id]) ?? {
    on: false,
    voice: settings.voice,
    pitch: settings.pitch,
  };

  return (
    // WORKAROUND: 全画面モーダルは独立したネイティブのウィンドウで、セーフエリアを下の画面から受け継がない。
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <IconButton icon="x" label="閉じる" onPress={close} />
          <Text accessibilityRole="header" style={styles.title}>
            {kind ? `${kind.symbol} ${kind.label}の声` : "カッコ別の音声"}
          </Text>
        </View>
        {kind && (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.section}>
              <View style={styles.option}>
                <Text style={styles.optionLabel}>このカッコの声を変える</Text>
                <NativeSwitch
                  accessibilityLabel="このカッコの声を変える"
                  value={own.on}
                  onValueChange={(on) => {
                    setBracketVoice(kind.id, { ...own, on });
                  }}
                />
              </View>
              <Text style={styles.note}>
                オンにすると、{kind.symbol}
                の中を下の声で読みます。カッコの記号は読みません。同じ段落の中で閉じていないカッコは対象になりません。
              </Text>
            </View>
            {own.on && (
              <>
                <PitchField
                  value={own.pitch}
                  onChange={(pitch) => {
                    setBracketVoice(kind.id, { ...own, pitch });
                  }}
                />
                <VoiceField
                  label="声"
                  value={own.voice}
                  pitch={own.pitch}
                  onChange={(voice) => {
                    setBracketVoice(kind.id, { ...own, voice });
                  }}
                />
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 52,
    paddingHorizontal: 8,
  },
  title: { color: colors.text, fontWeight: "600", fontSize: 17 },
  content: { gap: 28, paddingHorizontal: gutter, paddingVertical: 16 },
  section: { gap: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  optionLabel: { color: colors.text, fontSize: 15 },
  note: {
    color: colors.secondary,
    fontWeight: "400",
    fontSize: 13,
    lineHeight: 20,
  },
});
