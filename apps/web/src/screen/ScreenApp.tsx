import { useEffect, useState } from "react";
import { api, type Board } from "../api.ts";
import { Qr } from "./Qr.tsx";

const POLL_MS = 3000;

/**
 * For a screen in the room: a QR code to the guest page, and who's in progress
 * (queued or being made) and who's ready. Public, no token; shows names and drink names only.
 * `?url=` overrides what the QR code points at (e.g. a custom domain).
 */
export function ScreenApp() {
  const [board, setBoard] = useState<Board | null>(null);
  const target = new URLSearchParams(window.location.search).get("url") ?? `${window.location.origin}/`;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        setBoard(await api.board());
      } catch {
        /* keep showing the last board; try again next tick */
      }
      timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="screen">
      <section className="screen-qr">
        <Qr text={target} className="qr" />
        <div className="screen-url">{target.replace(/^https?:\/\//, "").replace(/\/$/, "")}</div>
      </section>

      <section className="screen-col">
        <h2>In progress</h2>
        <ul>
          {board?.inProgress.map((o, i) => (
            <li key={`${o.userName}-${o.drink}-${i}`}>
              <span className="who">{o.userName}</span>
              <span className="drink">{o.drink}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="screen-col ready">
        <h2>Ready</h2>
        <ul>
          {board?.ready.map((o, i) => (
            <li key={`${o.userName}-${o.drink}-${i}`}>
              <span className="who">{o.userName}</span>
              <span className="drink">{o.drink}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
