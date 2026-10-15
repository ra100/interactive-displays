import type { ContentPack } from "@interactive-displays/core";
import { useEffect, useState } from "react";
import { api } from "../tools/api.ts";

// The content packs the server generates from (built in, plus the show's own recipes and blocks). Empty until
// they arrive, or when the server cannot send them, so generation features simply do not show.
export const usePacks = (): readonly ContentPack[] => {
  const [packs, setPacks] = useState<readonly ContentPack[]>([]);
  useEffect(() => {
    let current = true;
    void api<{ packs: ContentPack[] }>("GET", "/api/content").then((result) => {
      if (current && result.ok) setPacks(result.data.packs);
    });
    return () => {
      current = false;
    };
  }, []);
  return packs;
};
