import { DictionaryProvider } from "@/features/dictionary/Dictionary";
import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";

import { ImportFilesProvider } from "@/features/library/ImportFiles";
import { LibraryProvider } from "@/features/library/Library";
import { LibraryPlaybackProvider } from "@/features/loading/LibraryPlaybackProvider";
import { ChapterLoaderProvider } from "@/features/loading/ChapterLoader";
import { DisplayProvider } from "@/features/reader/Display";
import { colors } from "@/constants/theme";
import { useBackToBackground } from "@/lib/appTask";

export const unstable_settings = { anchor: "(tabs)" };

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.text,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
  },
};

export default function RootLayout() {
  useBackToBackground();
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <LibraryProvider>
        <DictionaryProvider>
          <LibraryPlaybackProvider>
            <ImportFilesProvider>
              <ChapterLoaderProvider>
                <DisplayProvider>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: colors.background },
                    }}
                  >
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen
                      name="reader"
                      options={{
                        // WORKAROUND: Android は画面を pop した瞬間に中身を捨て、ネイティブの退場アニメーションに見せるものがない。リーダーは自分でスライドして出ていき（ReaderScreen）、下の画面は透明なモーダルが表示したままにする。
                        presentation:
                          Platform.OS === "android"
                            ? "transparentModal"
                            : "modal",
                        ...(Platform.OS === "android" && {
                          contentStyle: { backgroundColor: "transparent" },
                        }),
                        animation: "slide_from_bottom",
                      }}
                    />
                    <Stack.Screen
                      name="work-dictionary"
                      options={{
                        presentation: "fullScreenModal",
                        animation: "slide_from_bottom",
                      }}
                    />
                    <Stack.Screen
                      name="dictionary-select"
                      options={{
                        presentation: "fullScreenModal",
                        animation: "slide_from_bottom",
                      }}
                    />
                    <Stack.Screen
                      name="dictionary"
                      options={{
                        presentation: "fullScreenModal",
                        animation: "slide_from_bottom",
                      }}
                    />
                    <Stack.Screen
                      name="bracket-voices"
                      options={{
                        presentation: "fullScreenModal",
                        animation: "slide_from_bottom",
                      }}
                    />
                    <Stack.Screen
                      name="bracket-voice"
                      options={{
                        presentation: "fullScreenModal",
                        animation: "slide_from_bottom",
                      }}
                    />
                  </Stack>
                </DisplayProvider>
              </ChapterLoaderProvider>
            </ImportFilesProvider>
          </LibraryPlaybackProvider>
        </DictionaryProvider>
      </LibraryProvider>
    </ThemeProvider>
  );
}
