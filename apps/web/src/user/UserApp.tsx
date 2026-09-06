import { useCallback, useEffect, useReducer, useState } from "react";
import type { Adventurousness, Order, Proposal, Strength, UserRequest } from "@sloptail/shared";
import { classicsFor } from "@sloptail/shared";
import {
  Banner,
  Button,
  Card,
  Chips,
  Choice,
  Drawer,
  ProposalCard,
  Spinner,
  Stack,
  Steps,
  TextArea,
  TextField,
} from "@sloptail/ui";
import { api, ApiError } from "../api.js";
import {
  loadActiveOrder,
  loadLastRequest,
  loadUser,
  saveActiveOrder,
  saveLastRequest,
  saveUser,
} from "../storage.js";
import { PastOrders } from "./PastOrders.js";
import { Tracking } from "./Tracking.js";

// ---------------------------------------------------------------------------
// Wizard state
// ---------------------------------------------------------------------------

type Step = "name" | "strength" | "adventure" | "prompt" | "classics" | "loading" | "proposal" | "tracking";

interface State {
  step: Step;
  name: string;
  strength?: Strength;
  adventurousness?: Adventurousness;
  prompt: string;
  proposal?: Proposal;
  /** The prompt the current proposal was generated from, shown as its subtitle. */
  proposalPrompt?: string;
  error?: string;
  orderId?: string;
}

type Action =
  | { type: "go"; step: Step }
  | { type: "name"; name: string }
  | { type: "strength"; strength: Strength }
  | { type: "adventure"; adventurousness: Adventurousness }
  | { type: "prompt"; prompt: string }
  | { type: "proposal"; proposal: Proposal; prompt: string }
  | { type: "error"; error: string }
  | { type: "submitted"; orderId: string }
  | { type: "reorder"; order: Order }
  | { type: "reset"; keepPrefs: boolean };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "go":
      return { ...s, step: a.step, error: undefined };
    case "name":
      return { ...s, name: a.name };
    case "strength":
      return { ...s, strength: a.strength, step: "adventure" };
    case "adventure":
      return { ...s, adventurousness: a.adventurousness, step: a.adventurousness === 1 ? "classics" : "prompt" };
    case "prompt":
      return { ...s, prompt: a.prompt };
    case "proposal":
      return { ...s, proposal: a.proposal, proposalPrompt: a.prompt, step: "proposal", error: undefined };
    case "error":
      return { ...s, error: a.error, step: s.proposal ? "proposal" : "prompt" };
    case "submitted":
      return { ...s, orderId: a.orderId, step: "tracking" };
    case "reorder":
      return {
        ...s,
        strength: a.order.request.strength,
        adventurousness: a.order.request.adventurousness,
        prompt: a.order.request.prompt,
        proposal: a.order.proposal,
        proposalPrompt: a.order.request.prompt,
        step: "proposal",
        error: undefined,
      };
    case "reset":
      return {
        step: a.keepPrefs ? "prompt" : "strength",
        name: s.name,
        ...(a.keepPrefs ? { strength: s.strength, adventurousness: s.adventurousness } : {}),
        prompt: "",
      };
  }
}

function initialState(): State {
  const user = loadUser();
  const last = loadLastRequest();
  const active = loadActiveOrder();
  if (active) return { step: "tracking", name: user.name, prompt: "", orderId: active, ...(last ?? {}) };
  return { step: user.name ? "strength" : "name", name: user.name, prompt: last?.prompt ?? "", ...(last ?? {}) };
}

const STEP_ORDER: Step[] = ["name", "strength", "adventure", "prompt", "proposal"];

const PROMPT_IDEAS = [
  "something citrusy and long",
  "bitter and serious",
  "tastes like a holiday",
  "not too sweet",
  "surprise me",
  "smoky? spicy? both?",
];

// ---------------------------------------------------------------------------

