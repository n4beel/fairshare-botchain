import { HTMLAttributes } from "react";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  noPadding?: boolean;
}

/** Rounded, soft-edged block matching the explanatory register. */
export default function Panel({ elevated, noPadding, children, className = "", style, ...props }: PanelProps) {
  return (
    <div
      className={[noPadding ? "" : "p-6", className].join(" ")}
      style={{
        background: elevated ? "var(--bg-elevated)" : "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "12px",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
