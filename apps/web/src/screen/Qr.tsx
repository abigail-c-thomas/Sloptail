import { useMemo } from "react";
import qrcode from "qrcode-generator";

/** A QR code as one SVG path, drawn in the current text colour so it follows the theme. */
export function Qr({ text, className }: { text: string; className?: string }) {
  const { size, path } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { size: n, path: d };
  }, [text]);
  // Four-module quiet zone, as the spec asks, so phones lock on from across a room.
  return (
    <svg className={className} viewBox={`-4 -4 ${size + 8} ${size + 8}`} role="img" aria-label={text} shapeRendering="crispEdges">
      <rect x={-4} y={-4} width={size + 8} height={size + 8} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
