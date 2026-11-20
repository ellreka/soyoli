import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Screen } from "@/components/Screen";
import { DictionarySettings } from "@/features/dictionary/DictionarySettings";
import { BasicVoice, SpeedAndPitch } from "@/features/player/AudioSettings";
import { BracketVoiceList } from "@/features/player/BracketVoiceList";
import { SettingsPage } from "@/components/SettingsPage";

function back(): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/settings");
  }
}

export function VoiceSettingsScreen() {
  return (
    <Screen title="音声設定" onBack={back}>
      <View style={styles.page}>
        <SpeedAndPitch />
        <BasicVoice />
      </View>
    </Screen>
  );
}

export function BracketVoicesScreen() {
  return (
    <Screen title="カッコ別の音声" onBack={back}>
      <BracketVoiceList />
    </Screen>
  );
}

export function DictionarySettingsScreen() {
  return (
    <SettingsPage title="読み方辞書" onBack={back}>
      <DictionarySettings />
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  page: { gap: 28 },
});
