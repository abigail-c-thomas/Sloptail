import type { CSSProperties, ReactNode } from "react";

export function Stack({ gap, children, className = "" }: { gap?: number; children: ReactNode; className?: string }) {
  const style = gap !== undefined ? ({ "--gap": `${gap}px` } as CSSProperties) : undefined;
  return (
    <div className={`stack ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Row({
  gap,
  between,
  children,
  className = "",
}: {
  gap?: number;
  between?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const style = gap !== undefined ? ({ "--gap": `${gap}px` } as CSSProperties) : undefined;
  return (
    <div className={`row ${between ? "between" : ""} ${className}`} style={style}>
      {children}
    </div>
  );
}
