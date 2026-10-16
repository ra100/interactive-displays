// The editor token, when the server has one, is kept in this browser so the crew types it once.
const KEY = "interactive-displays.editorToken";

export const readToken = (): string | undefined => {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
};

export const saveToken = (token: string | null): void => {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode: the token lasts until the page closes.
  }
};

// A link with ?token=… (such as the operator QR code) stores the token, then drops it from the address bar.
export const takeTokenFromUrl = (): void => {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("token");
  if (!token) return;
  saveToken(token);
  url.searchParams.delete("token");
  window.history.replaceState(window.history.state, "", url);
};
