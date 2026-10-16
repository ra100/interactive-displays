import type { ScreenSummary } from "@interactive-displays/core";

export interface PublishStatus {
  label: string;
  tone: "success" | "warning" | "info";
  // True when the draft differs from what displays show.
  changed: boolean;
}

// How a draft relates to what is on air, in the words the library and the editor use.
export const publishStatus = (screen: Pick<ScreenSummary, "revision" | "published">): PublishStatus => {
  if (screen.published === null) return { label: "Never published", tone: "warning", changed: true };
  if (screen.published !== screen.revision) return { label: "Unpublished changes", tone: "info", changed: true };
  return { label: "Published", tone: "success", changed: false };
};
