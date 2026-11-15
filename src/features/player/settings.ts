import {
  toBracketVoices,
  type BracketVoices,
} from "@/features/speech/brackets";
import { isPitch, isRate } from "@/features/speech/voiceLimits";
import type { SavedPlayback } from "./storage";

/**
 * 作品をどう読み上げるか: 全作品に共通の 1 組で、起動をまたいで保存する。
 *
 * 最初の 4 つは声を形作るので、どれかを変えると読み上げ中の段落を
 * やり直す。残りは読み上げの周りの設定で、変えてもやり直してはならない。
 */
export interface PlaybackSettings {
  rate: number;
  pitch: number;
  /** 端末の声。なければ端末の既定の声。 */
  voice?: string;
  /** 中身を専用の声で読むカッコ。 */
  brackets: BracketVoices;
  /** 読み上げ中、画面を点けたままにする。 */
  keepAwake: boolean;
  /** 別の章へ読み進めたときに、ページめくりの音を鳴らす。 */
  pageSound: boolean;
  /** 話を読み終えたら、次の話を続けて読む。 */
  autoNext: boolean;
  /** Web 小説の前書きと後書きも、本文と一緒に出して読む。 */
  authorNotes: boolean;
}

/** 前回のセッションが残した設定。残していないものは既定値。 */
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
