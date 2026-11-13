// アプリ全体。画面を通すテストのためのもの: すべてのルートをルーターの
// 下に置き、端末（ファイル、音声、プラットフォーム自身の操作部品）を偽物に
// 置き換える。テストファイルでは、偽物にするモジュールより前に、これを
// 最初に import し、`renderRouter(routes)` で描画する。

import { act, fireEvent, screen, within } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import * as RootLayout from "@/app/_layout";
import DictionaryEditScreen from "@/app/dictionary";
import DictionarySelectScreen from "@/app/dictionary-select";
import WorkDictionaryScreen from "@/app/work-dictionary";
import DictionarySetScreen from "@/app/(tabs)/settings/dictionary-set";
import TabLayout from "@/app/(tabs)/_layout";
import BookshelfScreen from "@/app/(tabs)/index";
import * as HomeLayout from "@/app/(tabs)/home/_layout";
import BrowseScreen from "@/app/(tabs)/home/browse";
import HomeScreen from "@/app/(tabs)/home/index";
import * as SettingsLayout from "@/app/(tabs)/settings/_layout";
import BracketVoicesScreen from "@/app/(tabs)/settings/brackets";
import VoiceSettingsScreen from "@/app/(tabs)/settings/speed";
import BracketVoicesModal from "@/app/bracket-voices";
import DictionarySettingsScreen from "@/app/(tabs)/settings/dictionary";
import SettingsScreen from "@/app/(tabs)/settings/index";
import ReaderScreen from "@/app/reader";
import type { Book } from "@/features/books/book";
import { removeFile } from "@/features/books/fileStore";
import {
  importFile,
  openSavedFile,
  savedFileBooks,
} from "@/features/books/import";
import { loadLibrary, saveLibrary } from "@/features/library/libraryStorage";
import { loadShelfOrder, saveShelfOrder } from "@/features/library/shelfOrder";
import {
  loadDictionary,
  saveDictionary,
} from "@/features/dictionary/dictionaryStorage";
import BracketVoiceScreen from "@/features/player/BracketVoiceScreen";
import { loadPlayback } from "@/features/player/storage";
import { loadDisplay, saveDisplay } from "@/features/reader/displayStorage";

