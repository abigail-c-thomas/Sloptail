import { useEffect, useState } from "react";
import type { Order } from "@sloptail/shared";
import { Badge, Button, Card, RecipeList, Spinner, Stack } from "@sloptail/ui";
import { api } from "../api.ts";

const TONE: Record<Order["status"], "accent" | "ok" | "warn" | "danger" | undefined> = {
  queued: undefined,
  making: "accent",
  ready: "ok",
  collected: undefined,
  cancelled: "danger",
};

export function PastOrders({ userId, onReorder, onNew }: { userId: string; onReorder: (o: Order) => void; onNew: () => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  useEffect(() => {
    api.userOrders(userId).then(setOrders).catch(() => setOrders([]));
  }, [userId]);

  return (
    <Stack gap={12}>
      <Button block onClick={onNew}>
        New order
      </Button>
      {orders === null ? (
        <Spinner />
      ) : orders.length === 0 ? (
        <p className="muted">Nothing yet.</p>
      ) : (
        orders.map((o) => (
          <Card key={o.id} flat className="stack" style={{ gap: 8 }}>
            <div className="row between">
              <h3>{o.proposal.name}</h3>
              <Badge tone={TONE[o.status]}>{o.status}</Badge>
            </div>
            {o.request.prompt ? <p className="small muted">“{o.request.prompt}”</p> : null}
            <RecipeList recipe={o.proposal.recipe} compact />
            <Button size="sm" variant="secondary" onClick={() => onReorder(o)}>
              Again
            </Button>
          </Card>
        ))
      )}
    </Stack>
  );
}
