import { useCallback, useRef, useState } from "react";

/** 試聴中の声: 声と、基本の高さでなければその高さ。 */
export interface Preview {
  voice?: string;
  pitch?: number;
}

interface PreviewState {
  /** 再生中の試聴。ない間は null。 */
  preview: Preview | null;
  previewError: string | null;
  setPreviewError: (message: string | null) => void;
  startPreview: (preview: Preview) => void;
  /** 試聴が再生中なら、終わらせる。 */
  stopPreview: () => void;
}

/**
 * 設定での声の試聴。試聴と本文は 1 つの音声エンジンを共有するので、試聴が
 * 終わるときに `invalidate` を呼ぶ: それまで話していたものは、もう結果を
 * 返してこなくなる（`useReadAloud` を参照）。
 */
export function usePreview(invalidate: () => void): PreviewState {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  // state の横に持つ: 試聴は、それを終わらせる変更と同時に、React が
  // どちらも render する前に終わらせる。
  const active = useRef(false);

  const stopPreview = useCallback(() => {
    if (active.current) {
      invalidate();
      active.current = false;
      setPreview(null);
    }
  }, [invalidate]);
  const startPreview = useCallback((value: Preview) => {
    setPreviewError(null);
    active.current = true;
    setPreview(value);
  }, []);

  return { preview, previewError, setPreviewError, startPreview, stopPreview };
}
