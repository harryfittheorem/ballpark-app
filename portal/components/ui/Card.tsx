import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  accent?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
};

const PADDING = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
} as const;

export function Card({
  accent = false,
  padding = "md",
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      className={[
        "relative rounded-3xl border border-border-gold bg-darker shadow-card",
        accent ? "overflow-hidden" : "",
        PADDING[padding],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {accent ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent"
        />
      ) : null}
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className = "",
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-4 ${className}`.trim()}
    >
      <div className="min-w-0">
        <h2 className="font-display text-xl font-semibold tracking-wide text-cream-light">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-sm text-text-light">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardSectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-deep">
      {children}
    </h2>
  );
}