jest.mock("@expo/ui", () => {
  const { Modal } = jest.requireActual("react-native");
  return {
    BottomSheet: jest.fn(
      ({
        isPresented,
        onDismiss,
        children,
        testID,
      }: import("@expo/ui").BottomSheetProps) => (
        <Modal
          testID={testID}
          visible={isPresented}
          onDismiss={onDismiss}
          onRequestClose={onDismiss}
        >
          {children}
        </Modal>
      ),
    ),
    // プラットフォームのリストと行: 行が何を言い、何をするかを保った代役。
    // その上に作った画面を動かせるようにするため。
    List: Object.assign(
      ({ children }: { children: import("react").ReactNode }) => children,
      {
        ForEach: <T,>({
          data,
          keyExtractor,
          children,
        }: import("@expo/ui").ListForEachProps<T>) => {
          const { Fragment } = jest.requireActual("react");
          return data.map((item, index) => (
            <Fragment key={keyExtractor(item, index)}>
              {children({ item, index })}
            </Fragment>
          ));
        },
      },
    ),
    Column: ({ children }: { children: import("react").ReactNode }) => children,
    Row: ({ children }: { children: import("react").ReactNode }) => children,
    Spacer: () => null,
    // アイコンは飾り。ラベルは周りのボタンが持つ。
    Icon: Object.assign(() => null, {
      select: (spec: { ios: string }) => spec.ios,
    }),
    Text: ({ children }: { children?: string }) => {
      const { Text } = jest.requireActual("react-native");
      return <Text>{children}</Text>;
    },
    Button: ({ label, onPress }: import("@expo/ui").ButtonProps) => {
      const { Pressable, Text } = jest.requireActual("react-native");
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
        >
          <Text>{label}</Text>
        </Pressable>
      );
    },
    ListItem: ({
      children,
      trailing,
      leading,
      supportingText,
      onPress,
      testID,
      colors: rowColors,
    }: import("@expo/ui").ListItemProps) => {
      const { Pressable, Text } = jest.requireActual("react-native");
      return (
        <Pressable
          testID={testID}
          // シートの行は単一選択: 選ばれた行はリングが塗りつぶされる（タイマー）か、
          // 一段明るく塗られる（章）。
          accessibilityRole={
            testID?.startsWith("sheet-row-") ? "radio" : "button"
          }
          accessibilityState={
            testID?.startsWith("sheet-row-")
              ? {
                  checked:
                    (leading as { props?: { selected?: boolean } } | null)
                      ?.props?.selected === true ||
                    rowColors?.containerColor ===
                      jest.requireActual("@/constants/theme").colors.selected,
                }
              : undefined
          }
          accessibilityLabel={typeof children === "string" ? children : ""}
          accessibilityValue={
            typeof trailing === "string" ? { text: trailing } : undefined
          }
          onPress={onPress}
        >
          <Text>{children}</Text>
          {typeof supportingText === "string" ? (
            <Text>{supportingText}</Text>
          ) : (
            supportingText
          )}
          {typeof trailing === "string" ? null : trailing}
        </Pressable>
      );
    },
    Switch: ({
      value,
      onValueChange,
      testID,
    }: import("@expo/ui").SwitchProps) => {
      const { Switch } = jest.requireActual("react-native");
      return (
        <Switch
          testID={testID}
          accessibilityRole="switch"
          accessibilityState={{ checked: value }}
          value={value}
          onValueChange={onValueChange}
        />
      );
    },
    Host: ({ children }: { children: import("react").ReactNode }) => children,
    RNHostView: ({
      children,
    }: {
      children: import("@expo/ui").RNHostViewProps;
    }) => children,
  };
});
jest.mock("@expo/ui/swift-ui", () => ({
  List: ({ children }: { children: import("react").ReactNode }) => children,
}));
jest.mock("@/components/NativeList", () =>
  jest.requireActual("../components/NativeList.tsx"),
);
jest.mock("@expo/ui/swift-ui/modifiers", () => ({
  scrollContentBackground: jest.fn(),
  buttonStyle: jest.fn(),
  tint: jest.fn(),
}));
jest.mock("@/features/library/libraryStorage", () => ({
  loadLibrary: jest.fn(() => null),
  saveLibrary: jest.fn(),
}));
jest.mock("@/features/books/import", () => ({
  savedFileBooks: jest.fn(() => []),
  openSavedFile: jest.fn(),
  importFile: jest.fn(),
}));
jest.mock("@/features/books/fileStore", () => ({ removeFile: jest.fn() }));
jest.mock("@/features/library/shelfOrder", () => ({
  ...jest.requireActual("@/features/library/shelfOrder"),
  loadShelfOrder: jest.fn(() => []),
  saveShelfOrder: jest.fn(),
}));
jest.mock("@/features/library/shelfView", () => ({
  loadShelfView: jest.fn(() => "grid"),
  saveShelfView: jest.fn(),
}));
jest.mock("@/features/player/storage", () => ({
  ...jest.requireActual("@/features/player/storage"),
  loadPlayback: jest.fn(() => null),
  savePlayback: jest.fn(),
}));
jest.mock("@/features/reader/displayStorage", () => ({
  loadDisplay: jest.fn(() => null),
  saveDisplay: jest.fn(),
}));
jest.mock("@/features/dictionary/dictionaryStorage", () => ({
  loadDictionary: jest.fn(() => null),
  saveDictionary: jest.fn(),
}));
jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/features/player/pageSound", () => ({
  playPageTurn: jest.fn(),
  pageTurnWait: () => 0,
}));
jest.mock("expo-speech", () => ({
  speak: jest.fn(),
  stop: jest.fn(() => Promise.resolve()),
  maxSpeechInputLength: 4000,
  VoiceQuality: { Default: "Default", Enhanced: "Enhanced" },
  getAvailableVoicesAsync: jest.fn(() =>
    Promise.resolve([
      { identifier: "ja-voice", name: "日本語音声", language: "ja-JP" },
    ]),
  ),
}));

