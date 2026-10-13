import { useState } from "react";
import type { Feedback, FeedbackDecision, FeedbackStatus } from "@sloptail/shared";
import { Badge, Button, Card, Stack } from "@sloptail/ui";

/** Ready to paste into Claude Code: who, when, where they were in the app, what they said, and its id. */
export function feedbackText(f: Feedback): string {
  const when = new Date(f.createdAt).toLocaleString();
  const where = f.context ? ` on the "${f.context}" step` : "";
  return `Sloptail guest feedback ${f.id} from ${f.userName || "a guest"} (${when}${where}):\n\n${f.text}`;
}

/** The clipboard API, then the old select-and-copy for browsers that refuse it. */
async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      area.remove();
    }
  }
}

type Tab = "new" | "todo" | "done" | "wont";
const TABS: { tab: Tab; label: string; statuses: FeedbackStatus[] }[] = [
  { tab: "new", label: "New", statuses: ["new"] },
  { tab: "todo", label: "To do", statuses: ["todo", "working"] },
  { tab: "done", label: "Done", statuses: ["done"] },
  { tab: "wont", label: "Won't do", statuses: ["wont"] },
];

/**
 * Guest feedback in the bar's drawer. The bar only triages: Do or Won't do.
 * A Claude Code session watching the To do list (scripts/feedback.ts) picks
 * items up and closes them, so they move to Done on their own. Nothing is
 * deleted; the server keeps and logs every item.
 */
export function FeedbackList({ feedback, onDecide }: { feedback: Feedback[]; onDecide: (id: string, decision: FeedbackDecision["decision"]) => void }) {
  const [tab, setTab] = useState<Tab>("new");
  /** Which item (or "all") was just copied, for a moment of "Copied" (or "Couldn't copy"). */
  const [copied, setCopied] = useState<{ key: string; ok: boolean } | null>(null);
  const inTab = (t: Tab) => feedback.filter((f) => TABS.find((x) => x.tab === t)!.statuses.includes(f.status));
  const shown = inTab(tab);

  const copyAndFlag = async (key: string, text: string) => {
    const flag = { key, ok: await copy(text) };
    setCopied(flag);
    setTimeout(() => setCopied((c) => (c === flag ? null : c)), 2000);
  };
  const label = (key: string, idle: string) => (copied?.key !== key ? idle : copied.ok ? "Copied" : "Couldn't copy");

  return (
    <Stack gap={12}>
      <div className="row feedback-tabs" role="tablist">
        {TABS.map((t) => (
          <Button key={t.tab} size="sm" variant={t.tab === tab ? "primary" : "ghost"} role="tab" aria-selected={t.tab === tab} onClick={() => setTab(t.tab)}>
            {t.label} ({inTab(t.tab).length})
          </Button>
        ))}
      </div>
      {shown.length ? (
        <div className="row">
          <Button size="sm" variant="secondary" onClick={() => copyAndFlag("all", shown.map(feedbackText).join("\n\n---\n\n"))}>
            {label("all", `Copy all (${shown.length})`)}
          </Button>
        </div>
      ) : (
        <p className="muted">{tab === "new" ? "Nothing new." : tab === "todo" ? "Nothing waiting." : "None yet."}</p>
      )}
      {shown.map((f) => (
        <Card key={f.id} flat className="stack" style={{ gap: 6 }}>
          <div className="row between">
            <b>{f.userName || "Guest"}</b>
            <span className="small muted">
              {new Date(f.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {f.context ? ` · ${f.context}` : ""}
            </span>
          </div>
          <p className="feedback-text">{f.text}</p>
          {f.status === "working" ? <Badge tone="accent">Claude's on it</Badge> : f.status === "todo" ? <Badge>Waiting for Claude</Badge> : null}
          {f.note ? <p className="small muted feedback-text">{f.note}</p> : null}
          <div className="row">
            {f.status === "new" ? (
              <>
                <Button size="sm" variant="ok" onClick={() => onDecide(f.id, "todo")}>
                  Do
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDecide(f.id, "wont")}>
                  Won't do
                </Button>
              </>
            ) : f.status === "todo" ? (
              <Button size="sm" variant="ghost" onClick={() => onDecide(f.id, "new")}>
                Undo
              </Button>
            ) : f.status === "wont" ? (
              <Button size="sm" variant="ghost" onClick={() => onDecide(f.id, "todo")}>
                Do after all
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onClick={() => copyAndFlag(f.id, feedbackText(f))}>
              {label(f.id, "Copy")}
            </Button>
          </div>
        </Card>
      ))}
    </Stack>
  );
}
