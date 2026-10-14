import { IdSchema } from "@interactive-displays/core";

const STORAGE_KEY = "interactive-displays.displayId";

// getRandomValues works on plain-http LAN addresses, unlike crypto.randomUUID.
export const createDisplayId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  return `d-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
};

const readStoredId = (): string | undefined => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && IdSchema.safeParse(stored).success ? stored : undefined;
  } catch {
    return undefined;
  }
};

export const rememberDisplayId = (id: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Storage can be unavailable (private mode, kiosk policies); the URL still identifies the display.
  }
};

// A browser keeps its display id across reloads so the operator's assignment sticks.
export const getOrCreateDisplayId = (): string => {
  const stored = readStoredId();
  if (stored) return stored;
  const id = createDisplayId();
  rememberDisplayId(id);
  return id;
};
