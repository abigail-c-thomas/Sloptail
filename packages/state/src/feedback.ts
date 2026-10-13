import type { Feedback, FeedbackBody, FeedbackDecision, FeedbackFinish } from "@sloptail/shared";
import { StateError } from "./state.ts";

/**
 * Guest feedback's lifecycle. The bar triages (Do / Won't do); a Claude Code
 * session picks up what's marked Do, and closes it with a note. Each item is
 * stored on its own, so these work on one item, not the bar state.
 */

export function newFeedback(input: FeedbackBody, id: string, now: number): Feedback {
  return { ...input, id, createdAt: now, status: "new" };
}

/** The bar's call. Can be changed (or taken back to new) until a session starts on it. */
export function decideFeedback(f: Feedback, decision: FeedbackDecision["decision"], now: number): Feedback {
  if (f.status === "working" || f.status === "done") {
    throw new StateError("bad-transition", f.status === "working" ? "Claude's already working on this" : "This is already done");
  }
  if (f.status === decision) return f;
  const { note: _note, ...rest } = f;
  return { ...rest, status: decision, updatedAt: now };
}

/** A session claims it. Only what the bar said to do; starting twice is fine. */
export function startFeedback(f: Feedback, now: number): Feedback {
  if (f.status === "working") return f;
  if (f.status !== "todo") throw new StateError("bad-transition", `Can't start feedback that's ${f.status}`);
  return { ...f, status: "working", updatedAt: now };
}

/** A session closes it: done, or not doable after all, with a note saying what happened. */
export function finishFeedback(f: Feedback, { outcome, note }: FeedbackFinish, now: number): Feedback {
  if (f.status !== "todo" && f.status !== "working") throw new StateError("bad-transition", `Can't close feedback that's ${f.status}`);
  return { ...f, status: outcome, updatedAt: now, ...(note ? { note } : {}) };
}
