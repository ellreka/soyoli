import { useState } from "react";
import { NativeButton } from "@/components/NativeButton";
import {
  router,
  useIsFocused,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { Animated, Dimensions, Platform, StyleSheet, Text } from "react-native";

import { Screen } from "@/components/Screen";
import { colors } from "@/constants/theme";
import type { Book } from "@/features/books/book";
import { useLibrary } from "@/features/library/Library";
import { usePlayback } from "@/features/player/Playback";
import { onHardwareBack } from "@/lib/hardwareBack";
import { useSubscription, type Subscription } from "@/lib/subscription";
import { Reader } from "./Reader";

function closeReader() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
}

const closeMs = 260;

// WORKAROUND: Android は、ネイティブのアニメーションが走る前に pop された画面の中身を消す。リーダーがまず自分で下へスライドし、その後で pop される。
function createCloser() {
  const offset = new Animated.Value(0);
  const progress = { closing: false };
  function close(): void {
    if (Platform.OS !== "android") {
      closeReader();
      return;
    }
    if (progress.closing) {
      return;
    }
    progress.closing = true;
    Animated.timing(offset, {
      toValue: Dimensions.get("window").height,
      duration: closeMs,
      easing: (t) => t * t,
      useNativeDriver: true,
    }).start(closeReader);
  }
  const closeOnBack = onHardwareBack(() => {
    close();
    return true;
  });
  return {
    style: { flex: 1, transform: [{ translateY: offset }] },
    close,
    closeOnBack,
  };
}

function useCloseAnimation() {
  const [closer] = useState(createCloser);
  const focused = useIsFocused();
  useSubscription(
    focused && Platform.OS === "android" ? closer.closeOnBack : null,
  );
  return closer;
}

interface FileFailure {
  id: string;
  message: string;
}

function needsFile(book: Book): boolean {
  return Boolean(book.file) && book.chapters.length === 0;
}

function failureMessage(cause: unknown): string {
  return cause instanceof Error
    ? cause.message
    : "ファイルを読み込めませんでした。";
}

function useOpenOnFocus(
  id: string | undefined,
  onFailure: (failure: FileFailure) => void,
): void {
  const navigation = useNavigation();
  const { bookById, markOpened, loadFile } = useLibrary();
  const { openBook } = usePlayback();
  function openOnFocus(bookId: string | undefined): Subscription {
    function open(): void {
      const found = bookId ? bookById(bookId) : undefined;
      if (!found) {
        return;
      }
      if (!needsFile(found)) {
        openBook(found);
        markOpened(found.id);
        return;
      }
      loadFile(found.id).then(
        (loaded) => {
          openBook(loaded);
          markOpened(loaded.id);
        },
        (cause: unknown) => {
          onFailure({ id: found.id, message: failureMessage(cause) });
        },
      );
    }
    return () => {
      if (navigation.isFocused()) {
        open();
      }
      return navigation.addListener("focus", open);
    };
  }
  const [opening, setOpening] = useState(() => ({
    id,
    subscribe: openOnFocus(id),
  }));
  if (opening.id !== id) {
    setOpening({ id, subscribe: openOnFocus(id) });
  }
  useSubscription(opening.subscribe);
}

export default function ReaderScreen() {
  const closing = useCloseAnimation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { books } = useLibrary();
  const found = books.find((item) => item.id === id);
  const unread = found !== undefined && needsFile(found);
  const book = unread ? undefined : found;
  const [failed, setFailed] = useState<FileFailure | null>(null);
  useOpenOnFocus(id, setFailed);
  const unreadId = unread ? found.id : undefined;
  const fileError = failed?.id === unreadId ? failed?.message : undefined;

  if (book) {
    return (
      <Animated.View style={closing.style}>
        <Reader key={book.id} book={book} onClose={closing.close} />
      </Animated.View>
    );
  }
  return (
    <Screen title="リーダー">
      {unread && !fileError && <Text style={styles.text}>読み込み中…</Text>}
      {unread && fileError && (
        <Text accessibilityRole="alert" style={styles.text}>
          {fileError}
        </Text>
      )}
      {!unread && (
        <Text accessibilityRole="alert" style={styles.text}>
          作品が見つかりません。
        </Text>
      )}
      <NativeButton
        label="閉じる"
        variant="outlined"
        fill
        onPress={closeReader}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.text, fontSize: 14 },
});
