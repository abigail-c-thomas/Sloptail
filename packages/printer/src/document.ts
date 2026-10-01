import { bitmapBase64, isBlack, type Bitmap } from "./bitmap.ts";

/**
 * A print job for an Epson ePOS-Print printer. Knows nothing about cocktails:
 * it's a small builder over the subset of ePOS-Print that a receipt needs.
 *
 * The document is kept as a list of operations, and everything else is a
 * rendering of that list: `toXml()` for the printer, `lines()` for anything
 * that wants to draw it (the web UI renders the same tickets from this), and
 * `toText()` for a quick look in a terminal.
 *
 * ePOS <text> attributes are sticky on the printer (a `width="2"` stays on
 * until something turns it off), which makes raw documents order-dependent
 * and easy to break. So every text run here carries its full style, and the
 * XML only sets the attributes that changed since the last run.
 */

export type Font = "font_a" | "font_b";
export type Align = "left" | "center" | "right";

export interface TextStyle {
  font?: Font;
  /** Character magnification, 1-8. */
  width?: number;
  height?: number;
  em?: boolean;
  ul?: boolean;
  reverse?: boolean;
  align?: Align;
}

export type ResolvedStyle = Required<TextStyle>;

/**
 * Printer geometry in dots. TM-T88 on 80mm paper: 576 dots across, 512 of
 * them printable; font A cells are 12x24 (42 per line), font B 9x17 (56).
 * Default line spacing is 1/6" = 30 dots.
 */
export interface PaperSpec {
  paperDots: number;
  dots: number;
  cell: Record<Font, { w: number; h: number }>;
  lineSpacing: number;
}

export const PAPER_80MM: PaperSpec = {
  paperDots: 576,
  dots: 512,
  cell: { font_a: { w: 12, h: 24 }, font_b: { w: 9, h: 17 } },
  lineSpacing: 30,
};

export const DEFAULT_STYLE: ResolvedStyle = { font: "font_a", width: 1, height: 1, em: false, ul: false, reverse: false, align: "left" };

export type Op =
  | { op: "text"; text: string; style: ResolvedStyle }
  | { op: "image"; bitmap: Bitmap; align: Align }
  | { op: "feed"; lines: number }
  | { op: "cut" };

export interface Span {
  text: string;
  style: ResolvedStyle;
}

/** One printed line: the runs of text on it and how tall it comes out, in dots. */
export interface Line {
  spans: Span[];
  align: Align;
  height: number;
}

/** What `lines()` returns: printed lines, blank feeds, images and cuts, top to bottom. */
export type Row = ({ kind: "line" } & Line) | { kind: "image"; bitmap: Bitmap; align: Align } | { kind: "cut" };

export class PrintDocument {
  readonly paper: PaperSpec;
  private readonly list: Op[] = [];

  constructor(paper: PaperSpec = PAPER_80MM) {
    this.paper = paper;
  }

  /** Characters that fit on one line in this style. */
  cols(style: TextStyle = {}): number {
    const font = style.font ?? "font_a";
    return Math.floor(this.paper.dots / (this.paper.cell[font].w * (style.width ?? 1)));
  }

  /** Text without a trailing newline; follow with `line()` to end the line. */
  text(content: string, style: TextStyle = {}): this {
    const resolved: ResolvedStyle = { ...DEFAULT_STYLE, ...style };
    int(resolved.width, 1, 8);
    int(resolved.height, 1, 8);
    this.list.push({ op: "text", text: printable(content), style: resolved });
    return this;
  }

  /** One or more lines of text, each ending in a newline. */
  line(content = "", style: TextStyle = {}): this {
    return this.text(content + "\n", style);
  }

  /** Word-wrapped paragraph that fits the paper in the given style. */
  paragraph(content: string, style: TextStyle = {}): this {
    return this.line(wrap(printable(content), this.cols(style)).join("\n"), style);
  }

  /**
   * One line with `left` and `right` pushed to the edges, filled with `fill`.
   * `left` is truncated if the two don't fit.
   */
  columns(left: string, right: string, style: TextStyle = {}, fill = " "): this {
    return this.line(spread(printable(left), printable(right), this.cols(style), fill), style);
  }

  /**
   * A thin full-width rule. Drawn as underlined spaces: the printer ignores
   * <hline> outside page mode, and this comes out as a clean hairline.
   */
  rule(style: TextStyle = {}): this {
    return this.line(" ".repeat(this.cols(style)), { ...style, ul: true });
  }

