import { PROTOCOL_VERSION, resolveScreenId, type ShowOverview } from "@interactive-displays/core";
import { videoIds } from "./press.ts";
import type { ShowService } from "./showService.ts";

// The operator console's and editor's view of the show: every screen with its publish state, and every display
// the show knows, has seen or has connected, with what it shows right now.
export const buildOverview = (service: ShowService, connected: ReadonlySet<string>): ShowOverview | null => {
  const loaded = service.loaded();
  if (!loaded) return null;
  const { show, screens, runtime } = loaded;
  const previews = service.previews();
  const ids = new Set([...show.displays.map((display) => display.id), ...Object.keys(runtime.seen), ...connected]);

  return {
    protocol: PROTOCOL_VERSION,
    show,
    state: service.state(),
    signals: service.signalValues(),
    screens: [...screens.values()]
      .map(({ id, name, section, tags, profile, revision, published }) => ({
        id,
        name,
        tags,
        profile,
        revision,
        published: published ?? null,
        ...(section ? { section } : {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    displays: [...ids].sort().map((id) => {
      const definition = show.displays.find((display) => display.id === id);
      const navigated = service.navigated(id);
      return {
        id,
        ...(definition?.name ? { name: definition.name } : {}),
        ...(definition?.screen ? { assigned: definition.screen } : {}),
        showing: navigated ?? resolveScreenId(show, id) ?? null,
        preview: previews.get(id) ?? null,
        navigated,
        videos: videoIds(service.screenForDisplay(id).screen),
        connected: connected.has(id),
        lastSeen: runtime.seen[id] ?? null,
      };
    }),
  };
};
