import type { ReactNode } from "react";

export function Badge({ tone, children }: { tone?: "accent" | "ok" | "warn" | "danger"; children: ReactNode }) {
  return <span className={`badge ${tone ? `badge-${tone}` : ""}`}>{children}</span>;
}
