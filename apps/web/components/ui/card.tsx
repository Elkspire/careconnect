import type { ElementType, ReactNode } from "react";

const PADDING = {
  sm: "p-3",
  md: "p-4 sm:p-5",
  lg: "p-6 sm:p-7",
} as const;

/** New design system's base surface — replaces .slip/.card/.dcard/.record-card. */
export function Card({
  as: As = "div",
  interactive = false,
  padding = "md",
  className = "",
  children,
}: {
  as?: ElementType;
  interactive?: boolean;
  padding?: keyof typeof PADDING;
  className?: string;
  children: ReactNode;
}) {
  return (
    <As
      className={`rounded-lg border border-border bg-surface shadow-sm ${PADDING[padding]} ${
        interactive ? "transition hover:border-primary-500 hover:shadow-md" : ""
      } ${className}`}
    >
      {children}
    </As>
  );
}