export function UserApp() {
  const [s, dispatch] = useReducer(reducer, undefined, initialState);
  const [drawer, setDrawer] = useState(false);
  const user = loadUser();

  const request = (): UserRequest | null =>
    s.strength && s.adventurousness ? { strength: s.strength, adventurousness: s.adventurousness, prompt: s.prompt } : null;

  const generate = useCallback(async () => {
    const req = request();
    if (!req) return;
    saveLastRequest(req);
    dispatch({ type: "go", step: "loading" });
    try {
      const { proposal } = await api.propose({ userId: user.userId, userName: s.name, request: req });
      dispatch({ type: "proposal", proposal, prompt: req.prompt });
    } catch (e) {
      dispatch({ type: "error", error: (e as Error).message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.strength, s.adventurousness, s.prompt, s.name, user.userId]);

  const tweak = async (text: string) => {
    const req = request();
    if (!req || !s.proposal) return;
    dispatch({ type: "go", step: "loading" });
    try {
      const { proposal } = await api.edit({ userId: user.userId, request: req, proposal: s.proposal, tweak: text });
      dispatch({ type: "proposal", proposal, prompt: s.proposalPrompt ?? req.prompt });
    } catch (e) {
      dispatch({ type: "error", error: (e as Error).message });
    }
  };

  const submit = async () => {
    const req = request();
    if (!req || !s.proposal) return;
    try {
      const order = await api.submit({ userId: user.userId, userName: s.name, request: req, proposal: s.proposal });
      saveActiveOrder(order.id);
      dispatch({ type: "submitted", orderId: order.id });
    } catch (e) {
      const msg = e instanceof ApiError && e.status === 409 ? `${e.message}. Ask for a tweak and we'll swap it out.` : (e as Error).message;
      dispatch({ type: "error", error: msg });
    }
  };

  const stepIndex = STEP_ORDER.indexOf(s.step);

  return (
    <div className="page">
      <header className="page-header">
        <span className="brand">
          Sloptail<small>AI happy hour</small>
        </span>
        <Button variant="ghost" size="sm" onClick={() => setDrawer(true)}>
          My drinks
        </Button>
      </header>

      {stepIndex >= 0 && s.step !== "tracking" ? <Steps current={stepIndex + 1} total={STEP_ORDER.length} /> : null}

      {s.error ? <Banner tone="danger">{s.error}</Banner> : null}

      {s.step === "name" && (
        <NameStep
          name={s.name}
          onChange={(name) => dispatch({ type: "name", name })}
          onNext={() => {
            saveUser({ ...user, name: s.name.trim() });
            dispatch({ type: "go", step: "strength" });
          }}
        />
      )}

      {s.step === "strength" && (
        <Stack gap={16}>
          <h1>Hi {s.name}. Booze?</h1>
          <Choice<Strength>
            value={s.strength}
            onChange={(strength) => dispatch({ type: "strength", strength })}
            options={[
              { value: "zero", label: "Mocktail, zero alcohol", hint: "Nothing. Not even bitters." },
              { value: "trace", label: "Mocktail, bitters ok", hint: "No spirits, but a dash of bitters is fine." },
              { value: "half", label: "Cocktail, half strength", hint: "You have a demo after this." },
              { value: "full", label: "Cocktail, full strength", hint: "You do not have a demo after this." },
            ]}
          />
          <Button variant="ghost" onClick={() => dispatch({ type: "go", step: "name" })}>
            Not {s.name}?
          </Button>
        </Stack>
      )}

      {s.step === "adventure" && (
        <Stack gap={16}>
          <h1>How adventurous are you feeling?</h1>
          <Choice<Adventurousness>
            value={s.adventurousness}
            onChange={(adventurousness) => dispatch({ type: "adventure", adventurousness })}
            options={[
              { value: 1, label: "Not at all", hint: "Just show me a menu of normal drinks." },
              { value: 2, label: "Get creative", hint: "A recognisable drink with a twist." },
              { value: 3, label: "Fuck my shit up", hint: "The AI is driving. No refunds." },
            ]}
          />
          <Button variant="ghost" onClick={() => dispatch({ type: "go", step: "strength" })}>
            Back
          </Button>
        </Stack>
      )}

      {s.step === "classics" && s.strength && (
        <Stack gap={16}>
          <h1>The classics</h1>
          <p className="muted">Everything here is a known quantity.</p>
          <Stack gap={10}>
            {classicsFor(s.strength).map((c) => (
              <Card key={c.id} flat className="stack" style={{ gap: 6 }}>
                <div className="row between">
                  <h3>{c.proposal.name}</h3>
                  <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "proposal", proposal: c.proposal, prompt: "a classic" })}>
                    This one
                  </Button>
                </div>
                <p className="small muted">{c.proposal.description}</p>
              </Card>
            ))}
          </Stack>
          <Button variant="secondary" onClick={() => dispatch({ type: "adventure", adventurousness: 2 })}>
            Ok, maybe I'm more adventurous than that
          </Button>
        </Stack>
      )}

      {s.step === "prompt" && (
        <Stack gap={16}>
          <h1>What do you feel like?</h1>
          <TextArea
            id="prompt"
            label="In your own words"
            help="Flavours, moods, a spirit you love or hate. Or leave it blank and see what happens."
            value={s.prompt}
            onChange={(e) => dispatch({ type: "prompt", prompt: e.target.value })}
            maxLength={500}
            placeholder="e.g. something sharp and cold, I've had a day"
          />
          <Chips items={PROMPT_IDEAS} onPick={(p) => dispatch({ type: "prompt", prompt: p })} />
          <Button size="lg" onClick={generate}>
            Invent my drink
          </Button>
          <Button variant="ghost" onClick={() => dispatch({ type: "go", step: "adventure" })}>
            Back
          </Button>
        </Stack>
      )}

      {s.step === "loading" && <Spinner label={LOADING_LINES[Math.floor(Math.random() * LOADING_LINES.length)]} />}

      {s.step === "proposal" && s.proposal && (
        <ProposalStep
          proposal={s.proposal}
          subtitle={s.proposalPrompt}
          onTweak={tweak}
          onSubmit={submit}
          onRegenerate={generate}
          onBack={() => dispatch({ type: "go", step: s.adventurousness === 1 ? "classics" : "prompt" })}
        />
      )}

      {s.step === "tracking" && s.orderId && (
        <Tracking
          orderId={s.orderId}
          onDone={(keepPrefs) => {
            saveActiveOrder(null);
            dispatch({ type: "reset", keepPrefs });
          }}
        />
      )}

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="My drinks">
        <PastOrders
          userId={user.userId}
          onReorder={(order) => {
            setDrawer(false);
            saveActiveOrder(null);
            dispatch({ type: "reorder", order });
          }}
          onNew={() => {
            setDrawer(false);
            saveActiveOrder(null);
            dispatch({ type: "reset", keepPrefs: true });
          }}
        />
      </Drawer>

      <footer className="page-footer small muted">Drinks invented by a language model. Made by a human. Blame accordingly.</footer>
    </div>
  );
}

