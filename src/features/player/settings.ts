import {
  toBracketVoices,
  type BracketVoices,
} from "@/features/speech/brackets";
import { isPitch, isRate } from "@/features/speech/voiceLimits";
import type { SavedPlayback } from "./storage";

export interface PlaybackSettings {
  rate: number;
  pitch: number;
  voice?: string;
  brackets: BracketVoices;
  keepAwake: boolean;
  pageSound: boolean;
  autoNext: boolean;
  authorNotes: boolean;
}

export function initialSettings(saved: SavedPlayback | null): PlaybackSettings {
  return {
    rate: isRate(saved?.rate) ? saved.rate : 1,
    pitch: isPitch(saved?.pitch) ? saved.pitch : 1,
    voice: typeof saved?.voice === "string" ? saved.voice : undefined,
    brackets: toBracketVoices(saved?.brackets),
    keepAwake: saved?.keepAwake === true,
    pageSound: saved?.pageSound !== false,
    autoNext: saved?.autoNext !== false,
    authorNotes: saved?.authorNotes === true,
  };
}
