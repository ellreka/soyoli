import { router, useFocusEffect } from "expo-router";
import { NativeButton } from "@/components/NativeButton";
import { NativeTextField } from "@/components/NativeTextField";
import { useCallback, useRef, useState } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type {
  ShouldStartLoadRequest,
  WebViewNavigation,
} from "react-native-webview/lib/WebViewTypes";

import { Icon } from "@/components/Icon";
import { IconButton } from "@/components/IconButton";
import { colors } from "@/constants/theme";
import { useLibrary } from "@/features/library/Library";
import { usePlayback } from "@/features/player/Playback";
import {
  canLoadInBrowser,
  displayUrl,
  isSecureUrl,
  resolveAddress,
} from "@/features/web/browser";
import { episodeToBook, type WebEpisode } from "@/features/web/episode";
import { EpisodeCard } from "./EpisodeCard";
import { useEpisodeDetection } from "./useEpisodeDetection";

interface AddressBarProps {
  url: string;
  onSubmit: (url: string) => void;
}

/** ページのホストとパスを表示する。フォーカスすると完全な URL を編集できる。 */
function AddressBar({ url, onSubmit }: AddressBarProps) {
  const [editing, setEditing] = useState(false);
  return (
    <View style={styles.address}>
      {!editing && isSecureUrl(url) && (
        <Icon name="lock" size={11} color={colors.secondary} />
      )}
      <NativeTextField
        // フィールドは自分で文字列を持つ。新しいページでは新しいフィールドにする。
        key={url}
        accessibilityLabel={`表示中のページ ${url}`}
        defaultValue={displayUrl(url)}
        keyboardType="url"
        returnKeyType="go"
        onFocus={() => {
          setEditing(true);
        }}
        onBlur={() => {
          setEditing(false);
        }}
        onSubmit={(text) => {
          const target = resolveAddress(text);
          if (target && canLoadInBrowser(target)) {
            onSubmit(target);
          }
        }}
      />
    </View>
  );
}

interface PageState {
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
  loading: boolean;
}

interface BrowserViewProps {
  startUrl: string;
  onClose: () => void;
}

/**
 * Web 小説サイト用の、全画面のアプリ内ブラウザ（§4.10）。ネイティブのみ。
 * どの入口（ホーム、リーダー、…）からも、この同じ画面が開く。ミニプレーヤーは
 * 下のバーの上に載る。ほかの場所でタブバーの上に載るのと同じ。
 */
