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

/** 設定 › 音声設定: 速度、高さ、基本の声。 */
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

/** 設定 › カッコ別の音声: カッコの種類ごとの声。 */
export function BracketVoicesScreen() {
  return (
    <Screen title="カッコ別の音声" onBack={back}>
      <BracketVoiceList />
    </Screen>
  );
}

/** 設定 › 読み方辞書: 辞書の一覧。 */
export function DictionarySettingsScreen() {
  return (
    <SettingsPage title="読み方辞書" onBack={back}>
      <DictionarySettings />
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  // リーダーのシートと同じ間隔。
  page: { gap: 28 },
});
