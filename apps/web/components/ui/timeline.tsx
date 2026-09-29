import type { ReactNode } from "react";

/** Replaces .tl/.tli in the vault visit-history section. */
export function Timeline({ children }: { children: ReactNode }) {
  return <div className="flex flex-col">{children}</div>;
}

export function TimelineItem({
  date,
  title,
  children,
}: {
  date: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative border-s-2 border-border py-4 ps-5 last:pb-0">
      <span className="absolute top-5 -start-[7px] size-3 rounded-full border-2 border-surface bg-primary-600" />
      <div className="text-xs font-medium text-text-muted">{date}</div>
      <div className="font-semibold text-text">{title}</div>
      {children && <div className="mt-1 text-sm text-text-muted">{children}</div>}
    </div>
  );
}
