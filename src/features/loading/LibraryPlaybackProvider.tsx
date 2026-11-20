import type { ReactNode } from "react";

import { useLibrary } from "@/features/library/Library";
import { PlaybackProvider } from "@/features/player/Playback";

export function LibraryPlaybackProvider({ children }: { children: ReactNode }) {
  const { markRead, bookById } = useLibrary();
  return (
    <PlaybackProvider onChapterRead={markRead} findBook={bookById}>
      {children}
    </PlaybackProvider>
  );
}
