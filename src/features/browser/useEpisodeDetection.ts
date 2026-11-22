import { useRef, useState, type RefObject } from "react";
import type { WebView } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview/lib/WebViewTypes";

import {
  episodeDataUrl,
  mayBeEpisodeUrl,
  parseEpisode,
  parseToc,
  readsEpisodeFromPage,
  tocUrlOf,
  type WebEpisode,
  type WorkToc,
} from "@/features/web/episode";

const sendPageHtml =
  "window.ReactNativeWebView.postMessage(document.documentElement.outerHTML); true;";

const sendToc = (url: string) =>
  `fetch(${JSON.stringify(url)})` +
  ".then((response) => response.text())" +
  ".then((html) => window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'toc', html })))" +
  ".catch(() => {}); true;";

const sendEpisodeData = (pageUrl: string) =>
  `fetch(${JSON.stringify(episodeDataUrl(pageUrl))})` +
  ".then((response) => response.text())" +
  `.then((text) => window.ReactNativeWebView.postMessage(JSON.stringify({ kind: 'episode', url: ${JSON.stringify(pageUrl)}, text })))` +
  ".catch(() => {}); true;";

type PageMessage =
  | { kind: "toc"; html: string }
  | { kind: "episode"; url: string; text: string };

function taggedMessage(data: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(data);
    return typeof value === "object" && value !== null ? { ...value } : null;
  } catch {
    return null;
  }
}

function readMessage(data: string, pageUrl: string): PageMessage | null {
  const tagged = taggedMessage(data);
  if (tagged?.kind === "toc" && typeof tagged.html === "string") {
    return { kind: "toc", html: tagged.html };
  }
  if (tagged?.kind === "episode") {
    return typeof tagged.url === "string" && typeof tagged.text === "string"
      ? { kind: "episode", url: tagged.url, text: tagged.text }
      : null;
  }
  return mayBeEpisodeUrl(pageUrl) && readsEpisodeFromPage(pageUrl)
    ? { kind: "episode", url: pageUrl, text: data }
    : null;
}

function episodeIn(text: string, pageUrl: string): WebEpisode | null {
  try {
    return parseEpisode(text, pageUrl);
  } catch {
    return null;
  }
}

type Browser = RefObject<WebView<object> | null>;

interface TocRequest {
  ask: (tocUrl: string | null) => void;
  read: (html: string, expectedUrl: string | null) => WorkToc | null;
}

function useTocRequest(webView: Browser): TocRequest {
  const tocUrlRef = useRef<string | null>(null);
  return {
    ask(tocUrl) {
      if (tocUrl) {
        tocUrlRef.current = tocUrl;
        webView.current?.injectJavaScript(sendToc(tocUrl));
      }
    },
    read(html, expectedUrl) {
      const url = tocUrlRef.current;
      return url && url === expectedUrl ? parseToc(html, url) : null;
    },
  };
}

function useEpisodeDataRequest(
  webView: Browser,
): (url: string, loading: boolean) => void {
  const [askedFor, setAskedFor] = useState<string | null>(null);
  return (url, loading) => {
    if (loading || readsEpisodeFromPage(url) || url === askedFor) {
      return;
    }
    setAskedFor(url);
    webView.current?.injectJavaScript(sendEpisodeData(url));
  };
}

interface EpisodeDetection {
  episode: WebEpisode | null;
  onLoad: (url: string) => void;
  onNavigate: (url: string, loading: boolean) => void;
  onMessage: (event: WebViewMessageEvent) => void;
}

export function useEpisodeDetection(
  webView: Browser,
  pageUrl: string,
): EpisodeDetection {
  const [episode, setEpisode] = useState<WebEpisode | null>(null);
  const tocRequest = useTocRequest(webView);
  const onNavigate = useEpisodeDataRequest(webView);

  function onLoad(url: string): void {
    if (!mayBeEpisodeUrl(url) || !readsEpisodeFromPage(url)) {
      return;
    }
    webView.current?.injectJavaScript(sendPageHtml);
    tocRequest.ask(tocUrlOf(url));
  }

  function onEpisode(text: string): void {
    const found = episodeIn(text, pageUrl);
    setEpisode(found);
    if (found && !readsEpisodeFromPage(pageUrl)) {
      tocRequest.ask(tocUrlOf(pageUrl, found.workId));
    }
  }

  function onToc(html: string): void {
    const toc = tocRequest.read(html, tocUrlOf(pageUrl, episode?.workId));
    if (toc) {
      setEpisode((current) =>
        current?.url === pageUrl ? { ...current, toc } : current,
      );
    }
  }

  function onMessage({ nativeEvent }: WebViewMessageEvent): void {
    // WORKAROUND: Android のメッセージイベントにはオリジンしかない（WebMessageListener の sourceOrigin）。ページはナビゲーションの URL で特定し、古いメッセージを捨てる。
    if (!pageUrl.startsWith(nativeEvent.url.replace(/\/$/, ""))) {
      return;
    }
    const message = readMessage(nativeEvent.data, pageUrl);
    if (message?.kind === "toc") {
      onToc(message.html);
    } else if (message?.url === pageUrl) {
      onEpisode(message.text);
    }
  }

  return {
    episode: episode?.url === pageUrl ? episode : null,
    onLoad,
    onNavigate,
    onMessage,
  };
}
