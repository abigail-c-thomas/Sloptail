import { useEffect, useState } from "react";
import { CLASSICS, DEFAULT_CATALOG, artKey, makeCatalog, type Catalog, type Order } from "@sloptail/shared";
import type { Bitmap } from "@sloptail/printer";
import { Paper } from "@sloptail/ui";
import { ART_DOTS, orderTicket, type TicketInput } from "@sloptail/ticket";
import { makeBarApi } from "../bar/barApi.ts";
import { SAMPLE_ART } from "./sampleArt.ts";
import { svgToBitmap } from "./svgBitmap.ts";

/**
 * Design bench for the printed ticket: sample tickets drawn exactly as the
 * printer will draw them (same layout code as the print bridge), plus the
 * live queue if this browser has the bar token.
 */

const NOW = Date.now();

const SAMPLES: { label: string; ticket: TicketInput; art?: string }[] = [
  {
    label: "Adventurous, with a prompt and its drawing",
    art: SAMPLE_ART,
    ticket: {
      id: "12",
      createdAt: NOW,
      userName: "Ada",
      request: { strength: "full", adventurousness: 3, prompt: "something smoky that tastes like a bonfire in an orchard" },
      proposal: {
        name: "Orchard Arson",
        glass: "highball",
        description: "Smoky mezcal lifted by pineapple and a numbing Szechuan tingle; think bonfire, but fruity.",
        recipe: [
          { ingredient: "mezcal", amount: 1.5 },
          { ingredient: "lime-juice", amount: 0.5 },
          { ingredient: "szechuan-tincture", amount: 2 },
          { ingredient: "pineapple-juice", amount: 1.25 },
          { ingredient: "ginger-beer", amount: "fill" },
          { ingredient: "citrus-peel", amount: 1 },
        ],
      },
    },
  },
  {
    label: "Mocktail, long name, no prompt",
    ticket: {
      id: "13",
      createdAt: NOW,
      userName: "Maximilian Featherstonehaugh",
      request: { strength: "zero", adventurousness: 2, prompt: "" },
      proposal: {
        name: "The Extremely Responsible Choice",
        glass: "rocks",
        description: "Cold chamomile, buckwheat honey and a lactic tang. Soft, round, a little floral.",
        recipe: [
          { ingredient: "herbal-tea", amount: 3 },
          { ingredient: "honey-syrup", amount: 0.5 },
          { ingredient: "lactic-acid", amount: 3 },
          { ingredient: "sage-leaf", amount: 1 },
        ],
      },
    },
  },
  ...CLASSICS.slice(0, 4).map((c, i) => ({
    label: `Classic: ${c.proposal.name}`,
    ticket: {
      id: String(20 + i),
      createdAt: NOW,
      userName: ["Bo", "Priya", "Sam", "Jo"][i]!,
      request: { strength: c.strengths.at(-1)!, adventurousness: 1 as const, prompt: "" },
      proposal: c.proposal,
    },
  })),
];

export function TicketsApp() {
  const [live, setLive] = useState<Order[] | null>(null);
  const [catalog, setCatalog] = useState<Catalog>(DEFAULT_CATALOG);
  /** Drawings as printer dots, by artKey for live orders and by label for samples. */
  const [art, setArt] = useState<Record<string, Bitmap>>({});
  const token = localStorage.getItem("sloptail:barToken");

  const addArt = (key: string, svg: string) =>
    svgToBitmap(svg, ART_DOTS)
      .then((bm) => setArt((a) => ({ ...a, [key]: bm })))
      .catch(() => {});

  useEffect(() => {
    for (const s of SAMPLES) if (s.art) void addArt(s.label, s.art);
  }, []);

  // Fetch each live drawing once it's done.
  useEffect(() => {
    if (!token || !live) return;
    const api = makeBarApi(token);
    for (const o of live) {
      if (o.art !== "done" || art[artKey(o)]) continue;
      void api.art(o.id).then((r) => addArt(artKey(o), r.svg), () => {});
    }
  }, [live, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token) return;
    const api = makeBarApi(token);
    const load = () =>
      api
        .view()
        .then((v) => {
          setLive([...v.queue, ...v.ready]);
          setCatalog(makeCatalog(v.catalog));
        })
        .catch(() => setLive(null));
    void load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [token]);

  return (
    <div className="tickets-page">
      <header className="stack" style={{ gap: 4 }}>
        <h1>Tickets</h1>
        <p className="muted small">
          Drawn from the same layout code the printer uses (<code>packages/ticket</code>), in printer dots.
          {token ? " Live orders first." : " Open /bar once with the token to see live orders here too."}
        </p>
      </header>
      <div className="tickets-grid">
        {live?.map((o) => (
          <figure key={o.id} className="ticket-figure">
            <Paper doc={orderTicket(o, catalog, { art: art[artKey(o)] })} />
            <figcaption className="small muted">
              Live #{o.id} · {o.status}
              {o.art === undefined ? " · drawing…" : o.art === "failed" ? " · no drawing" : ""}
            </figcaption>
          </figure>
        ))}
        {SAMPLES.map((s) => (
          <figure key={s.label} className="ticket-figure">
            <Paper doc={orderTicket(s.ticket, catalog, { art: art[s.label] })} />
            <figcaption className="small muted">{s.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
