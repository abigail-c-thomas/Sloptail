import { useEffect, useState } from "react";
import { CLASSICS, type Order } from "@sloptail/shared";
import { Paper } from "@sloptail/ui";
import { orderTicket, type TicketInput } from "@sloptail/ticket";
import { makeBarApi } from "../bar/barApi.ts";

/**
 * Design bench for the printed ticket: sample tickets drawn exactly as the
 * printer will draw them (same layout code as the print bridge), plus the
 * live queue if this browser has the bar token.
 */

const NOW = Date.now();

const SAMPLES: { label: string; ticket: TicketInput }[] = [
  {
    label: "Adventurous, with a prompt",
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
          { ingredient: "mezcal", amount: 50 },
          { ingredient: "lime-juice", amount: 15 },
          { ingredient: "szechuan-tincture", amount: 2 },
          { ingredient: "pineapple-juice", amount: 40 },
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
          { ingredient: "herbal-tea", amount: 90 },
          { ingredient: "honey-syrup", amount: 15 },
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
  const token = localStorage.getItem("sloptail:barToken");

  useEffect(() => {
    if (!token) return;
    const api = makeBarApi(token);
    const load = () =>
      api
        .view()
        .then((v) => setLive([...v.queue, ...v.ready]))
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
            <Paper doc={orderTicket(o)} />
            <figcaption className="small muted">
              Live #{o.id} · {o.status}
            </figcaption>
          </figure>
        ))}
        {SAMPLES.map((s) => (
          <figure key={s.label} className="ticket-figure">
            <Paper doc={orderTicket(s.ticket)} />
            <figcaption className="small muted">{s.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
