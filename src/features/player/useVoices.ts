import { useCallback, useRef, useState } from "react";
import * as Speech from "expo-speech";

interface Voices {
  /** 端末の日本語の声。読み込みが済むと入る。 */
  voices: Speech.Voice[];
  voiceLoading: boolean;
  voiceError: string | null;
  loadVoices: () => void;
}

/** 端末の日本語の声。求められたときに読み込む。 */
export function useVoices(): Voices {
  const [voices, setVoices] = useState<Speech.Voice[]>([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceRequest = useRef(0);
  const loadVoices = useCallback(() => {
    const request = ++voiceRequest.current;
    setVoiceLoading(true);
    setVoiceError(null);
    Speech.getAvailableVoicesAsync()
      .then((available) => {
        if (request === voiceRequest.current) {
          setVoices(
            available.filter((voice) => /^ja(?:-|_|$)/i.test(voice.language)),
          );
        }
      })
      .catch(() => {
        if (request === voiceRequest.current) {
          setVoiceError(
            "音声一覧を取得できませんでした。端末標準の音声は利用できます。",
          );
        }
      })
      .finally(() => {
        if (request === voiceRequest.current) {
          setVoiceLoading(false);
        }
      });
  }, []);
  return { voices, voiceLoading, voiceError, loadVoices };
}
