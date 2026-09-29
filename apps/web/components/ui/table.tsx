import type { ReactNode } from "react";

/** Replaces .data-table — used sparingly for genuinely columnar desktop data. Wrap in TableScroll for mobile. */
export function TableScroll({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-border">{children}</div>;
}

export function Table({ children }: { children: ReactNode }) {
  return <table className="w-full border-collapse text-sm">{children}</table>;
}

export function Thead({ children }: { children: ReactNode }) {
  return <thead className="bg-surface-muted">{children}</thead>;
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function Tr({ children }: { children: ReactNode }) {
  return <tr className="border-b border-border last:border-b-0 hover:bg-surface-muted">{children}</tr>;
}

export function Th({ children }: { children: ReactNode }) {
  return (
    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-text-muted">
      {children}
    </th>
  );
}

export function Td({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 align-middle text-text">{children}</td>;
}
