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

const sendPageHtml =
  "window.ReactNativeWebView.postMessage(document.documentElement.outerHTML); true;";

const sendToc = (url: string) =>
  `fetch(${JSON.stringify(url)})` +
  ".then((response) => response.text())" +
  ".then((html) => window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'toc', html })))" +
  ".catch(() => {}); true;";

interface EpisodeDetection {
  episode: WebEpisode | null;
  onLoad: (url: string) => void;
  onMessage: (event: WebViewMessageEvent) => void;
}

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
    // WORKAROUND: Android のメッセージイベントにはオリジンしかない（WebMessageListener の sourceOrigin）。ページはナビゲーションの URL で特定し、古いメッセージを捨てる。
    if (!pageUrl.startsWith(nativeEvent.url.replace(/\/$/, ""))) {
      return;
    }
    let tagged: { kind?: string; html?: string } | undefined;
    try {
      tagged = JSON.parse(nativeEvent.data);
    } catch {}
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
