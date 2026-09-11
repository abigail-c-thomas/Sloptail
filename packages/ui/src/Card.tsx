import type { HTMLAttributes } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "accent" | "ok" | "warn" | "danger";
  flat?: boolean;
}

export function Card({ tone, flat, className = "", ...rest }: CardProps) {
  return <div className={["card", tone ? `tone-${tone}` : "", flat ? "flat" : "", className].join(" ")} {...rest} />;
}
