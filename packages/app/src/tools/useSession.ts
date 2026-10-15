import { useEffect, useState } from "react";
import { api } from "./api.ts";

export interface Session {
  tokenRequired: boolean;
  tokenValid: boolean;
  publicUrl: string | null;
  // The built-in Fill with AI, when the server has an API key.
  ai?: { model: string } | null;
}

// What the server says about this browser: does it need the editor token, and is the one it has right.
export const useSession = (attempt: number): Session | null => {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    let active = true;
    void api<Session>("GET", "/api/session").then((result) => {
      if (active) setSession(result.ok ? result.data : { tokenRequired: false, tokenValid: true, publicUrl: null });
    });
    return () => {
      active = false;
    };
  }, [attempt]);
  return session;
};

// The address displays and tablets should use: PUBLIC_URL when the server has one, else this page's origin.
export const publicOrigin = (session: Session | null): string => session?.publicUrl ?? window.location.origin;
