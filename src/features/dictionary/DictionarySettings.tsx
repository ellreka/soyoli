import { ListItem } from "@expo/ui";
import { router } from "expo-router";

import {
  NativeList,
  NativeListGroup,
  rowModifiers,
} from "@/components/NativeList";
import { rowColors } from "@/components/SettingsPage";
import { useDictionary } from "./Dictionary";
import { booksUsing } from "./entries";
import { activeSystemRules, systemRules } from "./system";

function open(id: string): void {
  router.push({ pathname: "/settings/dictionary-set", params: { id } });
}

/**
 * 辞書をネイティブのリストに、2 つのグループで並べる。最初は全作品に
 * 適用されるもの: アプリ自身の辞書、続いて利用者の共通辞書。次に名前付きの
 * 辞書で、読みの件数と使っている作品の数を添える。行を押すと辞書のページが
 * 開く。
 */
export function DictionarySettings() {
  const { dictionary } = useDictionary();
  return (
    <NativeList testID="dictionary-list">
      <NativeListGroup first>
        <ListItem
          testID="dictionary-set-system"
          supportingText="アプリ組み込み・編集不可"
          trailing={`${activeSystemRules(dictionary.systemOff).length}／${systemRules.length}件`}
          colors={rowColors}
          modifiers={rowModifiers}
          onPress={() => {
            open("system");
          }}
        >
          システム辞書
        </ListItem>
        <ListItem
          testID="dictionary-set-common"
          supportingText="どの作品にも適用"
          trailing={`${dictionary.common.length}件`}
          colors={rowColors}
          modifiers={rowModifiers}
          onPress={() => {
            open("common");
          }}
        >
          すべての作品
        </ListItem>
      </NativeListGroup>
      {dictionary.sets.length > 0 && (
        <NativeListGroup>
          {dictionary.sets.map((set) => (
            <ListItem
              key={set.id}
              testID={`dictionary-set-${set.name}`}
              supportingText={`${booksUsing(dictionary, set.id).length}作品で使用`}
              trailing={`${set.entries.length}件`}
              colors={rowColors}
              modifiers={rowModifiers}
              onPress={() => {
                open(set.id);
              }}
            >
              {set.name}
            </ListItem>
          ))}
        </NativeListGroup>
      )}
    </NativeList>
  );
}
