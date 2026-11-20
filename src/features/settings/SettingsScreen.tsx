import { ListItem, Text } from "@expo/ui";
import { router } from "expo-router";
import { useState } from "react";

import { ListSwitch } from "@/components/ListSwitch";
import {
  NativeList,
  NativeListGroup,
  rowModifiers,
} from "@/components/NativeList";
import { colors } from "@/constants/theme";
import { AboutSettings } from "@/features/about/AboutSettings";
import { BackupSettings } from "@/features/backup/BackupSettings";
import { useDictionary } from "@/features/dictionary/Dictionary";
import { voiceName } from "@/features/player/AudioSettings";
import { bracketKinds } from "@/features/speech/brackets";
import { usePlayback } from "@/features/player/Playback";
import { rowColors, SettingsPage } from "@/components/SettingsPage";
import { unsubscribeNothing, useSubscription } from "@/lib/subscription";

function description(text: string) {
  return (
    <Text textStyle={{ fontSize: 13, lineHeight: 18, color: colors.secondary }}>
      {text}
    </Text>
  );
}

export default function SettingsScreen() {
  const {
    settings,
    voices,
    loadVoices,
    setPageSound,
    setKeepAwake,
    setAutoNext,
    setAuthorNotes,
  } = usePlayback();
  const { dictionary } = useDictionary();
  const named = settings.voice === undefined || voices.length > 0;
  const [voiceNames] = useState(() => (): (() => void) => {
    loadVoices();
    return unsubscribeNothing;
  });
  useSubscription(named ? null : voiceNames);
  const voice = voiceName(settings.voice, voices);
  const readings =
    dictionary.common.length +
    dictionary.sets.reduce((total, set) => total + set.entries.length, 0);
  const ownVoices = bracketKinds.filter(
    (kind) => settings.brackets[kind.id]?.on,
  ).length;
  return (
    <SettingsPage title="設定">
      <NativeList testID="settings-list">
        <NativeListGroup first title="読み上げ">
          <ListItem
            testID="settings-voice"
            colors={rowColors}
            modifiers={rowModifiers}
            supportingText={description("速度、声の高さ、基本音声")}
            trailing={`${voice} · ${settings.rate}x`}
            onPress={() => {
              router.push("/settings/speed");
            }}
          >
            音声設定
          </ListItem>
          <ListItem
            testID="settings-brackets"
            colors={rowColors}
            modifiers={rowModifiers}
            supportingText={description(
              "カッコの中を、基本音声とは別の声で読みます",
            )}
            trailing={ownVoices > 0 ? `${ownVoices}種類` : "オフ"}
            onPress={() => {
              router.push("/settings/brackets");
            }}
          >
            カッコ別の音声
          </ListItem>
          <ListItem
            testID="settings-keep-awake"
            colors={rowColors}
            modifiers={rowModifiers}
            supportingText={description(
              "読み上げている間、画面を自動で消しません",
            )}
            trailing=<ListSwitch
              testID="settings-keep-awake-switch"
              value={settings.keepAwake}
              onValueChange={setKeepAwake}
            />
            onPress={() => {
              setKeepAwake(!settings.keepAwake);
            }}
          >
            読み上げ中は画面を消さない
          </ListItem>
        </NativeListGroup>
        <NativeListGroup title="再生">
          <ListItem
            testID="settings-auto-next"
            colors={rowColors}
            modifiers={rowModifiers}
            supportingText={description(
              "話を読み終えたら、次の話を続けて読みます",
            )}
            trailing=<ListSwitch
              testID="settings-auto-next-switch"
              value={settings.autoNext}
              onValueChange={setAutoNext}
            />
            onPress={() => {
              setAutoNext(!settings.autoNext);
            }}
          >
            連続再生
          </ListItem>
          <ListItem
            testID="settings-author-notes"
            colors={rowColors}
            modifiers={rowModifiers}
            supportingText={description(
              "Web小説の前書きと後書きも読みます。次に取得する話から変わります",
            )}
            trailing=<ListSwitch
              testID="settings-author-notes-switch"
              value={settings.authorNotes}
              onValueChange={setAuthorNotes}
            />
            onPress={() => {
              setAuthorNotes(!settings.authorNotes);
            }}
          >
            前書き・後書きを読む
          </ListItem>
        </NativeListGroup>
        <NativeListGroup title="辞書">
          <ListItem
            testID="settings-dictionary"
            colors={rowColors}
            modifiers={rowModifiers}
            supportingText={description("語句ごとの読み方を登録します")}
            trailing={`${readings}件`}
            onPress={() => {
              router.push("/settings/dictionary");
            }}
          >
            読み方辞書
          </ListItem>
        </NativeListGroup>
        <NativeListGroup title="その他">
          <ListItem
            testID="settings-page-sound"
            colors={rowColors}
            modifiers={rowModifiers}
            supportingText={description(
              "読み上げが次の話へ進んだときに鳴らします",
            )}
            trailing=<ListSwitch
              testID="settings-page-sound-switch"
              value={settings.pageSound}
              onValueChange={setPageSound}
            />
            onPress={() => {
              setPageSound(!settings.pageSound);
            }}
          >
            ページをめくる音
          </ListItem>
        </NativeListGroup>
        <BackupSettings />
        <AboutSettings />
      </NativeList>
    </SettingsPage>
  );
}
