import type { ReactNode } from "react";

export function Banner({ tone, children }: { tone?: "ok" | "warn" | "danger"; children: ReactNode }) {
  return (
    <div className={`banner ${tone ? `banner-${tone}` : ""}`} role={tone === "danger" ? "alert" : "status"}>
      {children}
    </div>
  );
}