const LOADING_LINES = [
  "Consulting the model…",
  "Arguing with the bitters…",
  "Rebalancing the sour…",
  "Checking what we haven't run out of…",
  "Naming things is hard…",
];

function NameStep({ name, onChange, onNext }: { name: string; onChange: (n: string) => void; onNext: () => void }) {
  const ok = name.trim().length > 0;
  return (
    <form
      className="stack"
      style={{ gap: 16 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onNext();
      }}
    >
      <h1>What should we shout when it's ready?</h1>
      <TextField
        id="name"
        label="Your name"
        value={name}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="given-name"
        autoFocus
        maxLength={40}
        placeholder="First name is fine"
      />
      <Button size="lg" type="submit" disabled={!ok}>
        Next
      </Button>
    </form>
  );
}

function ProposalStep({
  proposal,
  subtitle,
  onTweak,
  onSubmit,
  onRegenerate,
  onBack,
}: {
  proposal: Proposal;
  subtitle?: string | undefined;
  onTweak: (t: string) => void;
  onSubmit: () => void;
  onRegenerate: () => void;
  onBack: () => void;
}) {
  const [tweak, setTweak] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => setTweak(""), [proposal]);
  return (
    <Stack gap={16}>
      <ProposalCard proposal={proposal} subtitle={subtitle} />
      <Button
        size="lg"
        loading={submitting}
        onClick={() => {
          setSubmitting(true);
          Promise.resolve(onSubmit()).finally(() => setSubmitting(false));
        }}
      >
        Order it
      </Button>
      <Card flat className="stack">
        <TextArea
          id="tweak"
          label="Or ask for a change"
          value={tweak}
          onChange={(e) => setTweak(e.target.value)}
          placeholder="less sweet / swap the gin for tequila / lose the garnish"
          maxLength={500}
          rows={2}
        />
        <div className="row">
          <Button variant="secondary" disabled={!tweak.trim()} onClick={() => onTweak(tweak)}>
            Tweak it
          </Button>
          <Button variant="ghost" onClick={onRegenerate}>
            Try something else
          </Button>
        </div>
      </Card>
      <Button variant="ghost" onClick={onBack}>
        Back
      </Button>
    </Stack>
  );
}
