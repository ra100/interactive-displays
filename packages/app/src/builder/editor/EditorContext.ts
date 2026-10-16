import type { AssetInfo, Op, Screen, ShowOverview } from "@interactive-displays/core";
import { createContext, useContext } from "react";
import type { SignalStore } from "../../runtime/live.ts";
import type { Selection } from "./editing.ts";

// What every editor panel shares: the screen as it is now, the selection, how to change both, and how the
// preview is set up.
export interface EditorContextValue {
  overview: ShowOverview;
  screen: Screen;
  selection: Selection;
  select: (selection: Selection) => void;
  apply: (ops: Op[]) => boolean;
  // How the preview renders; in any state but the first, the inspector can edit that state only.
  preview: { state: string; themeId: string; variant: string | undefined };
  assets: AssetInfo[];
  refreshAssets: () => void;
  // Shared signal values from the server, so the preview moves like the displays do.
  signals: SignalStore;
  notify: (message: string, tone?: "info" | "danger") => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export const EditorProvider = EditorContext.Provider;

export const useEditor = (): EditorContextValue => {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditor needs an EditorProvider");
  return value;
};
