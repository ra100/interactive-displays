import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

const TOAST_MS = 4000;

// One short message at a time, for results and errors of crew actions.
export const useToast = (): { element: ReactNode; show: (message: string, tone?: "info" | "danger") => void } => {
  const [toast, setToast] = useState<{ message: string; tone: "info" | "danger"; at: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((message: string, tone: "info" | "danger" = "info") => {
    setToast({ message, tone, at: Date.now() });
  }, []);

  useEffect(() => {
    if (!toast) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer.current);
  }, [toast]);

  const element = toast ? (
    <div className="toast" role={toast.tone === "danger" ? "alert" : "status"} data-tone={toast.tone}>
      {toast.message}
    </div>
  ) : null;
  return { element, show };
};
