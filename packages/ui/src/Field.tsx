import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

interface FieldShellProps {
  label: ReactNode;
  help?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}

export function FieldShell({ label, help, children, htmlFor }: FieldShellProps) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {help ? <span className="help">{help}</span> : null}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  help?: ReactNode;
}

export function TextField({ label, help, id, className = "", ...rest }: TextFieldProps) {
  return (
    <FieldShell label={label} help={help} htmlFor={id}>
      <input id={id} className={`input ${className}`} {...rest} />
    </FieldShell>
  );
}

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: ReactNode;
  help?: ReactNode;
}

export function TextArea({ label, help, id, className = "", ...rest }: TextAreaProps) {
  return (
    <FieldShell label={label} help={help} htmlFor={id}>
      <textarea id={id} className={`textarea ${className}`} {...rest} />
    </FieldShell>
  );
}

/** Tappable suggestions that fill a text field. */
export function Chips({ items, onPick }: { items: string[]; onPick: (s: string) => void }) {
  return (
    <div className="chips">
      {items.map((s) => (
        <button key={s} type="button" className="chip" onClick={() => onPick(s)}>
          {s}
        </button>
      ))}
    </div>
  );
}
