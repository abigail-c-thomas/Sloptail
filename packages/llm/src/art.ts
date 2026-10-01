import type { Proposal } from "@sloptail/shared";
import type { LlmClient, Message } from "./client.ts";
import { proposeMessages, type PromptContext } from "./prompt.ts";

/**
 * A small picture for the printed ticket: the idea behind what the guest
 * asked for, drawn as SVG by the model. Printed 1-bit on a thermal printer
 * (greys come out dithered), so the prompt asks for bold, simple shapes.
 *
 * It's a follow-up turn in the same conversation that designed the drink, so
 * the model draws the idea it had in mind (and the shared prefix can hit the
 * provider's prompt cache).
 *
 * The SVG is untrusted model output that ends up in browsers and the
 * rasterizer, so it's checked against an allowlist before anyone sees it.
 */

/** Drawing units; the ticket prints it at roughly one unit per dot. */
export const ART_VIEWBOX = 256;
export const ART_MAX_CHARS = 12_000;

const ALLOWED_ELEMENTS = new Set([
  "svg", "g", "defs", "title", "desc", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon",
  "linearGradient", "radialGradient", "stop", "clipPath", "mask", "use",
]);

export function artRequest(): string {
  return `Now draw a small picture for this drink's ticket. The ticket is printed on a thermal receipt printer: black ink on white paper, 180 dpi, about 36mm square. The bartender hands the ticket over with the drink, so the guest sees it.

## What to draw
Draw the concept behind what the guest asked for: the idea, image, mood or joke in their words. Not a cocktail, not a glass (unless their words are literally about one). If they didn't say anything, draw the idea behind the drink's name, not the drink. One clear subject, large in the frame, readable at 36mm. Wit is welcome.

## Style
- Bold graphic illustration in the style of a good rubber stamp or linocut: confident black outlines (stroke-width 4 to 8), solid black shapes, lots of white paper.
- Mostly black and white. Grey is allowed for at most two areas (a liquid, a sky, a shadow): a flat fill between #777 and #bbb, or a gradient between greys. It prints as dithered dots, so a little goes a long way.
- Fill the frame: the subject spans most of the 256 units and is centred. No border or frame around it.
- Nothing thinner than stroke-width 3. No tiny details; they vanish at this size.
- Keep it workplace-appropriate: nothing sexual, violent, hateful, or about real people. If the request points there, draw something wholesome and witty instead.

## Format
- A single <svg> element with xmlns="http://www.w3.org/2000/svg" and viewBox="0 0 ${ART_VIEWBOX} ${ART_VIEWBOX}". Start with a white background rect.
- Only these elements: ${[...ALLOWED_ELEMENTS].join(", ")}.
- No text of any kind, no images, no filters, no CSS, no external references, no scripts.
- Under ${Math.round(ART_MAX_CHARS * 0.6)} characters.
- Reply with the SVG only: no code fences, no commentary.`;
}

/** The drink conversation as it ended (the guest's request, the drink), then the drawing request. */
export function artMessages(ctx: PromptContext, proposal: Proposal): Message[] {
  return [
    ...proposeMessages(ctx),
    { role: "assistant", content: JSON.stringify(proposal) },
    { role: "user", content: artRequest() },
  ];
}

export type SvgCheck = { ok: true; svg: string } | { ok: false; problems: string[] };

/**
 * Pull the <svg> out of a model reply and check it against the allowlist.
 * Deliberately strict and simple: a regex scan, not a parser, so anything
 * clever is rejected rather than interpreted.
 */
export function checkSvg(reply: string): SvgCheck {
  const start = reply.indexOf("<svg");
  const end = reply.lastIndexOf("</svg>");
  if (start < 0 || end < start) return { ok: false, problems: ["No <svg>...</svg> element found."] };
  const svg = reply.slice(start, end + "</svg>".length);
  const problems: string[] = [];

  if (svg.length > ART_MAX_CHARS) problems.push(`The SVG is ${svg.length} characters; keep it under ${ART_MAX_CHARS}.`);
  if (!/viewBox\s*=\s*"0 0 256 256"/.test(svg)) problems.push(`Use viewBox="0 0 ${ART_VIEWBOX} ${ART_VIEWBOX}".`);
  if (/<!|<\?/.test(svg)) problems.push("No comments, CDATA, doctypes or processing instructions.");

  const tags = new Set([...svg.matchAll(/<\/?\s*([A-Za-z][\w:.-]*)/g)].map((m) => m[1]!));
  const banned = [...tags].filter((t) => !ALLOWED_ELEMENTS.has(t));
  if (banned.length) problems.push(`Elements not allowed: ${banned.join(", ")}.`);

  for (const m of svg.matchAll(/\s([A-Za-z][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g)) {
    const name = m[1]!.toLowerCase();
    const value = m[2]!.slice(1, -1);
    if (name.startsWith("on")) problems.push(`Event attributes are not allowed (${name}).`);
    if (name === "style") problems.push("Use presentation attributes, not style=.");
    if ((name === "href" || name === "xlink:href") && !value.startsWith("#")) problems.push("Only local #id references are allowed.");
    if (/url\(\s*(?!['"]?#)/i.test(value) || /javascript:|data:/i.test(value)) problems.push(`Only url(#id) references are allowed (${name}).`);
  }
  return problems.length ? { ok: false, problems: [...new Set(problems)] } : { ok: true, svg };
}

export interface DrawResult {
  svg: string;
  model: string;
  attempts: number;
}

/** Ask for a drawing; if it fails the checks, say why once and try again. */
export async function drawArt(ctx: PromptContext, proposal: Proposal, client: LlmClient, opts: { signal?: AbortSignal } = {}): Promise<DrawResult> {
  let messages = artMessages(ctx, proposal);
  let lastProblems: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const reply = await client.complete({ messages, temperature: 0.9, maxTokens: 8000, signal: opts.signal });
    const check = checkSvg(reply.text);
    if (check.ok) return { svg: check.svg, model: reply.model, attempts: attempt };
    lastProblems = check.problems;
    messages = [
      ...messages,
      { role: "assistant", content: reply.text },
      { role: "user", content: `That SVG can't be used:\n${check.problems.map((p) => `- ${p}`).join("\n")}\nSend the corrected SVG only.` },
    ];
  }
  throw new Error(`No usable drawing: ${lastProblems.join(" ")}`);
}
