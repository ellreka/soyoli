import { useRef, useState } from "react";

export interface Generation {
  begin: () => number;
  isCurrent: (token: number) => boolean;
}

export function useGeneration(): Generation {
  const count = useRef(0);
  const [generation] = useState<Generation>(() => ({
    begin: () => {
      count.current += 1;
      return count.current;
    },
    isCurrent: (token) => count.current === token,
  }));
  return generation;
}
