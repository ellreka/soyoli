import * as Speech from "expo-speech";
import { Alert } from "react-native";

import { useDictionary } from "@/features/dictionary/Dictionary";
import { useLibrary } from "@/features/library/Library";
import { usePlayback } from "@/features/player/Playback";
import {
  backupFileName,
  backupSummary,
  fromBackupFile,
  positionsToRestore,
  toBackupFile,
  withKnownVoices,
  type Backup,
} from "./backup";
import { pickBackup, saveBackup } from "./backupFile";

interface BackupActions {
  exportBackup: () => void;
  importBackup: () => void;
}

async function knownVoices(): Promise<string[] | null> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.map((voice) => voice.identifier);
  } catch {
    return null;
  }
}

export function useBackup(): BackupActions {
  const library = useLibrary();
  const { dictionary, replace } = useDictionary();
  const playback = usePlayback();

  function apply(backup: Backup, voices: string[] | null) {
    const openId = playback.state.book?.id;
    if (backup.dictionary) {
      replace(backup.dictionary);
    }
    playback.restore(
      backup.settings && voices
        ? withKnownVoices(backup.settings, voices)
        : backup.settings,
      positionsToRestore(backup, library, openId),
    );
    library.mergeSaved(backup.works, openId);
  }

  async function write() {
    const saved = await saveBackup(
      backupFileName(new Date()),
      toBackupFile(
        {
          dictionary,
          settings: playback.settings,
          works: library,
          positions: playback.positionsOf(),
        },
        new Date(),
      ),
    );
    if (!saved.canceled) {
      Alert.alert("バックアップを保存しました", saved.name);
    }
  }

  async function read() {
    const picked = await pickBackup();
    if (picked.canceled) {
      return;
    }
    const backup = fromBackupFile(picked.value);
    const summary = backup ? backupSummary(backup) : "";
    if (!backup || !summary) {
      Alert.alert(
        "取り込めませんでした",
        "Soyoli のバックアップファイルではないか、取り込めるものが入っていません。",
      );
      return;
    }
    const voices = await knownVoices();
    Alert.alert("バックアップを取り込みますか？", summary, [
      { text: "キャンセル", style: "cancel" },
      {
        text: "取り込む",
        onPress: () => {
          apply(backup, voices);
        },
      },
    ]);
  }

  return {
    exportBackup: () => {
      write().catch(() => {
        Alert.alert(
          "書き出せませんでした",
          "選んだ場所にファイルを保存できませんでした。別のフォルダを選んでください。",
        );
      });
    },
    importBackup: () => {
      read().catch(() => {
        Alert.alert(
          "取り込めませんでした",
          "ファイルを読めませんでした。バックアップの JSON ファイルを選んでください。",
        );
      });
    },
  };
}