export const book: Book = {
  id: "sample-01",
  source: "file",
  title: "サンプル作品",
  author: "サンプル著者",
  chapters: [
    {
      id: "first",
      title: "はじまり",
      content: [{ type: "text", text: "最初の本文。\nもう一つの文。" }],
    },
    {
      id: "second",
      title: "おわり",
      content: [{ type: "text", text: "次の本文。" }],
    },
  ],
};
// レイアウトはコンポーネントだけでなく丸ごと渡す: その `unstable_settings`
// （ほかの画面の下にある画面）は、アプリのナビゲーションの一部である。
export const routes = {
  _layout: RootLayout,
  "(tabs)/_layout": TabLayout,
  "(tabs)/home/_layout": HomeLayout,
  "(tabs)/home/index": HomeScreen,
  "(tabs)/home/browse": BrowseScreen,
  "(tabs)/index": BookshelfScreen,
  "(tabs)/settings/_layout": SettingsLayout,
  "(tabs)/settings/index": SettingsScreen,
  "(tabs)/settings/brackets": BracketVoicesScreen,
  "(tabs)/settings/speed": VoiceSettingsScreen,
  "bracket-voices": BracketVoicesModal,
  "(tabs)/settings/dictionary": DictionarySettingsScreen,
  reader: ReaderScreen,
  dictionary: DictionaryEditScreen,
  "dictionary-select": DictionarySelectScreen,
  "work-dictionary": WorkDictionaryScreen,
  "(tabs)/settings/dictionary-set": DictionarySetScreen,
  "bracket-voice": BracketVoiceScreen,
};

/** 開いているシートを、下へのスワイプや外側のタップと同じやり方で閉じる。 */
export async function dismissSheet() {
  await act(async () => {
    screen.getByTestId("player-sheet").props.onDismiss();
  });
}

export function chapterText(text: string) {
  return within(screen.getByTestId("chapter-content")).getByText(text);
}

/** 幅 180pt のシークバーを `x` までドラッグし、そこで離す。 */
export async function seek(x: number) {
  const track = screen.getByTestId("playback-position");
  await fireEvent.layout(track, { width: 180, height: 28 });
  await fireEvent(track, "responderGrant", {
    nativeEvent: { pageX: 0, locationX: 0 },
  });
  await fireEvent(track, "responderMove", { nativeEvent: { pageX: x } });
  await fireEvent(track, "responderRelease", { nativeEvent: { pageX: x } });
}

/**
 * 起動時にライブラリが持っているもの。ファイル由来の作品は端末に保存されて
 * いる。ここに渡した Web 小説は、このセッションですでに開いたもの。
 */
export function seed(...works: Book[]) {
  jest
    .mocked(savedFileBooks)
    .mockReturnValue(
      works.map((work) =>
        work.source === "file" ? { file: "kept.epub", ...work } : work,
      ),
    );
}

export const savedDictionary = {
  common: [{ surface: "一", reading: "いち" }],
  sets: [
    {
      id: "s1",
      name: "サンプルの辞書",
      entries: [{ surface: "本文", reading: "ほんもん" }],
    },
    { id: "s2", name: "別の辞書", entries: [] },
  ],
  assigned: { "sample-01": { setId: "s1", title: "サンプル作品" } },
};

beforeEach(() => {
  jest.mocked(loadLibrary).mockReset().mockReturnValue(null);
  jest.mocked(savedFileBooks).mockReset();
  seed(book);
  jest.mocked(openSavedFile).mockReset();
  jest.mocked(importFile).mockReset();
  jest.mocked(removeFile).mockClear();
  jest.mocked(saveLibrary).mockClear();
  jest.mocked(loadShelfOrder).mockReset().mockReturnValue([]);
  jest.mocked(saveShelfOrder).mockClear();
  jest.mocked(loadPlayback).mockReset().mockReturnValue(null);
  jest.mocked(loadDictionary).mockReset().mockReturnValue(null);
  jest.mocked(saveDictionary).mockClear();
  jest.mocked(loadDisplay).mockReset().mockReturnValue(null);
  jest.mocked(saveDisplay).mockClear();
  jest.mocked(Speech.speak).mockClear();
  jest.mocked(Speech.stop).mockReset().mockResolvedValue();
  jest
    .mocked(Speech.getAvailableVoicesAsync)
    .mockReset()
    .mockResolvedValue([
      {
        identifier: "ja-voice",
        name: "日本語音声",
        language: "ja-JP",
        quality: Speech.VoiceQuality.Enhanced,
      },
    ]);
});
