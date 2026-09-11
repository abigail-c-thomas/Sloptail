import { useCallback, useMemo, useReducer, useState } from "react";
import type { Adventurousness, Order, Proposal, Strength, UserRequest } from "@sloptail/shared";
import { classicsFor } from "@sloptail/shared";
import {
  Banner,
  Button,
  Card,
  Choice,
  Drawer,
  ProposalCard,
  Spinner,
  Stack,
  Steps,
  Suggestions,
  TextArea,
  TextField,
} from "@sloptail/ui";
import { api, ApiError } from "../api.ts";
import {
  loadActiveOrder,
  loadLastRequest,
  loadUser,
  saveActiveOrder,
  saveLastRequest,
  saveUser,
} from "../storage.ts";
import { PastOrders } from "./PastOrders.tsx";
import { Tracking } from "./Tracking.tsx";

// ---------------------------------------------------------------------------
// Wizard state
// ---------------------------------------------------------------------------

type Step =
  | "name"
  | "kind"
  | "strength"
  | "adventure"
  | "disclaimer"
  | "prompt"
  | "classics"
  | "loading"
  | "proposal"
  | "tracking";

type Kind = "cocktail" | "mocktail";

interface State {
  step: Step;
  name: string;
  kind?: Kind;
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
  | { type: "kind"; kind: Kind }
  | { type: "strength"; strength: Strength }
  | { type: "adventure"; adventurousness: Adventurousness }
  | { type: "prompt"; prompt: string }
  | { type: "proposal"; proposal: Proposal; prompt: string }
  | { type: "error"; error: string }
  | { type: "submitted"; orderId: string }
  | { type: "reorder"; order: Order }
  | { type: "reset"; keepPrefs: boolean };

function kindOf(strength: Strength | undefined): Kind | undefined {
  if (!strength) return undefined;
  return strength === "zero" || strength === "trace" ? "mocktail" : "cocktail";
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "go":
      return { ...s, step: a.step, error: undefined };
    case "name":
      return { ...s, name: a.name };
    case "kind":
      return { ...s, kind: a.kind, strength: kindOf(s.strength) === a.kind ? s.strength : undefined, step: "strength" };
    case "strength":
      return { ...s, strength: a.strength, step: "adventure" };
    case "adventure":
      return {
        ...s,
        adventurousness: a.adventurousness,
        step: a.adventurousness === 1 ? "classics" : a.adventurousness === 3 ? "disclaimer" : "prompt",
      };
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
        kind: kindOf(a.order.request.strength),
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
        step: a.keepPrefs ? "prompt" : "kind",
        name: s.name,
        ...(a.keepPrefs ? { kind: s.kind, strength: s.strength, adventurousness: s.adventurousness } : {}),
        prompt: "",
      };
  }
}

function initialState(): State {
  const user = loadUser();
  const last = loadLastRequest();
  const active = loadActiveOrder();
  const prefs = last ? { kind: kindOf(last.strength), strength: last.strength, adventurousness: last.adventurousness } : {};
  if (active) return { step: "tracking", name: user.name, prompt: "", orderId: active, ...prefs };
  return { step: user.name ? "kind" : "name", name: user.name, prompt: "", ...prefs };
}

const STEP_ORDER: Step[] = ["name", "kind", "strength", "adventure", "prompt", "proposal"];

/**
 * Tappable prompt ideas: one tech in-joke plus two from the other list,
 * picked at random per visit.
 */
const TECH_IDEAS = [
  "A monoid in the category of endofunctors",
  "p(doom) > 50%",
  "Works on my machine",
  "3000-line rebase conflict",
  "It's not a bug, it's a feature",
  "O(n²) but n is small",
  "Reviewing my own PR",
  "YAML indentation",
  "Flaky test that passes on retry",
  "Reply-all to the whole company",
];

const OTHER_IDEAS = [
  "Cat sleeping in the sun",
  "Hiking through a pine forest",
  "Thinking about the Roman Empire",
  "Airport lounge at 6am",
  "Rain on a tin roof",
  "An extremely juicy pear",
  "Canadian wildfire",
  "Waiting for a train that isn't coming",
  "Brushing your teeth in the shower",
  "Motorway service station at midnight",
  "Wet dog",
  "IKEA on a Saturday",
  "Sunday evening",
  "Someone else's wedding",
  "Tinned peaches",
];

