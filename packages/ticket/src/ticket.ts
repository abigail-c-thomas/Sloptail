import { CATALOG_BY_ID, buildOrder, formatAmount, type Order, type Strength } from "@sloptail/shared";
import { PrintDocument, type TextStyle } from "@sloptail/printer";

/**
 * The ticket for one order. Two readers: the bartender (top half: who, what
 * glass, what goes in, in build order) and then the guest, because the ticket
 * stays with the drink (bottom half: what it is and what they asked for).
 */

const STRENGTH_LABEL: Record<Strength, string> = {
  zero: "NO ALCOHOL",
  trace: "LOW ALCOHOL",
  half: "HALF STRENGTH",
  full: "FULL STRENGTH",
};

/** An order, or a proposal the guest hasn't ordered yet (no id or time). */
export type TicketInput = Pick<Order, "userName" | "request" | "proposal"> & Partial<Pick<Order, "id" | "createdAt">>;

export function orderTicket(order: TicketInput, opts: { timeZone?: string } = {}): PrintDocument {
  const doc = new PrintDocument();
  const small: TextStyle = { font: "font_b" };
  const { proposal, request } = order;

  // --- who: big enough to read from across the bar ----------------------
  doc.feed(1);
  doc.line(order.userName.toUpperCase(), { ...nameSize(doc, order.userName), align: "center", em: true });
  if (order.id !== undefined && order.createdAt !== undefined) {
    const time = new Date(order.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: opts.timeZone });
    doc.line(`order ${order.id}  -  ${time}`, { ...small, align: "center" });
  }
  doc.rule();
  doc.feed(1);

  // --- what ------------------------------------------------------------
  doc.paragraph(proposal.name, { height: 2, em: true });
  // Glass on the left, strength in bold on the right: a mocktail mustn't be
  // mistaken for the real thing. (Reverse-video came out smudgy on paper.)
  const glass = `${capitalise(proposal.glass)} glass, ice`;
  const tag = STRENGTH_LABEL[request.strength];
  doc.text(glass + " ".repeat(Math.max(1, doc.cols() - glass.length - tag.length)));
  doc.line(tag, { em: true });
  doc.feed(1);

  // --- build steps -----------------------------------------------------
  let step = 0;
  for (const item of buildOrder(proposal.recipe)) {
    const ing = CATALOG_BY_ID.get(item.ingredient);
    const garnish = ing?.type === "garnish";
    const label = `${garnish ? " +" : String(++step).padStart(2)}  ${ing?.name ?? item.ingredient}`;
    const amount = formatAmount(item, ing);
    const width = doc.cols();
    const room = width - amount.length - 1;
    const left = label.length > room ? label.slice(0, room - 1) + "." : label;
    const gap = width - left.length - amount.length;
    doc.text(left + (gap >= 3 ? " " + ".".repeat(gap - 2) + " " : " ".repeat(gap)));
    doc.line(amount, { em: true });
    if (ing?.notes && (garnish || ing.type === "flavoring")) doc.line(`      ${ing.notes}`, small);
  }
  doc.rule();

  // --- for the guest ---------------------------------------------------
  doc.feed(1);
  doc.paragraph(proposal.description, small);
  const asked = request.prompt.trim();
  if (asked) {
    doc.feed(1);
    doc.paragraph(`You asked for: "${asked}"`, small);
  }
  doc.feed(1);
  doc.line("sloptail  -  ai happy hour", { ...small, align: "center" });
  doc.cut();
  return doc;
}

/** Biggest name that still fits on one line: 3x for short names, down to 1x. */
function nameSize(doc: PrintDocument, name: string): TextStyle {
  for (const size of [3, 2]) if (name.length <= doc.cols({ width: size })) return { width: size, height: size };
  return { width: 1, height: 2 };
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