  /** A 1-bit picture on its own lines. Wider than the printable area is an error. */
  image(bitmap: Bitmap, align: Align = "center"): this {
    if (bitmap.width > this.paper.dots) throw new RangeError(`image is ${bitmap.width} dots wide; the paper prints ${this.paper.dots}`);
    if (bitmap.width % 8) throw new RangeError("image width must be a multiple of 8");
    this.list.push({ op: "image", bitmap, align });
    return this;
  }

  feed(lines = 1): this {
    this.list.push({ op: "feed", lines: int(lines, 0, 255) });
    return this;
  }

  /** Feed to the cutter and cut. */
  cut(): this {
    this.list.push({ op: "cut" });
    return this;
  }

  get ops(): readonly Op[] {
    return this.list;
  }

  /** The document as printed lines, for drawing it somewhere other than paper. */
  lines(): Row[] {
    const rows: Row[] = [];
    let spans: Span[] = [];
    const endLine = () => {
      const tallest = Math.max(0, ...spans.map((s) => this.paper.cell[s.style.font].h * s.style.height));
      const first = spans[0];
      rows.push({ kind: "line", spans, align: first?.style.align ?? "left", height: Math.max(this.paper.lineSpacing, tallest) });
      spans = [];
    };
    for (const op of this.list) {
      if (op.op === "text") {
        op.text.split("\n").forEach((chunk, i) => {
          if (i > 0) endLine();
          if (chunk) spans.push({ text: chunk, style: op.style });
        });
      } else if (op.op === "image") {
        if (spans.length) endLine();
        rows.push({ kind: "image", bitmap: op.bitmap, align: op.align });
      } else if (op.op === "feed") {
        // A feed finishes any partial line, then advances whole blank lines.
        if (spans.length) endLine();
        for (let i = 0; i < op.lines; i++) endLine();
      } else {
        if (spans.length) endLine();
        rows.push({ kind: "cut" });
      }
    }
    if (spans.length) endLine();
    return rows;
  }

  /**
   * Roughly what the ticket will look like, as monospace text at font A
   * width: wide text is letter-spaced, reverse text is [bracketed], rules are
   * drawn as lines, and font B is shown at font A size.
   */
  toText(): string {
    const width = this.cols();
    return this.lines()
      .map((row) => {
        if (row.kind === "cut") return "\n" + "- ".repeat(width / 2) + "(cut)";
        if (row.kind === "image") return imageText(row.bitmap, row.align, this.paper);
        let text = row.spans
          .map(({ text, style }) => {
            if (style.ul && !text.trim()) return "\u2500".repeat(Math.round((text.length * this.paper.cell[style.font].w * style.width) / this.paper.cell.font_a.w));
            const wide = style.width > 1 ? [...text].map((c) => c + " ".repeat(style.width - 1)).join("") : text;
            return style.reverse && text.trim() ? `[${wide.trim()}]` : wide;
          })
          .join("")
          .trimEnd();
        const pad = Math.max(0, width - text.length);
        if (row.align === "center") text = " ".repeat(Math.floor(pad / 2)) + text;
        if (row.align === "right") text = " ".repeat(pad) + text;
        return text;
      })
      .join("\n");
  }

  /** The `<epos-print>` element: what goes inside the SOAP body. */
  toXml(): string {
    // Printers keep state between jobs; start every job from a known place.
    const parts = [`<text lang="en" smooth="true"/>`, styleTag(DEFAULT_STYLE, null)];
    let current = DEFAULT_STYLE;
    for (const op of this.list) {
      if (op.op === "text") {
        parts.push(styleTag(op.style, current), `<text>${escapeXml(op.text)}</text>`);
        current = op.style;
      } else if (op.op === "image") {
        // Images follow the text alignment setting.
        const aligned = { ...current, align: op.align };
        parts.push(styleTag(aligned, current));
        current = aligned;
        const { width, height } = op.bitmap;
        parts.push(`<image width="${width}" height="${height}" color="color_1" mode="mono">${bitmapBase64(op.bitmap)}</image>`);
      } else if (op.op === "feed") {
        parts.push(`<feed line="${op.lines}"/>`);
      } else {
        parts.push(`<cut type="feed"/>`);
      }
    }
    return `<epos-print xmlns="${EPOS_NS}">${parts.join("")}</epos-print>`;
  }
}

export const EPOS_NS = "http://www.epson-pos.com/schemas/2011/03/epos-print";

