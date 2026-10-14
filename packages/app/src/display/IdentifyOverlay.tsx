import { useEffect, useState } from "react";

export const IDENTIFY_MS = 5000;

interface Props {
  request: { label: string; at: number } | null;
}

// Flashes the display's name over its screen so the crew can find it on set.
export const IdentifyOverlay = ({ request }: Props) => {
  const [visible, setVisible] = useState<{ label: string; at: number } | null>(null);

  useEffect(() => {
    if (!request) return;
    setVisible(request);
    const timer = setTimeout(() => setVisible(null), IDENTIFY_MS);
    return () => clearTimeout(timer);
  }, [request]);

  if (!visible) return null;
  return (
    <div className="identify-overlay" role="alert" key={visible.at}>
      <p className="identify-overlay__label">{visible.label}</p>
    </div>
  );
};
