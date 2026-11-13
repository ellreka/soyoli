import { useRef, useState } from "react";

/**
 * どの発話が今のものか。読み上げは非同期: エンジンは発話が終わったときに
 * コールバックするが、そのころには読者が先へ進んでいるかもしれない。
 * そこで、話す内容を変えるものはすべて新しい世代を始め、発話は自分が
 * 始まったときの世代を覚えておき、古い世代へのコールバックは無視する。
 */
export interface Generation {
  /** 新しい世代を始め、そのトークンを返す。 */
  begin: () => number;
  /** `token` 以降、話す内容を変えるものが何もなかったかどうか。 */
  isCurrent: (token: number) => boolean;
}

export function useGeneration(): Generation {
  const count = useRef(0);
  // コンポーネントが生きている間ずっと同じオブジェクト: effect が依存できる。
  const [generation] = useState<Generation>(() => ({
    begin: () => {
      count.current += 1;
      return count.current;
    },
    isCurrent: (token) => count.current === token,
  }));
  return generation;
}
