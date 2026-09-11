import { useEffect, useRef, useState } from "react";
import type { Order } from "@sloptail/shared";
import { Badge, Banner, Button, Card, ProposalCard, Spinner, Stack } from "@sloptail/ui";
import { api } from "../api.ts";

const POLL_MS = 3000;

/**
 * After submitting: poll the order until it's ready, then make a fuss.
 * Polling rather than push: phones lock, iOS web push needs a PWA install,
 * and the bartender is going to shout the name anyway.
 */
export function Tracking({ orderId, onDone }: { orderId: string; onDone: (keepPrefs: boolean) => void }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const announced = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const o = await api.order(orderId);
        if (cancelled) return;
        setOrder(o);
        setError(null);
        if (o.status === "queued" || o.status === "making") timer = setTimeout(tick, POLL_MS);
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message);
        timer = setTimeout(tick, POLL_MS * 2);
      }
    };
    void tick();
    const onVisible = () => document.visibilityState === "visible" && void tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [orderId]);

  useEffect(() => {
    if (order?.status === "ready" && !announced.current) {
      announced.current = true;
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        /* not supported */
      }
      document.title = `🍸 ${order.proposal.name} is ready`;
    }
  }, [order]);

  if (!order) return error ? <Banner tone="danger">{error}</Banner> : <Spinner label="Finding your order…" />;

  const name = order.proposal.name;

  if (order.status === "ready") {
    return (
      <Stack gap={16}>
        <Card tone="ok" className="ready-card stack">
          <p className="muted">Ready at the bar</p>
          <div className="big-name">{order.userName}</div>
          <h1>{name}</h1>
        </Card>
        <Button size="lg" onClick={() => onDone(true)}>
          Another
        </Button>
        <Button variant="ghost" onClick={() => onDone(false)}>
          Start over
        </Button>
      </Stack>
    );
  }

  if (order.status === "collected") {
    return (
      <Stack gap={16}>
        <Card tone="ok" className="stack">
          <h2>Enjoy your {name}</h2>
        </Card>
        <Button size="lg" onClick={() => onDone(true)}>
          Another
        </Button>
      </Stack>
    );
  }

  if (order.status === "cancelled") {
    return (
      <Stack gap={16}>
        <Banner tone="warn">
          Sorry, the bar had to cancel your {name}{order.cancelReason ? `: ${order.cancelReason}` : ""}.
        </Banner>
        <Button size="lg" onClick={() => onDone(true)}>
          Try again
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap={16}>
      <Card className="stack">
        <div className="row between">
          <h2>{name}</h2>
          <Badge tone={order.status === "making" ? "accent" : undefined}>{order.status === "making" ? "being made" : "queued"}</Badge>
        </div>
        <p>
          We'll shout <b>{order.userName}</b> when it's on the bar.
        </p>
        {error ? <p className="small muted">Connection wobble, retrying…</p> : null}
      </Card>
      <details>
        <summary className="muted small">Recipe</summary>
        <div style={{ marginTop: 12 }}>
          <ProposalCard proposal={order.proposal} />
        </div>
      </details>
      <Button variant="ghost" onClick={() => onDone(true)}>
        Order another
      </Button>
    </Stack>
  );
}
