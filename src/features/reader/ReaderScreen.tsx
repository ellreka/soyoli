import { useCallback, useEffect, useState } from "react";
import { NativeButton } from "@/components/NativeButton";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  Animated,
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
} from "react-native";

import { Screen } from "@/components/Screen";
import { colors } from "@/constants/theme";
import { useLibrary } from "@/features/library/Library";
import { usePlayback } from "@/features/player/Playback";
import { Reader } from "./Reader";

function closeReader() {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace("/");
  }
}

/**
 * リーダーを閉じる。iOS はモーダルを自前のアニメーションで閉じる。
 * Android では、ネイティブのアニメーションが走る前に pop された画面の
 * 中身が消えるので、リーダーがまず自分で下へスライドし、その後で pop される。
 */
function useCloseAnimation(): {
  style: { flex: number; transform: { translateY: Animated.Value }[] };
  close: () => void;
} {
  const { height } = useWindowDimensions();
  const [offset] = useState(() => new Animated.Value(0));
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => {
    if (Platform.OS !== "android") {
      closeReader();
      return;
    }
    if (closing) {
      return;
    }
    setClosing(true);
    Animated.timing(offset, {
      toValue: height,
      duration: 260,
      easing: (t) => t * t,
      useNativeDriver: true,
    }).start(closeReader);
  }, [closing, height, offset]);

  // システムの戻るボタンとジェスチャーも、同じやり方で閉じる。
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") {
        return undefined;
      }
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          close();
          return true;
        },
      );
      return () => {
        subscription.remove();
      };
    }, [close]),
  );

  return { style: { flex: 1, transform: [{ translateY: offset }] }, close };
}

export default function ReaderScreen() {
  const closing = useCloseAnimation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { books, markOpened, loadFile } = useLibrary();
  const found = books.find((item) => item.id === id);
  // 端末に保存した作品は、ファイルを読むまで本文がない。
  const unread = Boolean(found?.file) && found?.chapters.length === 0;
  const book = unread ? undefined : found;
  // どの作品の失敗かと一緒に持つ: 別の作品の失敗は表示しない。
  const [failed, setFailed] = useState<{ id: string; message: string } | null>(
    null,
  );
  const unreadId = unread ? found?.id : undefined;
  useEffect(() => {
    if (!unreadId) {
      return;
    }
    loadFile(unreadId).catch((cause: unknown) => {
      setFailed({
        id: unreadId,
        message:
          cause instanceof Error
            ? cause.message
            : "ファイルを読み込めませんでした。",
      });
    });
  }, [unreadId, loadFile]);
  const fileError = failed?.id === unreadId ? failed?.message : undefined;
  const { openBook } = usePlayback();
  useFocusEffect(
    useCallback(() => {
      if (book) {
        openBook(book);
      }
    }, [book, openBook]),
  );
  // 作品を履歴の先頭に置くのは、ビューアーで開く操作。本に読み込み済みの
  // 話が増えただけのときは、時刻を付け直さない。
  const bookId = book?.id;
  useFocusEffect(
    useCallback(() => {
      if (bookId) {
        markOpened(bookId);
      }
    }, [bookId, markOpened]),
  );

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