/** An image as character art: each character covers one font A cell (12x24 dots). */
function imageText(bm: Bitmap, align: Align, paper: PaperSpec): string {
  const { w, h } = paper.cell.font_a;
  const cols = Math.ceil(bm.width / w);
  const width = Math.floor(paper.dots / w);
  const indent = align === "center" ? Math.floor((width - cols) / 2) : align === "right" ? width - cols : 0;
  const out: string[] = [];
  for (let cy = 0; cy < bm.height; cy += h) {
    let line = "";
    for (let cx = 0; cx < bm.width; cx += w) {
      let black = 0;
      let total = 0;
      for (let y = cy; y < Math.min(cy + h, bm.height); y++)
        for (let x = cx; x < Math.min(cx + w, bm.width); x++, total++) if (isBlack(bm, x, y)) black++;
      const f = black / total;
      line += f > 0.6 ? "\u2588" : f > 0.3 ? "\u2593" : f > 0.12 ? "\u2592" : f > 0.03 ? "\u2591" : " ";
    }
    out.push(" ".repeat(indent) + line.trimEnd());
  }
  return out.join("\n");
}

/** A `<text .../>` setting only what differs from `prev` (everything if `prev` is null). */
function styleTag(next: ResolvedStyle, prev: ResolvedStyle | null): string {
  const attrs: string[] = [];
  if (!prev || next.font !== prev.font) attrs.push(`font="${next.font}"`);
  if (!prev || next.width !== prev.width) attrs.push(`width="${int(next.width, 1, 8)}"`);
  if (!prev || next.height !== prev.height) attrs.push(`height="${int(next.height, 1, 8)}"`);
  if (!prev || next.em !== prev.em) attrs.push(`em="${next.em}"`);
  if (!prev || next.ul !== prev.ul) attrs.push(`ul="${next.ul}"`);
  if (!prev || next.reverse !== prev.reverse) attrs.push(`reverse="${next.reverse}"`);
  if (!prev || next.align !== prev.align) attrs.push(`align="${next.align}"`);
  return attrs.length ? `<text ${attrs.join(" ")}/>` : "";
}

function int(n: number, min: number, max: number): number {
  if (!Number.isInteger(n) || n < min || n > max) throw new RangeError(`${n} is not an integer in ${min}-${max}`);
  return n;
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/\n/g, "&#10;");
}

const REPLACEMENTS: Record<string, string> = {
  "‘": "'", "’": "'", "‚": "'", "“": '"', "”": '"', "„": '"',
  "–": "-", "—": "-", "−": "-", "…": "...", " ": " ", "·": "-",
  "×": "x", "½": "1/2", "¼": "1/4", "¾": "3/4", "ß": "ss", "æ": "ae",
  "Æ": "AE", "ø": "o", "Ø": "O", "ł": "l", "Ł": "L",
};

/**
 * Reduce text to what the printer's default code page reliably prints: plain
 * ASCII. Accents are dropped ("José" -> "Jose"), smart punctuation is
 * straightened, and anything else (emoji, CJK) is removed rather than printed
 * as garbage. Newlines survive.
 */
export function printable(s: string): string {
  return s
    // "1½" must not become "11/2".
    .replace(/(\d)([½¼¾])/g, "$1 $2")
    .replace(/[‘’‚“”„–—−… ·×½¼¾ßæÆøØłŁ]/g, (c) => REPLACEMENTS[c]!)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\t/g, " ")
    .replace(/[^\n\x20-\x7E]/g, "");
}

/** Greedy word wrap. Words longer than a line are hard-broken. Existing newlines are kept. */
export function wrap(s: string, width: number): string[] {
  const out: string[] = [];
  for (const para of s.split("\n")) {
    const start = out.length;
    let line = "";
    for (let word of para.split(/ +/).filter(Boolean)) {
      while (word.length > width) {
        if (line) out.push(line);
        line = "";
        out.push(word.slice(0, width));
        word = word.slice(width);
      }
      if (!word) continue;
      if (!line) {
        line = word;
      } else if (line.length + 1 + word.length <= width) {
        line += " " + word;
      } else {
        out.push(line);
        line = word;
      }
    }
    // An empty paragraph is a blank line; otherwise don't leave a stray empty one.
    if (line || out.length === start) out.push(line);
  }
  return out;
}

/** `left.....right` in exactly `width` characters (or `right` alone if even that won't fit). */
export function spread(left: string, right: string, width: number, fill = " "): string {
  if (right.length >= width) return right.slice(0, width);
  const room = width - right.length - 1;
  const l = left.length > room ? left.slice(0, Math.max(0, room - 1)) + "." : left;
  // Keep a plain space either side of the leader so it reads as a gap, not glued on.
  const gap = width - l.length - right.length;
  if (fill === " " || gap < 3) return l + " ".repeat(gap) + right;
  return l + " " + fill.repeat(gap - 2) + " " + right;
}
