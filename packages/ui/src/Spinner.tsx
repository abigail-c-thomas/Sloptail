import type { ReactNode } from "react";

export function Spinner({ label }: { label?: ReactNode }) {
  return (
    <div className="spinner-wrap" role="status" aria-live="polite">
      <div className="spinner" />
      {label ? <p className="muted">{label}</p> : null}
    </div>
  );
}
