import { ListItem, Text } from "@expo/ui";

import { NativeListGroup, rowModifiers } from "@/components/NativeList";
import { rowColors } from "@/components/SettingsPage";
import { colors } from "@/constants/theme";
import { useBackup } from "./useBackup";

function description(text: string) {
  return (
    <Text textStyle={{ fontSize: 13, lineHeight: 18, color: colors.secondary }}>
      {text}
    </Text>
  );
}

export function BackupSettings() {
  const { exportBackup, importBackup } = useBackup();
  return (
    <NativeListGroup title="バックアップ">
      <ListItem
        testID="settings-backup-export"
        colors={rowColors}
        modifiers={rowModifiers}
        supportingText={description(
          "辞書・音声設定・本棚と履歴のWeb小説を、選んだフォルダにファイルで保存します",
        )}
        onPress={exportBackup}
      >
        バックアップを書き出す
      </ListItem>
      <ListItem
        testID="settings-backup-import"
        colors={rowColors}
        modifiers={rowModifiers}
        supportingText={description(
          "辞書と音声設定を置き換え、Web小説を本棚と履歴に加えます",
        )}
        onPress={importBackup}
      >
        バックアップから取り込む
      </ListItem>
    </NativeListGroup>
  );
}
