import type { CSSProperties } from "react";
import type { PrintDocument, Span } from "@sloptail/printer";

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
