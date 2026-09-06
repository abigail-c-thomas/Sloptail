import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "ok";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  block?: boolean;
  loading?: boolean;
}

export function Button({ variant = "primary", size = "md", block, loading, className = "", children, disabled, ...rest }: ButtonProps) {
  const cls = ["btn", `btn-${variant}`, size !== "md" ? `btn-${size}` : "", block ? "btn-block" : "", className].join(" ");
  return (
    <button type="button" className={cls} disabled={disabled || loading} {...rest}>
      {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : null}
      {children}
    </button>
  );
}
