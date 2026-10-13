import { useState } from "react";
import { Banner, Button, Stack, TextArea } from "@sloptail/ui";
import { api } from "../api.ts";

/** Bottom of the "My drinks" drawer: anything about the app, straight to the bar screen. */
export function FeedbackForm({ userId, userName, context }: { userId: string; userName: string; context: string }) {
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setState("sending");
    setError(null);
    try {
      await api.feedback({ userId, userName, text, context });
      setText("");
      setState("sent");
    } catch (e) {
      setError((e as Error).message);
      setState("idle");
    }
  };

  return (
    <Stack gap={8} className="feedback-form">
      <h3>Feedback</h3>
      <TextArea
        id="feedback"
        aria-label="Feedback"
        placeholder="Something broken, confusing, or great? Tell us."
        value={text}
        maxLength={2000}
        onChange={(e) => {
          setText(e.target.value);
          if (state === "sent") setState("idle");
        }}
      />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {state === "sent" ? <p className="small muted">Thanks! The bar's got it.</p> : null}
      <Button variant="secondary" disabled={!text.trim() || state === "sending"} onClick={send}>
        {state === "sending" ? "Sending…" : "Send feedback"}
      </Button>
    </Stack>
  );
}
