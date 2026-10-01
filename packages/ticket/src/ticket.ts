import { buildOrder, formatAmount, type Catalog, type Order } from "@sloptail/shared";
import { PrintDocument, printable, trimRows, wrap, type Bitmap, type TextStyle } from "@sloptail/printer";

/**
 * The ticket for one order. Two readers: the bartender (who, what goes in,
 * in build order) and then the guest, because the ticket stays with the
 * drink (the drawing, what it is, what they asked for).
 */

/** How wide the drawing prints, in dots (about 40mm). */
export const ART_DOTS = 288;

/** White rows kept above and below the drawing once its own empty space is trimmed. */
const ART_PAD_DOTS = 14;

/** Lines of the guest's prompt to print, so nobody prints the Bee Movie script. */
const PROMPT_LINES = 3;

/** An order, or a proposal the guest hasn't ordered yet (no id or time). */
export type TicketInput = Pick<Order, "userName" | "request" | "proposal"> & Partial<Pick<Order, "id" | "createdAt">>;

export function orderTicket(order: TicketInput, catalog: Catalog, opts: { art?: Bitmap | undefined } = {}): PrintDocument {
  const doc = new PrintDocument();
  const small: TextStyle = { font: "font_b" };
  const { proposal, request } = order;

  // --- who: big enough to read from across the bar ----------------------
  // No feed first: the printer already leaves a gap above the cut.
  doc.line(order.userName.toUpperCase(), { ...fit(doc, order.userName, 3), align: "center", em: true });
  doc.rule();
  doc.feed(1);

  // --- what ------------------------------------------------------------
  doc.paragraph(proposal.name, { ...fit(doc, proposal.name, 2), align: "center", em: true });
  if (opts.art) {
    doc.image(trimRows(opts.art, ART_PAD_DOTS), "center");
  } else {
    doc.feed(1);
  }

  // --- what goes in, in build order --------------------------------------
  for (const item of buildOrder(proposal.recipe, catalog)) {
    const ing = catalog.byId.get(item.ingredient);
    // Decimals, like the bar screen; measure what will actually print.
    const label = printable(ing?.name ?? item.ingredient);
    const amount = printable(formatAmount(item, ing, { decimal: true }));
    const width = doc.cols();
    const room = width - amount.length - 1;
    const left = label.length > room ? label.slice(0, room - 1) + "." : label;
    const gap = width - left.length - amount.length;
    doc.text(left + (gap >= 3 ? " " + ".".repeat(gap - 2) + " " : " ".repeat(gap)));
    doc.line(amount, { em: true });
    if (ing?.notes && (ing.type === "garnish" || ing.type === "flavoring")) doc.line(`  ${ing.notes}`, small);
  }

  // --- for the guest ---------------------------------------------------
  doc.feed(1);
  doc.paragraph(proposal.description, small);
  const asked = request.prompt.trim();
  if (asked) {
    doc.feed(1);
    const lines = wrap(printable(`"${asked}"`), doc.cols(small));
    if (lines.length > PROMPT_LINES) {
      lines.length = PROMPT_LINES;
      lines[PROMPT_LINES - 1] = lines[PROMPT_LINES - 1]!.slice(0, doc.cols(small) - 4).trimEnd() + '..."';
    }
    doc.line(lines.join("\n"), small);
  }
  doc.feed(1);
  doc.cut();
  return doc;
}

/** Biggest magnification (up to `max`) at which `text` fits on one line; else 1x wide, 2x tall. */
function fit(doc: PrintDocument, text: string, max: number): TextStyle {
  for (let size = max; size >= 2; size--) if (printable(text).length <= doc.cols({ width: size })) return { width: size, height: size };
  return { width: 1, height: 2 };
}
