import { useCallback, useRef, useState } from "react";

export interface Preview {
  voice?: string;
  pitch?: number;
}

interface PreviewState {
  preview: Preview | null;
  previewError: string | null;
  setPreviewError: (message: string | null) => void;
  startPreview: (preview: Preview) => void;
  stopPreview: () => void;
}

export function usePreview(invalidate: () => void): PreviewState {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
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
