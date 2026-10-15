import type { Screen } from "@interactive-displays/core";
import { useEffect, useState } from "react";
import { api } from "./api.ts";

export interface ScreenRef {
  id: string;
  revision: number;
  source: "draft" | "published";
}

const keyOf = (ref: ScreenRef) => `${ref.source}:${ref.id}@${ref.revision}`;

// Fetches screen documents for thumbnails, once per revision: the overview says which revision is current,
// so a document is only downloaded again after it changed.
export const useScreenDocs = (refs: readonly ScreenRef[]): ((ref: ScreenRef | undefined) => Screen | undefined) => {
  const [docs, setDocs] = useState<ReadonlyMap<string, Screen>>(new Map());
  const wanted = refs.map(keyOf).sort().join("|");

  useEffect(() => {
    let active = true;
    const missing = refs.filter((ref) => !docs.has(keyOf(ref)));
    if (missing.length === 0) return;
    void Promise.all(
      missing.map(async (ref) => {
        const path = ref.source === "published" ? `/api/screens/${ref.id}/published` : `/api/screens/${ref.id}`;
        const result = await api<{ screen: Screen }>("GET", path);
        return result.ok ? ([keyOf(ref), result.data.screen] as const) : undefined;
      }),
    ).then((loaded) => {
      if (!active) return;
      setDocs((current) => {
        const next = new Map(current);
        for (const entry of loaded) if (entry) next.set(entry[0], entry[1]);
        return next;
      });
    });
    return () => {
      active = false;
    };
    // `wanted` stands for `refs`; `docs` is read, not followed, so a load does not trigger another.
  }, [wanted]);

  return (ref) => (ref ? docs.get(keyOf(ref)) : undefined);
};
