import { encode } from "uqr";
import { useMemo } from "react";

// A QR code drawn as one SVG path, so a tablet can join by scanning the screen.
export const QrCode = ({ value, label }: { value: string; label: string }) => {
  const { path, size } = useMemo(() => {
    const qr = encode(value, { ecc: "M", border: 2 });
    let d = "";
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { path: d, size: qr.size };
  }, [value]);

  return (
    <figure className="qr">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`QR code for ${label}`} shapeRendering="crispEdges">
        <rect width={size} height={size} fill="#fff" />
        <path d={path} fill="#000" />
      </svg>
      <figcaption className="qr__caption">{value}</figcaption>
    </figure>
  );
};
