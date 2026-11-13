import { useRef, useState, type RefObject } from "react";
import type { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview/lib/WebViewTypes";

import {
  mayBeEpisodeUrl,
  parseEpisode,
  parseToc,
  tocUrlOf,
  type WebEpisode,
} from "@/features/web/episode";

// 話の URL が読み込まれた後にページの中で実行する。HTML はネイティブ側で
// 解析するので、ページは追加のリクエストを出さず、利用者の Cookie も保たれる。
const sendPageHtml =
  "window.ReactNativeWebView.postMessage(document.documentElement.outerHTML); true;";

// 作品の目次をページの中から先に取得する（同一オリジンの fetch なので
// Cookie が付く）。話数に関係なく、タグ付きのメッセージ 1 つで送る。
// 話の本文をここで取得することはない。
const sendToc = (url: string) =>
  `fetch(${JSON.stringify(url)})` +
  ".then((response) => response.text())" +
  ".then((html) => window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'toc', html })))" +
  ".catch(() => {}); true;";

interface EpisodeDetection {
  /** 表示中のページにある話。HTML の解析が済むと入る。 */
  episode: WebEpisode | null;
  /** ページの読み込みが終わったら呼ぶ: 話のページに HTML を求める。 */
  onLoad: (url: string) => void;
  onMessage: (event: WebViewMessageEvent) => void;
}

/** アプリ内ブラウザが表示しているページから、対応している話を検出する。 */
export function useEpisodeDetection(
  webView: RefObject<WebView<object> | null>,
  pageUrl: string,
): EpisodeDetection {
  const tocUrlRef = useRef<string | null>(null);
  const [episode, setEpisode] = useState<WebEpisode | null>(null);

  function onLoad(url: string): void {
    if (!mayBeEpisodeUrl(url)) {
      return;
    }
    webView.current?.injectJavaScript(sendPageHtml);
    const tocUrl = tocUrlOf(url);
    if (tocUrl) {
      tocUrlRef.current = tocUrl;
      webView.current?.injectJavaScript(sendToc(tocUrl));
    }
  }

  function onMessage({ nativeEvent }: WebViewMessageEvent): void {
    // ページを特定するのは nativeEvent.url ではなく、ナビゲーションの URL:
    // Android のメッセージイベントにはオリジンしかなく（WebMessageListener の
    // sourceOrigin）、iOS には完全な URL がある。イベントの URL が追跡中の
    // ページとまだ一致することを求め、古いメッセージを捨てる。
    if (!pageUrl.startsWith(nativeEvent.url.replace(/\/$/, ""))) {
      return;
    }
    let tagged: { kind?: string; html?: string } | undefined;
    try {
      tagged = JSON.parse(nativeEvent.data);
    } catch {
      // 話のページの HTML は JSON ではない。下でページの HTML として扱う。
    }
    if (tagged?.kind === "toc" && typeof tagged.html === "string") {
      const url = tocUrlRef.current;
      if (url && url === tocUrlOf(pageUrl)) {
        const toc = parseToc(tagged.html, url);
        setEpisode((current) =>
          current?.url === pageUrl ? { ...current, toc } : current,
        );
      }
      return;
    }
    if (!mayBeEpisodeUrl(pageUrl)) {
      return;
    }
    try {
      setEpisode(parseEpisode(nativeEvent.data, pageUrl));
    } catch {
      setEpisode(null);
    }
  }

  return {
    episode: episode?.url === pageUrl ? episode : null,
    onLoad,
    onMessage,
  };
}
