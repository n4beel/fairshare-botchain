"use client";

import { ButtonHTMLAttributes, CSSProperties, forwardRef } from "react";

type Variant = "primary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

/** Soft rounded buttons to match the explanatory tone. */
const variantStyles: Record<Variant, CSSProperties> = {
  primary: { background: "var(--accent)", color: "#06140E" },
  ghost: { background: "transparent", border: "1px solid var(--border-default)", color: "var(--text-secondary)" },
  danger: { background: "transparent", border: "1px solid var(--danger)", color: "var(--danger)" },
};

const sizeStyles: Record<Size, string> = {
  sm: "px-4 py-2 text-[13px]",
  md: "px-6 py-3 text-[15px]",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, children, className = "", style, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2 transition-opacity",
        "font-medium",
        "cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
        sizeStyles[size],
        className,
      ].join(" ")}
      style={{ borderRadius: "10px", ...variantStyles[variant], ...style }}
      {...props}
    >
      {loading ? (
        <>
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  ),
);

Button.displayName = "Button";
export default Button;
