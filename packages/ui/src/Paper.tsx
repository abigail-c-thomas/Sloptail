import { useMemo, type CSSProperties } from "react";
import { isBlack, type Bitmap, type PrintDocument, type Span } from "@sloptail/printer";

/**
 * Draws a PrintDocument the way the receipt printer will: same lines, same
 * character cells, same magnification, measured in printer dots and scaled to
 * the element's width. Paper is paper-coloured in dark mode too.
 */
export function Paper({ doc, className }: { doc: PrintDocument; className?: string }) {
  const { paper } = doc;
  const rows = doc.lines();
  // A trailing cut is just the end of the ticket.
  if (rows.at(-1)?.kind === "cut") rows.pop();
  const margin = (paper.paperDots - paper.dots) / 2;
  return (
    <div className={`paper ${className ?? ""}`}>
      <div className="paper-sheet" style={{ "--paper-dots": paper.paperDots, "--margin": margin } as CSSProperties}>
        {rows.map((row, i) =>
          row.kind === "cut" ? (
            <div key={i} className="paper-cut" />
          ) : row.kind === "image" ? (
            <div key={i} className={`paper-line align-${row.align}`} style={{ "--h": row.bitmap.height } as CSSProperties}>
              <BitmapView bitmap={row.bitmap} />
            </div>
          ) : (
            <div key={i} className={`paper-line align-${row.align}`} style={{ "--h": row.height } as CSSProperties}>
              {row.spans.map((span, j) => (
                <SpanView key={j} span={span} cell={paper.cell[span.style.font]} />
              ))}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

/** Dot for dot: one canvas pixel per printer dot, scaled up without smoothing. */
function BitmapView({ bitmap }: { bitmap: Bitmap }) {
  const src = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(bitmap.width, bitmap.height);
    for (let y = 0; y < bitmap.height; y++) {
      for (let x = 0; x < bitmap.width; x++) {
        // Transparent where the paper shows through, ink where it's black.
        if (isBlack(bitmap, x, y)) img.data[(y * bitmap.width + x) * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }, [bitmap]);
  return <img className="paper-image" src={src} alt="" style={{ "--iw": bitmap.width, "--ih": bitmap.height } as CSSProperties} />;
}

function SpanView({ span, cell }: { span: Span; cell: { w: number; h: number } }) {
  const { text, style } = span;
  const vars = {
    "--cw": cell.w,
    "--ch": cell.h,
    "--sx": style.width,
    "--sy": style.height,
    "--n": text.length,
  } as CSSProperties;
  const cls = ["paper-span", style.em && "em", style.ul && "ul", style.reverse && "rev", style.font === "font_b" && "small"].filter(Boolean).join(" ");
  return (
    <span className={cls} style={vars}>
      <span className="paper-glyphs">{text}</span>
    </span>
  );
}