function shuffle<T>(arr: readonly T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function pickIdeas(): string[] {
  return shuffle([...shuffle(TECH_IDEAS).slice(0, 1), ...shuffle(OTHER_IDEAS).slice(0, 2)]);
}

const LOADING_LINES = [
  "Consulting the model…",
  "Arguing with the bitters…",
  "Rebalancing the sour…",
  "Checking what we haven't run out of…",
  "Naming things is hard…",
];

// ---------------------------------------------------------------------------

export function UserApp() {
  const [s, dispatch] = useReducer(reducer, undefined, initialState);
  const [drawer, setDrawer] = useState(false);
  const ideas = useMemo(pickIdeas, []);
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
        <span className="brand">Sloptail</span>
        <Button variant="ghost" size="sm" onClick={() => setDrawer(true)}>
          My drinks
        </Button>
      </header>

      {stepIndex >= 0 ? <Steps current={stepIndex + 1} total={STEP_ORDER.length} /> : null}

      {s.error ? <Banner tone="danger">{s.error}</Banner> : null}

      {s.step === "name" && (
        <NameStep
          name={s.name}
          onChange={(name) => dispatch({ type: "name", name })}
          onNext={() => {
            saveUser({ ...user, name: s.name.trim() });
            dispatch({ type: "go", step: "kind" });
          }}
        />
      )}

      {s.step === "kind" && (
        <Stack gap={16}>
          <Choice<Kind>
            value={s.kind}
            onChange={(kind) => dispatch({ type: "kind", kind })}
            options={[
              { value: "cocktail", label: "Cocktail" },
              { value: "mocktail", label: "Mocktail" },
            ]}
          />
          <Button variant="ghost" onClick={() => dispatch({ type: "go", step: "name" })}>
            Not {s.name}?
          </Button>
        </Stack>
      )}

      {s.step === "strength" && (
        <Stack gap={16}>
          <Choice<Strength>
            value={s.strength}
            onChange={(strength) => dispatch({ type: "strength", strength })}
            options={
              s.kind === "mocktail"
                ? [
                    { value: "zero", label: "Zero alcohol" },
                    { value: "trace", label: "Low", hint: "a dash of bitters is fine" },
                  ]
                : [
                    { value: "full", label: "Full strength" },
                    { value: "half", label: "Half strength" },
                  ]
            }
          />
          <Button variant="ghost" onClick={() => dispatch({ type: "go", step: "kind" })}>
            Back
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
              { value: 1, label: "Not at all" },
              { value: 2, label: "Get creative" },
              { value: 3, label: "Fuck my shit up" },
            ]}
          />
          <Button variant="ghost" onClick={() => dispatch({ type: "go", step: "strength" })}>
            Back
          </Button>
        </Stack>
      )}

      {s.step === "disclaimer" && (
        <Stack gap={16}>
          <Card tone="danger" className="stack">
            <h2>Disclaimer</h2>
            <p>
              We're going maximally weird with this. It'll be drinkable, in the sense that it'll be a liquid in a glass. We're not
              making any further guarantees. That sound ok?
            </p>
          </Card>
          <Button size="lg" onClick={() => dispatch({ type: "go", step: "prompt" })}>
            I accept
          </Button>
          <Button variant="secondary" onClick={() => dispatch({ type: "adventure", adventurousness: 2 })}>
            Back to safety
          </Button>
        </Stack>
      )}

      {s.step === "classics" && s.strength && (
        <Stack gap={16}>
          <h1>The classics</h1>
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
            aria-label="What do you feel like?"
            value={s.prompt}
            onChange={(e) => dispatch({ type: "prompt", prompt: e.target.value })}
            maxLength={500}
          />
          <Suggestions items={ideas} onPick={(p) => dispatch({ type: "prompt", prompt: p })} />
          <Button size="lg" onClick={generate}>
            Make something up
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
    </div>
  );
}

function NameStep({ name, onChange, onNext }: { name: string; onChange: (n: string) => void; onNext: () => void }) {
  const ok = name.trim().length > 0;
  return (
    <form
      className="stack name-step"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onNext();
      }}
    >
      <TextField
        id="name"
        aria-label="Name"
        value={name}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="given-name"
        autoFocus
        maxLength={40}
        placeholder="Name"
        style={{ textAlign: "center", fontSize: "1.25rem", minHeight: 56 }}
      />
      <Button type="submit" size="lg" block disabled={!ok} aria-label="Next" style={{ fontSize: "1.4rem" }}>
        →
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
          aria-label="Ask for a change"
          value={tweak}
          onChange={(e) => setTweak(e.target.value)}
          placeholder="Ask for a change"
          maxLength={500}
          rows={2}
        />
        <div className="row">
          <Button variant="secondary" disabled={!tweak.trim()} onClick={() => onTweak(tweak)}>
            Tweak it
          </Button>
          <Button variant="ghost" onClick={onRegenerate}>
            Try again
          </Button>
        </div>
      </Card>
      <Button variant="ghost" onClick={onBack}>
        Back
      </Button>
    </Stack>
  );
}