export function BrowserView({ startUrl, onClose }: BrowserViewProps) {
  const webView = useRef<WebView<object>>(null);
  const [page, setPage] = useState<PageState>({
    url: startUrl,
    canGoBack: false,
    canGoForward: false,
    loading: true,
  });
  const [progress, setProgress] = useState(0);
  // クラッシュした Web コンテンツのプロセスは使い回せない。最後の URL で再マウントする。
  const [instance, setInstance] = useState({ key: 0, url: startUrl });
  const detection = useEpisodeDetection(webView, page.url);
  const { addBook, isBookmarked, setBookmarked } = useLibrary();
  const { openBook, settings } = usePlayback();
  const { canGoBack } = page;

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          if (canGoBack) {
            webView.current?.goBack();
          } else {
            onClose();
          }
          return true;
        },
      );
      return () => {
        subscription.remove();
      };
    }, [canGoBack, onClose]),
  );

  function load(url: string) {
    setInstance(({ key }) => ({ key: key + 1, url }));
  }

  function remount() {
    load(page.url);
  }

  function toBook(target: WebEpisode) {
    return episodeToBook(
      target,
      target.toc ?? { entries: [] },
      settings.authorNotes,
    );
  }

  // 読んでも作品は本棚に入らない。入れるのはブックマークボタン。
  function openInReader(target: WebEpisode) {
    const book = toBook(target);
    addBook(book);
    // 以前に読みかけた位置ではなく、ページにある話で開く。
    openBook(book, { chapterId: target.episodeId });
    router.push({ pathname: "/reader", params: { id: book.id } });
  }

  function onNavigationStateChange(event: WebViewNavigation) {
    setPage({
      url: event.url,
      canGoBack: event.canGoBack,
      canGoForward: event.canGoForward,
      loading: event.loading,
    });
  }

  const { episode } = detection;
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      {/* ブラウザに必要なものは、すべてこの 1 本のバーにある: タブバーと
      ミニプレーヤーがページの下にあり、そこにブラウザ自身のバーを
      もう 1 本置くと、ページがほとんど残らない。 */}
      <View style={styles.bar}>
        <IconButton icon="x" label="ブラウザを閉じる" onPress={onClose} />
        <IconButton
          icon="chevron-left"
          label="戻る"
          disabled={!canGoBack}
          onPress={() => webView.current?.goBack()}
        />
        <IconButton
          icon="chevron-right"
          label="進む"
          disabled={!page.canGoForward}
          onPress={() => webView.current?.goForward()}
        />
        <AddressBar url={page.url} onSubmit={load} />
        {page.loading ? (
          <IconButton
            icon="x"
            label="読み込みを中止"
            size={18}
            onPress={() => webView.current?.stopLoading()}
          />
        ) : (
          <IconButton
            icon="rotate-cw"
            label="再読み込み"
            size={18}
            onPress={() => webView.current?.reload()}
          />
        )}
      </View>
      <View style={styles.progressTrack}>
        {page.loading && (
          <View
            style={[
              styles.progressBar,
              { width: `${Math.max(progress, 0.05) * 100}%` },
            ]}
          />
        )}
      </View>
      <View style={styles.page}>
        {/* 同梱のクラスの型は、型引数がないと props を never に潰してしまう。 */}
        <WebView<object>
          key={instance.key}
          ref={webView}
          source={{ uri: instance.url }}
          style={styles.webView}
          // すべての URL が onShouldStartLoadWithRequest に届くようにする。既定の
          // ホワイトリストだと、Web でないスキームがほかのアプリで開いてしまう。
          originWhitelist={["*"]}
          onShouldStartLoadWithRequest={(request: ShouldStartLoadRequest) =>
            canLoadInBrowser(request.url)
          }
          onNavigationStateChange={onNavigationStateChange}
          onLoad={({ nativeEvent }) => {
            detection.onLoad(nativeEvent.url);
          }}
          onMessage={detection.onMessage}
          onLoadProgress={({ nativeEvent }) => {
            setProgress(nativeEvent.progress);
          }}
          setSupportMultipleWindows={false}
          // iOS は WebView の Cookie を、アプリ自身のリクエストとは別に持つ。
          // 共有しておけば、リーダーが後で取得する話にも、読者がページで答えた
          // 内容（たとえばサイトの年齢確認）が付く。Android ではもともと
          // そうなっている。
          sharedCookiesEnabled
          allowsBackForwardNavigationGestures
          // "normal"/"fast" の文字列は、Android の新アーキテクチャのビュー
          // マネージャーを落とす（prop がただの double）。0.998 は ScrollView の "normal"。
          decelerationRate={0.998}
          onContentProcessDidTerminate={remount}
          onRenderProcessGone={remount}
          renderError={(_domain, _code, description) => (
            <View style={styles.error}>
              <Text accessibilityRole="alert" style={styles.errorTitle}>
                ページを表示できませんでした
              </Text>
              <Text style={styles.errorDescription}>{description}</Text>
              <NativeButton
                label="再試行"
                variant="outlined"
                onPress={() => webView.current?.reload()}
              />
            </View>
          )}
        />
        {episode && !page.loading && (
          <EpisodeCard
            episode={episode}
            bookmarked={isBookmarked(toBook(episode).id)}
            onBookmark={(on) => {
              setBookmarked(toBook(episode), on);
            }}
            onOpen={() => {
              openInReader(episode);
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  // Web ページと、その下端に浮かぶエピソードカードを入れる。
  page: { flex: 1 },
  bar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  address: {
    flex: 1,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginRight: 8,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  progressTrack: { height: 2 },
  progressBar: { height: 2, backgroundColor: colors.text },
  webView: { flex: 1, backgroundColor: colors.background },
  error: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
    backgroundColor: colors.background,
  },
  errorTitle: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 16,
  },
  errorDescription: {
    color: colors.secondary,
    fontWeight: "400",
    fontSize: 13,
    textAlign: "center",
  },
});
