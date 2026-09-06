import type { ReactNode } from "react";

export interface ChoiceOption<T extends string | number> {
  value: T;
  label: ReactNode;
  hint?: ReactNode;
}

export interface ChoiceProps<T extends string | number> {
  value: T | undefined;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  /** Lay options out side by side instead of stacked. */
  inline?: boolean;
  name?: string;
}

/** A radio group that looks like buttons. Big targets, works with a thumb. */
export function Choice<T extends string | number>({ value, options, onChange, inline, name }: ChoiceProps<T>) {
  return (
    <div className={`choice ${inline ? "inline" : ""}`} role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="choice-opt"
          onClick={() => onChange(o.value)}
        >
          <span className="label">{o.label}</span>
          {o.hint ? <span className="hint">{o.hint}</span> : null}
        </button>
      ))}
    </div>
  );
}
